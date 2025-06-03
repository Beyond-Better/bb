import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';

import { useAppState } from '../../hooks/useAppState.ts';
import {
	ModelCombinations,
	ModelSelectHelp,
	type ModelSelectionValue,
	ModelSelector,
	ModelSystemCardsLink,
} from '../../components/ModelSelector.tsx';
//import type { DefaultModels } from 'shared/config/types.ts';
import { Toast } from '../../components/Toast.tsx';

// Helper function to format YAML with proper array syntax
function formatYaml(obj: unknown): string {
	if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
		return '';
	}
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
	extendedThinkingEnabled: boolean;
	extendedThinkingBudget: number;
	activeTab: string;
	defaultModels: {
		orchestrator: string;
		agent: string;
		chat: string;
	};
}

interface FormErrors {
	myPersonsName?: string;
	myAssistantsName?: string;
	maxTurns?: string;
	toolConfigs?: string;
	extendedThinkingEnabled?: string;
	extendedThinkingBudget?: string;
	activeTab?: string;
	defaultModels?: {
		orchestrator?: string;
		agent?: string;
		chat?: string;
	};
}

const loading = signal(true);
const formErrors = signal<FormErrors>({});
const showSensitive = signal(false);
const dirtyTabs = signal<Set<string>>(new Set());
//const showHelper = signal(true);

const SUB_TABS = [
	{
		id: 'general',
		label: 'General',
		icon:
			'M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75',
	},
	{
		id: 'tools',
		label: 'Tools',
		icon:
			'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
	},
	{
		id: 'models',
		label: 'Models',
		icon:
			'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
	},
];

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

