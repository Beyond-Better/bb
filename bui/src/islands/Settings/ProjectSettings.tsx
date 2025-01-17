import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';

import { useAppState } from '../../hooks/useAppState.ts';

// Helper function to format YAML with proper array syntax
function formatYaml(obj: unknown): string {
	let yaml = stringifyYaml(obj);
	const arrayPattern = /([\s\n]+)'\d+':\s*([^\n]+)/g;
	yaml = yaml.replace(arrayPattern, '$1- $2');
	return yaml;
}

interface FormState {
	myPersonsName: string;
	myAssistantsName: string;
	maxTurns: number;
	toolConfigs: string;
}

interface FormErrors {
	myPersonsName?: string;
	myAssistantsName?: string;
	maxTurns?: string;
	toolConfigs?: string;
}

const loading = signal(true);
const formErrors = signal<FormErrors>({});
const showSensitive = signal(false);

// Helper function to check if YAML contains sensitive values
function hasSensitiveValues(yaml: string): boolean {
	try {
		if (!yaml?.trim()) return false;
		const obj = parseYaml(yaml);
		if (!obj || typeof obj !== 'object') return false;
		const { wasRedacted } = redactSensitiveInfo(obj);
		return wasRedacted;
	} catch (_error) {
		return false;
	}
}

interface RedactionResult {
	value: unknown;
	wasRedacted: boolean;
}

function redactSensitiveInfo(obj: unknown): RedactionResult {
	if (Array.isArray(obj)) {
		const results = obj.map((item) => redactSensitiveInfo(item));
		return {
			value: results.map((r) => r.value),
			wasRedacted: results.some((r) => r.wasRedacted),
		};
	}

	if (!obj || typeof obj !== 'object') {
		return { value: obj, wasRedacted: false };
	}

	let wasAnyValueRedacted = false;
	const redactedObj: Record<string, unknown> = {};
	const sensitivePatterns = [
		/api[_-]?key/i,
		/secret/i,
		/password/i,
		/token/i,
		/credential/i,
	];

	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === 'object' && value !== null) {
			const result = redactSensitiveInfo(value);
			redactedObj[key] = result.value;
			wasAnyValueRedacted = wasAnyValueRedacted || result.wasRedacted;
		} else if (typeof value === 'string') {
			const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));
			if (isSensitive) {
				redactedObj[key] = '[REDACTED]';
				wasAnyValueRedacted = true;
			} else {
				redactedObj[key] = value;
			}
		} else {
			redactedObj[key] = value;
		}
	}

	return { value: redactedObj, wasRedacted: wasAnyValueRedacted };
}

const TOOLS_PLACEHOLDER = `run_command:
  allowedCommands:
    - npm
    - git branch
    - git checkout
    - ls
    - cd
    - pwd
    - mv
    - cp`;

