import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { setDebugMode as setProxyDebugMode } from '../../utils/proxy';
import { GlobalConfigValues } from '../../types/settings';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { useDebugMode } from '../../providers/DebugModeProvider';

const defaultConfig: GlobalConfigValues = {
	'api.tls.useTls': false,
	'api.localMode': false,
	'api.llmProviders.anthropic.apiKey': '',
	'bui.tls.useTls': false,
	'bui.localMode': false,
};

export function Settings(): JSX.Element {
	const [config, setConfig] = useState<GlobalConfigValues>(defaultConfig);
	const { debugMode, setDebugMode } = useDebugMode();
	const [originalConfig, setOriginalConfig] = useState<GlobalConfigValues>(defaultConfig);
	const [showRestartConfirm, setShowRestartConfirm] = useState(false);
	const [errors, setErrors] = useState<Partial<Record<keyof GlobalConfigValues, string>>>({});

	useEffect(() => {
		loadConfig();
	}, []);

	const loadConfig = async () => {
		console.log('Loading config...');
		try {
			const rustConfig = await invoke<RustGlobalConfig>('get_global_config');

			const configValues: GlobalConfigValues = {
				'api.tls.useTls': rustConfig.api?.tls?.useTls ?? false,
				'api.localMode': rustConfig.api?.localMode ?? false,
				'api.llmProviders.anthropic.apiKey': rustConfig.api?.llmProviders?.anthropic?.apiKey ?? '',
				'bui.tls.useTls': rustConfig.bui?.tls?.useTls ?? false,
				'bui.localMode': rustConfig.bui?.localMode ?? false,
			};

			setConfig(configValues);
			setOriginalConfig(configValues);
		} catch (error) {
			console.error('Failed to load config:', error);
		}
	};

	const validateForm = (): boolean => {
		const newErrors: Partial<Record<keyof GlobalConfigValues, string>> = {};

		const apiKey = config['api.llmProviders.anthropic.apiKey'].trim();
		// Only validate if the key is being changed (not masked)
		if (apiKey && !apiKey.endsWith('...') && (!apiKey.startsWith('sk-ant-api03-') || apiKey.length < 48)) {
			newErrors['api.llmProviders.anthropic.apiKey'] = 'Invalid Anthropic API key format';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleInputChange = (key: keyof GlobalConfigValues, value: string | number | boolean) => {
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

			if (config['api.tls.useTls'] !== originalConfig['api.tls.useTls']) {
				console.log('Updating api.tls.useTls:', config['api.tls.useTls']);
				updates.push(['api.tls.useTls', config['api.tls.useTls'].toString()]);
			}
			if (config['api.localMode'] !== originalConfig['api.localMode']) {
				console.log('Updating api.localMode:', config['api.localMode']);
				updates.push(['api.localMode', config['api.localMode'].toString()]);
			}
			const apiKey = config['api.llmProviders.anthropic.apiKey'];
			const originalApiKey = originalConfig['api.llmProviders.anthropic.apiKey'];
			if (apiKey !== originalApiKey && !apiKey.endsWith('...')) {
				console.log('Updating API key');
				updates.push(['api.llmProviders.anthropic.apiKey', apiKey]);
				console.log('Updates array:', updates);
			}


			if (config['bui.tls.useTls'] !== originalConfig['bui.tls.useTls']) {
				console.log('Updating bui.tls.useTls:', config['bui.tls.useTls']);
				updates.push(['bui.tls.useTls', config['bui.tls.useTls'].toString()]);
			}
			if (config['bui.localMode'] !== originalConfig['bui.localMode']) {
				console.log('Updating bui.localMode:', config['bui.localMode']);
				updates.push(['bui.localMode', config['bui.localMode'].toString()]);
			}

			console.log(
				'Saving updates:',
				updates.map(([key, value]) => [
					key,
					key.includes('apiKey') ? '[REDACTED]' : value,
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
		setDebugMode(false);
		setErrors({});
	};

	const handleRestartConfirm = async () => {
		try {
			// Stop API/BUI first
			await invoke('stop_api');
			await invoke('stop_bui');

			// Handle proxy server based on TLS setting
			if (config['api.tls.useTls']) {
				try {
					await invoke('stop_proxy_server');
					console.debug('Proxy server stopped after TLS enabled');
				} catch (err) {
					console.error('Failed to stop proxy server:', err);
				}
			}

			// Start API
			await invoke('start_api');
			await invoke('start_bui');

			// If TLS is disabled, ensure proxy is started
			if (!config['api.tls.useTls']) {
				try {
					await invoke('start_proxy_server');
					console.debug('Proxy server started after TLS disabled');
				} catch (err) {
					console.error('Failed to start proxy server:', err);
				}
			}

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
				{/* API Settings Section */}
				<div className='space-y-4'>
					<h3 className='text-lg font-semibold dark:text-white'>API Settings</h3>
					<div className='grid grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
								<input
									type='checkbox'
									checked={config['api.tls.useTls']}
									onChange={(e) => handleInputChange('api.tls.useTls', e.currentTarget.checked)}
									className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-2'
								/>
								Use TLS
								<span className='block ml-6 text-sm font-normal text-gray-600 dark:text-gray-400'>
									Enable TLS for secure connections
								</span>
							</label>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
								<input
									type='checkbox'
									checked={config['api.localMode']}
									onChange={(e) => handleInputChange('api.localMode', e.currentTarget.checked)}
									className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-2'
								/>
								Local Mode
								<span className='block ml-6 text-sm font-normal text-gray-600 dark:text-gray-400'>
									Use local mode to disable LLM cloud proxy
								</span>
							</label>
						</div>

						{config['api.localMode'] && (
							<div className='col-span-2'>
								<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
									Anthropic API Key
									<input
										type='text'
										value={config['api.llmProviders.anthropic.apiKey']}
										onChange={(e) => handleInputChange('api.llmProviders.anthropic.apiKey', e.currentTarget.value)}
										className={`mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border ${
								errors['api.llmProviders.anthropic.apiKey']
									? 'border-red-500'
									: 'border-gray-300 dark:border-gray-600'
							} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
										placeholder='Enter your Anthropic API key'
									/>
								</label>
							</div>
						)}
					</div>
				</div>

				{/* BUI Settings Section */}
				<div className='space-y-4'>
					<h3 className='text-lg font-semibold dark:text-white'>BUI Settings</h3>
					<div className='grid grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
								<input
									type='checkbox'
									checked={config['bui.tls.useTls']}
									onChange={(e) => handleInputChange('bui.tls.useTls', e.currentTarget.checked)}
									className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-2'
								/>
								Use TLS
								<span className='block ml-6 text-sm font-normal text-gray-600 dark:text-gray-400'>
									Enable TLS for secure connections
								</span>
							</label>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
								<input
									type='checkbox'
									checked={config['bui.localMode']}
									onChange={(e) => handleInputChange('bui.localMode', e.currentTarget.checked)}
									className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-2'
								/>
								Local Mode
								<span className='block ml-6 text-sm font-normal text-gray-600 dark:text-gray-400'>
									Use local mode to disable user auth
								</span>
							</label>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
								<input
									type='checkbox'
									checked={debugMode}
									onChange={async (e) => {
										setDebugMode(e.currentTarget.checked);
										try {
											await setProxyDebugMode(e.currentTarget.checked);
											console.debug('Debug mode set successfully');
										} catch (err) {
											console.error('Failed to set debug mode:', err);
										}
									}}
									className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mr-2'
								/>
								Local Proxy Mode
								<span className='block ml-6 text-sm font-normal text-gray-600 dark:text-gray-400'>
									Use localhost for development
								</span>
							</label>
						</div>
					</div>
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