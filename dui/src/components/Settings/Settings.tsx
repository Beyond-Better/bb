import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { GlobalConfigValues, RustGlobalConfig } from '../../types/settings';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';

const defaultConfig: GlobalConfigValues = {
	myPersonsName: '',
	myAssistantsName: '',
	'api.maxTurns': 25,
	'api.llmKeys.anthropic': '',
};

export function Settings(): JSX.Element {
	const [config, setConfig] = useState<GlobalConfigValues>(defaultConfig);
	const [originalConfig, setOriginalConfig] = useState<GlobalConfigValues>(defaultConfig);
	const [showRestartConfirm, setShowRestartConfirm] = useState(false);
	const [errors, setErrors] = useState<Partial<Record<keyof GlobalConfigValues, string>>>({});

	useEffect(() => {
		loadConfig();
	}, []);

	const loadConfig = async () => {
		console.log('Loading config...');
		try {
			console.log('Invoking get_global_config...');
			const rustConfig = await invoke<RustGlobalConfig>('get_global_config');
			// console.log('Received response from get_global_config');
			// console.log('Full Rust config structure:', JSON.stringify(rustConfig, null, 2));
			// // Verify property access
			// console.log('Direct property check:', {
			// 	hasMyPersonsName: 'myPersonsName' in rustConfig,
			// 	myPersonsNameValue: rustConfig.myPersonsName,
			// 	propertyNames: Object.keys(rustConfig),
			// });
			// // Log the raw response
			// console.log('Raw config from Rust:', rustConfig);
			// console.log('Config type:', Object.prototype.toString.call(rustConfig));
			// console.log('Config keys:', Object.keys(rustConfig));
			// console.log('Config entries:', Object.entries(rustConfig));
			// console.log('myPersonsName from Rust:', rustConfig.myPersonsName);
			// console.log('api.maxTurns from Rust:', rustConfig.api?.maxTurns);
			// console.log('api.llmKeys from Rust:', rustConfig.api?.llmKeys);

			// Map snake_case Rust config to our frontend format
			const configValues: GlobalConfigValues = {
				myPersonsName: rustConfig.myPersonsName || '',
				myAssistantsName: rustConfig.myAssistantsName || '',
				'api.maxTurns': rustConfig.api?.maxTurns ?? 25,
				'api.llmKeys.anthropic': rustConfig.api?.llmKeys?.anthropic || '',
			};

			// console.log('Mapped config values:', configValues);
			// console.log('Mapped myPersonsName:', configValues.myPersonsName);
			// console.log('Mapped api.maxTurns:', configValues['api.maxTurns']);
			// console.log('Mapped api.llmKeys.anthropic:', configValues['api.llmKeys.anthropic']);
			setConfig(configValues);
			setOriginalConfig(configValues);
		} catch (error) {
			console.error('Failed to load config:', error);
		}
	};

	const validateForm = (): boolean => {
		const newErrors: Partial<Record<keyof GlobalConfigValues, string>> = {};

		if (!config.myPersonsName.trim()) {
			newErrors.myPersonsName = 'Name is required';
		}

		if (!config.myAssistantsName.trim()) {
			newErrors.myAssistantsName = 'Assistant name is required';
		}

		const apiKey = config['api.llmKeys.anthropic'].trim();
		// Only validate if the key is being changed (not masked)
		if (apiKey && !apiKey.endsWith('...') && (!apiKey.startsWith('sk-ant-api03-') || apiKey.length < 48)) {
			newErrors['api.llmKeys.anthropic'] = 'Invalid Anthropic API key format';
		}

		if (config['api.maxTurns'] < 1) {
			newErrors['api.maxTurns'] = 'Max turns must be at least 1';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleInputChange = (key: keyof GlobalConfigValues, value: string | number) => {
		console.log('Input change:', key, value);
		setConfig((prev) => ({ ...prev, [key]: value }));
		// Clear error when user starts typing
		if (errors[key]) {
			setErrors((prev) => ({ ...prev, [key]: undefined }));
		}
	};

	const handleSave = async () => {
		if (!validateForm()) return;

		try {
			// Only save values that have changed
			const updates = [];

			if (config.myPersonsName !== originalConfig.myPersonsName) {
				console.log('Updating myPersonsName:', config.myPersonsName);
				updates.push(['myPersonsName', config.myPersonsName]);
			}

			if (config.myAssistantsName !== originalConfig.myAssistantsName) {
				console.log('Updating myAssistantsName:', config.myAssistantsName);
				updates.push(['myAssistantsName', config.myAssistantsName]);
			}

			if (config['api.maxTurns'] !== originalConfig['api.maxTurns']) {
				console.log('Updating api.maxTurns:', config['api.maxTurns']);
				updates.push(['api.maxTurns', config['api.maxTurns'].toString()]);
			}

			const apiKey = config['api.llmKeys.anthropic'];
			const originalApiKey = originalConfig['api.llmKeys.anthropic'];
			if (apiKey !== originalApiKey && !apiKey.endsWith('...')) {
				console.log('Updating API key');
				updates.push(['api.llmKeys.anthropic', apiKey]);
				console.log('Updates array:', updates);
			}

			console.log(
				'Saving updates:',
				updates.map(([key, value]) => [
					key,
					key.includes('llmKeys') ? '[REDACTED]' : value,
				]),
			);

			// Apply all updates
			for (const [key, value] of updates) {
				await invoke('set_global_config_value', { key, value });
			}

			if (updates.length > 0) {
				setShowRestartConfirm(true);
			} else {
				// No changes made, just go back
				window.history.back();
			}
		} catch (error) {
			console.error('Failed to save config:', error);
		}
	};

	const handleResetDefaults = () => {
		setConfig(defaultConfig);
		setErrors({});
	};

	const handleRestartConfirm = async () => {
		try {
			await invoke('stop_api');
			await invoke('start_api');
			setShowRestartConfirm(false);
			// Navigate back
			window.history.back();
		} catch (error) {
			console.error('Failed to restart Server:', error);
		}
	};

	return (
		<div className='max-w-2xl mx-auto'>
			<div className='flex justify-between items-center mb-6'>
				<h2 className='text-2xl font-bold dark:text-white'>Settings</h2>
				<div className='space-x-4'>
					<button
						onClick={() => window.history.back()}
						className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded'
					>
						Back
					</button>
					<button
						onClick={handleResetDefaults}
						className='px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded'
					>
						Reset to Defaults
					</button>
				</div>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleSave();
				}}
				className='space-y-6'
			>
				<div>
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
						Anthropic API Key
					</label>
					<div className='relative'>
						<input
							type='text'
							value={config['api.llmKeys.anthropic']}
							onChange={(e) => handleInputChange('api.llmKeys.anthropic', e.currentTarget.value)}
							className={`w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
								errors['api.llmKeys.anthropic']
									? 'border-red-500'
									: 'border-gray-300 dark:border-gray-600'
							}`}
							placeholder='sk-ant-api03-...'
						/>
						{config['api.llmKeys.anthropic'].endsWith('...') && (
							<span className='absolute right-3 top-2 text-sm text-gray-500 dark:text-gray-400'>
								(Masked)
							</span>
						)}
					</div>
					{errors['api.llmKeys.anthropic'] && (
						<p className='mt-1 text-sm text-red-500'>{errors['api.llmKeys.anthropic']}</p>
					)}
				</div>

				<div>
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
						Your Name
					</label>
					<input
						type='text'
						value={config.myPersonsName}
						onChange={(e) => handleInputChange('myPersonsName', e.currentTarget.value)}
						className={`w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
							errors.myPersonsName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
						}`}
					/>
					{errors.myPersonsName && <p className='mt-1 text-sm text-red-500'>{errors.myPersonsName}</p>}
				</div>

				<div>
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
						Assistant Name
					</label>
					<input
						type='text'
						value={config.myAssistantsName}
						onChange={(e) => handleInputChange('myAssistantsName', e.currentTarget.value)}
						className={`w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
							errors.myAssistantsName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
						}`}
					/>
					{errors.myAssistantsName && <p className='mt-1 text-sm text-red-500'>{errors.myAssistantsName}</p>}
				</div>

				<div>
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
						Max Turns
					</label>
					<input
						type='number'
						min='1'
						value={config['api.maxTurns']}
						onChange={(e) => handleInputChange('api.maxTurns', parseInt(e.currentTarget.value) || 0)}
						className={`w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
							errors['api.maxTurns'] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
						}`}
					/>
					{errors['api.maxTurns'] && <p className='mt-1 text-sm text-red-500'>{errors['api.maxTurns']}</p>}
				</div>

				<div className='flex justify-end'>
					<button
						type='submit'
						className='px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded'
					>
						Save Changes
					</button>
				</div>
			</form>

			<ConfirmDialog
				isOpen={showRestartConfirm}
				title='Restart Server'
				message='The Server needs to be restarted to apply these changes. Any ongoing conversations will be interrupted. Do you want to restart now?'
				onConfirm={handleRestartConfirm}
				onCancel={() => setShowRestartConfirm(false)}
			/>
		</div>
	);
}