export default function ProjectSettings() {
	const appState = useAppState();
	const [formState, setFormState] = useState<FormState>({
		myPersonsName: '',
		myAssistantsName: '',
		maxTurns: 50,
		toolConfigs: '',
	});

	// Load initial config
	useEffect(() => {
		const loadConfig = async () => {
			try {
				const config = await appState.value.apiClient?.getGlobalConfig();
				if (config) {
					setFormState({
						myPersonsName: config.myPersonsName,
						myAssistantsName: config.myAssistantsName,
						maxTurns: config.api.maxTurns,
						toolConfigs: config.api.toolConfigs && Object.keys(config.api.toolConfigs).length > 0
							? formatYaml(config.api.toolConfigs)
							: '',
					});
				}
			} catch (error) {
				console.error('Failed to load config:', error);
			} finally {
				loading.value = false;
			}
		};

		loadConfig();
	}, [appState.value.apiClient]);

	const validateField = (name: keyof FormState, value: string | number): string | undefined => {
		switch (name) {
			case 'myPersonsName':
			case 'myAssistantsName':
				if (typeof value !== 'string' || !value.trim()) {
					return 'This field is required';
				}
				break;
			case 'maxTurns': {
				const turns = Number(value);
				if (isNaN(turns) || turns < 1 || turns > 100 || !Number.isInteger(turns)) {
					return 'Must be a positive integer between 1 and 100';
				}
				break;
			}
			case 'toolConfigs':
				if (typeof value !== 'string') return 'Must be a YAML string';
				try {
					parseYaml(value);
				} catch (_error) {
					return 'Invalid YAML format';
				}
				break;
		}
		return undefined;
	};

	const handleInputChange = (
		e: Event,
		field: keyof FormState,
	) => {
		const target = e.target as HTMLInputElement | HTMLTextAreaElement;
		const value = field === 'maxTurns' ? Number(target.value) : target.value;

		// Update form state
		setFormState((prev) => ({ ...prev, [field]: value }));

		// Validate and update errors
		const error = validateField(field, value);
		formErrors.value = {
			...formErrors.value,
			[field]: error,
		};
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		// Validate all fields
		const errors: FormErrors = {};
		(Object.keys(formState) as Array<keyof FormState>).forEach((field) => {
			const error = validateField(field, formState[field]);
			if (error) errors[field] = error;
		});

		if (Object.keys(errors).length > 0) {
			formErrors.value = errors;
			return;
		}

		try {
			// Update each field individually
			await appState.value.apiClient?.updateGlobalConfig('myPersonsName', formState.myPersonsName);
			await appState.value.apiClient?.updateGlobalConfig('myAssistantsName', formState.myAssistantsName);
			await appState.value.apiClient?.updateGlobalConfig('api.maxTurns', formState.maxTurns.toString());
			// Parse YAML to validate and save entire toolConfigs
			const toolConfigsObject = formState.toolConfigs.trim() ? parseYaml(formState.toolConfigs) : {};
			await appState.value.apiClient?.updateGlobalConfig('api.toolConfigs', JSON.stringify(toolConfigsObject));

			// Show success message
			// TODO: Add toast notification system
			console.log('Settings updated successfully');
		} catch (error) {
			console.error('Failed to update settings:', error);
			// TODO: Add error toast notification
		}
	};

	if (loading.value) {
		return (
			<div class='p-6'>
				<div class='animate-pulse space-y-4'>
					<div class='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
					<div class='space-y-3'>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div class='p-6'>
			<div class='flex items-center space-x-3 mb-6'>
				<div>
					<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Project Settings</h3>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Set default behaviors for projects
					</p>
				</div>
			</div>
			<form onSubmit={handleSubmit} class='max-w-4xl'>
				{/* Names Section */}
				<div class='mb-8'>
					<div class='grid grid-cols-2 gap-6'>
						{/* User's Name */}
						<div>
							<label
								for='myPersonsName'
								class='block text-base font-medium text-gray-700 dark:text-gray-300'
							>
								Your Name
							</label>
							<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
								The name the assistant will use when referring to you in conversations
							</p>
							<input
								type='text'
								id='myPersonsName'
								value={formState.myPersonsName}
								onChange={(e) => handleInputChange(e, 'myPersonsName')}
								class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-base px-3 py-2'
							/>
							{formErrors.value.myPersonsName && (
								<p class='mt-2 text-base text-red-600 dark:text-red-400'>
									{formErrors.value.myPersonsName}
								</p>
							)}
						</div>

						{/* Assistant's Name */}
						<div>
							<label
								for='myAssistantsName'
								class='block text-base font-medium text-gray-700 dark:text-gray-300'
							>
								Assistant's Name
							</label>
							<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
								What the AI assistant will call itself during conversations
							</p>
							<input
								type='text'
								id='myAssistantsName'
								value={formState.myAssistantsName}
								onChange={(e) => handleInputChange(e, 'myAssistantsName')}
								class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-base px-3 py-2'
							/>
							{formErrors.value.myAssistantsName && (
								<p class='mt-2 text-base text-red-600 dark:text-red-400'>
									{formErrors.value.myAssistantsName}
								</p>
							)}
						</div>
					</div>
				</div>

				{/* Max Turns */}
				<div class='mb-8'>
					<label
						for='maxTurns'
						class='block text-base font-medium text-gray-700 dark:text-gray-300'
					>
						Maximum Turns
					</label>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Limits tool uses per statement to prevent infinite loops and control token usage
					</p>
					<div class='max-w-[200px]'>
						<input
							type='number'
							id='maxTurns'
							min='1'
							max='100'
							value={formState.maxTurns}
							onChange={(e) => handleInputChange(e, 'maxTurns')}
							class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-base px-3 py-2'
						/>
					</div>
					{formErrors.value.maxTurns && (
						<p class='mt-2 text-base text-red-600 dark:text-red-400'>
							{formErrors.value.maxTurns}
						</p>
					)}
				</div>

				{/* Tool Configs */}
				<div class='mb-8'>
					<label
						for='toolConfigs'
						class='block text-base font-medium text-gray-700 dark:text-gray-300'
					>
						Tool Configurations (YAML)
					</label>
					{hasSensitiveValues(formState.toolConfigs) && (
						<button
							type='button'
							onClick={() => showSensitive.value = !showSensitive.value}
							class='ml-2 inline-flex items-center px-2 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
						>
							{showSensitive.value
								? 'Hide Configuration'
								: 'Edit Configuration (Contains Sensitive Values)'}
						</button>
					)}
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Configures behavior of the assistant's tools like allowed commands and API keys. Each tool can
						have its own settings.
					</p>
					<textarea
						id='toolConfigs'
						rows={10}
						value={hasSensitiveValues(formState.toolConfigs)
							? (showSensitive.value
								? formState.toolConfigs
								: formatYaml(redactSensitiveInfo(parseYaml(formState.toolConfigs)).value))
							: formState.toolConfigs}
						readOnly={hasSensitiveValues(formState.toolConfigs) && !showSensitive.value}
						onChange={(e) => handleInputChange(e, 'toolConfigs')}
						placeholder={TOOLS_PLACEHOLDER}
						class='mt-1 form-textarea block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm leading-relaxed font-mono px-3 py-2'
					/>
					{formErrors.value.toolConfigs && (
						<p class='mt-2 text-base text-red-600 dark:text-red-400'>
							{formErrors.value.toolConfigs}
						</p>
					)}
				</div>

				{/* Submit Button */}
				<div class='flex justify-end'>
					<button
						type='submit'
						class='inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600'
					>
						Save Changes
					</button>
				</div>
			</form>
		</div>
	);
}