export default function DefaultProjectSettings() {
	const appState = useAppState();
	const [formState, setFormState] = useState<FormState>({
		myPersonsName: '',
		myAssistantsName: '',
		maxTurns: 50,
		toolConfigs: '',
		extendedThinkingEnabled: true,
		extendedThinkingBudget: 4000,
		activeTab: 'general',
		defaultModels: {
			orchestrator: 'claude-sonnet-4-20250514',
			agent: 'claude-sonnet-4-20250514',
			chat: 'claude-3-5-haiku-20241022',
		},
	});
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');

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
						extendedThinkingEnabled: config.api.extendedThinking?.enabled ?? true,
						extendedThinkingBudget: config.api.extendedThinking?.budgetTokens ?? 4000,
						activeTab: 'general',
						defaultModels: {
							orchestrator: config.defaultModels?.orchestrator || 'claude-sonnet-4-20250514',
							agent: config.defaultModels?.agent || 'claude-sonnet-4-20250514',
							chat: config.defaultModels?.chat || 'claude-3-5-haiku-20241022',
						},
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

	const validateField = (
		name: keyof FormState,
		value: string | number | boolean | string | { orchestrator: string; agent: string; chat: string },
	): string | undefined => {
		// Skip validation for these types
		if (name === 'activeTab') {
			return undefined;
		}

		if (name === 'defaultModels') {
			const models = value as { orchestrator: string; agent: string; chat: string };
			//console.log(`DefaultProjectSettings: validateField: defaultModels: `, models);
			if (!models.orchestrator || !models.agent || !models.chat) {
				return 'All model roles must be selected';
			}
			return undefined;
		}

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
			case 'extendedThinkingBudget': {
				const budget = Number(value);
				if (isNaN(budget) || budget < 1024 || !Number.isInteger(budget)) {
					return 'Must be a positive integer of at least 1024 tokens';
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
		let value: string | number | boolean;

		if (field === 'maxTurns' || field === 'extendedThinkingBudget') {
			value = Number(target.value);
		} else if (field === 'extendedThinkingEnabled') {
			value = (target as HTMLInputElement).checked;
		} else {
			value = target.value;
		}

		// Update form state
		setFormState((prev) => ({ ...prev, [field]: value }));

		// Validate and update errors
		const error = validateField(field, value);
		formErrors.value = {
			...formErrors.value,
			[field]: error,
		};
	};

	// Helper function for model updates
	const handleModelChange = (role: 'orchestrator' | 'agent' | 'chat', modelId: string) => {
		const newModels = {
			...formState.defaultModels,
			[role]: modelId,
		};
		setFormState((prev) => ({ ...prev, defaultModels: newModels }));

		// Validate and update errors
		const error = validateField('defaultModels', newModels);
		formErrors.value = {
			...formErrors.value,
			defaultModels: error ? { [role]: error } : undefined,
		};
	};

	// Handle model combo application
	const handleApplyCombo = (combo: { orchestrator: string; agent: string; chat: string }) => {
		setFormState((prev) => ({ ...prev, defaultModels: combo }));
		markTabDirty('models');
	};

	const handleSubmit = async (e: Event) => {
		console.log(`DefaultProjectSettings: Handle submit`);
		e.preventDefault();

		// Validate all fields
		const errors: FormErrors = {};
		(Object.keys(formState) as Array<keyof FormState>).forEach((field) => {
			const error = validateField(field, formState[field]);
			if (error) errors[field] = error;
		});
		console.log(`DefaultProjectSettings: Form errors: `, errors);

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
			// Update extended thinking settings
			await appState.value.apiClient?.updateGlobalConfig(
				'api.extendedThinking.enabled',
				formState.extendedThinkingEnabled.toString(),
			);
			await appState.value.apiClient?.updateGlobalConfig(
				'api.extendedThinking.budgetTokens',
				formState.extendedThinkingBudget.toString(),
			);
			// Update default models
			await appState.value.apiClient?.updateGlobalConfig(
				'defaultModels',
				JSON.stringify(formState.defaultModels),
			);

			// Reset dirty tabs state
			dirtyTabs.value = new Set();

			// Show success message
			console.log('Settings updated successfully');

			setToastMessage('Settings Saved!');
			setShowToast(true);
		} catch (error) {
			console.error('Failed to update settings:', error);
			// TODO: Add error toast notification
		}
	};

	const handleTabChange = (tabId: string) => {
		// If switching from a tab with unsaved changes, show a brief toast message
		if (dirtyTabs.value.has(formState.activeTab)) {
			console.log(`DefaultProjectSettings: Changes in ${formState.activeTab} preserved`);
			// Here you could add a toast notification
		}

		setFormState({ ...formState, activeTab: tabId });
	};

	const markTabDirty = (tabId: string) => {
		const updated = new Set(dirtyTabs.value);
		updated.add(tabId);
		dirtyTabs.value = updated;
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

			{
				/*showHelper.value && (
				<div class='mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 flex justify-between items-center'>
					<p class='text-sm text-blue-700 dark:text-blue-300'>
						You can freely switch between tabs - your changes are preserved until you save or cancel
					</p>
					<button
						type='button'
						onClick={() => showHelper.value = false}
						class='text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
					>
						Got it
					</button>
				</div>
			)*/
			}

			{dirtyTabs.value.size > 0 && (
				<div class='mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-2 text-sm text-yellow-700 dark:text-yellow-300'>
					You have unsaved changes in {Array.from(dirtyTabs.value).join(', ')}
				</div>
			)}

			<div class='mb-4 border-b border-gray-200 dark:border-gray-700'>
				<ul class='flex flex-wrap -mb-px text-sm font-medium text-center'>
					{SUB_TABS.map((tab) => (
						<li class='mr-2' key={tab.id}>
							<button
								type='button'
								onClick={() => handleTabChange(tab.id)}
								class={`inline-flex items-center p-4 border-b-2 rounded-t-lg group ${
									formState.activeTab === tab.id
										? 'text-blue-600 border-blue-600 dark:text-blue-500 dark:border-blue-500'
										: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300'
								}`}
							>
								<svg
									class={`w-4 h-4 mr-2 ${
										formState.activeTab === tab.id
											? 'text-blue-600 dark:text-blue-500'
											: 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-300'
									}`}
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
									xmlns='http://www.w3.org/2000/svg'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='2'
										d={tab.icon}
									/>
								</svg>
								{tab.label}
								{dirtyTabs.value.has(tab.id) && (
									<span class='flex w-2 h-2 bg-blue-500 rounded-full ml-1.5'></span>
								)}
							</button>
						</li>
					))}
				</ul>
			</div>

			<form onSubmit={handleSubmit} class='w-full'>
				{/* Tab Content */}
				{formState.activeTab === 'general' && (
					<div className='general-tab'>
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
										onChange={(e) => {
											handleInputChange(e, 'myPersonsName');
											markTabDirty('general');
										}}
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
										onChange={(e) => {
											handleInputChange(e, 'myAssistantsName');
											markTabDirty('general');
										}}
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
									onChange={(e) => {
										handleInputChange(e, 'maxTurns');
										markTabDirty('general');
									}}
									class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-base px-3 py-2'
								/>
							</div>
							{formErrors.value.maxTurns && (
								<p class='mt-2 text-base text-red-600 dark:text-red-400'>
									{formErrors.value.maxTurns}
								</p>
							)}
						</div>

						{/* Extended Thinking */}
						<div class='mb-8'>
							<div class='flex items-center justify-between'>
								<label
									for='extendedThinkingEnabled'
									class='block text-base font-medium text-gray-700 dark:text-gray-300'
								>
									Extended Thinking
								</label>
								<div class='relative inline-block w-12 mr-2 align-middle select-none'>
									<input
										type='checkbox'
										id='extendedThinkingEnabled'
										checked={formState.extendedThinkingEnabled}
										onChange={(e) => {
											handleInputChange(e, 'extendedThinkingEnabled');
											markTabDirty('general');
										}}
										class='toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer'
									/>
									<label
										for='extendedThinkingEnabled'
										class='toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-700 cursor-pointer'
									>
									</label>
								</div>
							</div>
							<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
								Enables Claude to show its step-by-step reasoning process for complex tasks
							</p>

							{formState.extendedThinkingEnabled && (
								<div class='mt-4'>
									<label
										for='extendedThinkingBudget'
										class='block text-sm font-medium text-gray-700 dark:text-gray-300'
									>
										Thinking Budget (tokens)
									</label>
									<p class='mt-1 text-xs text-gray-500 dark:text-gray-400'>
										Maximum tokens Claude can use for reasoning (minimum 1,024)
									</p>
									<div class='max-w-[200px]'>
										<input
											type='number'
											id='extendedThinkingBudget'
											min='1024'
											step='1000'
											value={formState.extendedThinkingBudget}
											onChange={(e) => {
												handleInputChange(e, 'extendedThinkingBudget');
												markTabDirty('general');
											}}
											class='mt-1 form-input block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm px-3 py-2'
										/>
									</div>
									{formErrors.value.extendedThinkingBudget && (
										<p class='mt-2 text-sm text-red-600 dark:text-red-400'>
											{formErrors.value.extendedThinkingBudget}
										</p>
									)}
								</div>
							)}
						</div>
					</div>
				)}

				{formState.activeTab === 'tools' && (
					<div className='tools-tab'>
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
								Configures behavior of the assistant's tools like allowed commands and API keys. Each
								tool can have its own settings.
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
								onChange={(e) => {
									handleInputChange(e, 'toolConfigs');
									markTabDirty('tools');
								}}
								placeholder={TOOLS_PLACEHOLDER}
								class='mt-1 form-textarea block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm leading-relaxed font-mono px-3 py-2'
							/>
							{formErrors.value.toolConfigs && (
								<p class='mt-2 text-base text-red-600 dark:text-red-400'>
									{formErrors.value.toolConfigs}
								</p>
							)}
						</div>
					</div>
				)}

				{formState.activeTab === 'models' && (
					<div className='models-tab space-y-6'>
						{/* Header with Icon Legend */}
						<div class='flex justify-between items-start mb-6'>
							<div>
								<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100 mb-2'>
									Default Models
								</h3>
								<p class='text-sm text-gray-500 dark:text-gray-400'>
									Set the default AI models for different roles. These will be used across all
									projects unless overridden.
								</p>
							</div>
							<div class='flex-shrink-0 '>
								<ModelSystemCardsLink />
							</div>
						</div>

						{/* Model Role Explanations and Icon Legend side by side */}
						<ModelSelectHelp />

						{/* Model Selection */}
						<div class='grid grid-cols-1 md:grid-cols-3 gap-6'>
							{/* Orchestrator Model */}
							<ModelSelector
								key={`orchestrator-${formState.defaultModels.orchestrator}`}
								apiClient={appState.value.apiClient!}
								context='global'
								role='orchestrator'
								value={formState.defaultModels.orchestrator}
								onChange={(value) => {
									handleModelChange('orchestrator', value as string);
									markTabDirty('models');
								}}
								label='Orchestrator Model'
								description='Handles complex reasoning and coordination'
							/>

							{/* Agent Model */}
							<ModelSelector
								key={`agent-${formState.defaultModels.agent}`}
								apiClient={appState.value.apiClient!}
								context='global'
								role='agent'
								value={formState.defaultModels.agent}
								onChange={(value) => {
									handleModelChange('agent', value as string);
									markTabDirty('models');
								}}
								label='Agent Model'
								description='Executes tasks and uses tools'
							/>

							{/* Admin Model */}
							<ModelSelector
								key={`chat-${formState.defaultModels.chat}`}
								apiClient={appState.value.apiClient!}
								context='global'
								role='chat'
								value={formState.defaultModels.chat}
								onChange={(value) => {
									handleModelChange('chat', value as string);
									markTabDirty('models');
								}}
								label='Admin Model'
								description='Handles administrative tasks and meta-operations'
							/>
						</div>

						{/* Suggested Combinations */}
						<div class='mt-8'>
							<ModelCombinations
								onApplyCombo={handleApplyCombo}
								className='max-w'
							/>
						</div>

						{/* Display current selection summary */}
						<div class='bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-4'>
							<h4 class='text-sm font-medium text-blue-900 dark:text-blue-100 mb-2'>
								Current Selection
							</h4>
							<div class='text-sm text-blue-800 dark:text-blue-200'>
								<div>
									<strong>Orchestrator:</strong> {formState.defaultModels.orchestrator}
								</div>
								<div>
									<strong>Agent:</strong> {formState.defaultModels.agent}
								</div>
								<div>
									<strong>Admin:</strong> {formState.defaultModels.chat}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Submit Button */}
				<div class='flex justify-end mt-6'>
					<button
						type='submit'
						class='inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600'
					>
						Save Changes
					</button>
				</div>
			</form>

			{/* Toast notifications */}
			{showToast && (
				<Toast
					message={toastMessage}
					type='success'
					duration={2000}
					onClose={() => setShowToast(false)}
				/>
			)}
		</div>
	);
}
