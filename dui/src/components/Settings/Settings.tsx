import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { setDebugMode as setProxyDebugMode } from '../../utils/proxy';
import { GlobalConfigValues } from '../../types/settings';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { useDebugMode } from '../../providers/DebugModeProvider';

const defaultConfig: GlobalConfigValues = {
  'api.tls.useTls': false,
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
      };

      setConfig(configValues);
      setOriginalConfig(configValues);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof GlobalConfigValues, string>> = {};
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

      console.log('Saving updates:', updates);

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
      // Stop API first
      await invoke('stop_api');

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
        <h2 className='text-2xl font-bold dark:text-white'>API Settings</h2>
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
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Use TLS
            </label>
            <div className='flex items-center h-[38px]'>
              <input
                type='checkbox'
                checked={config['api.tls.useTls']}
                onChange={(e) => handleInputChange('api.tls.useTls', e.currentTarget.checked)}
                className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
              />
              <span className='ml-2 text-sm text-gray-600 dark:text-gray-400'>
                Enable TLS for secure connections
              </span>
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
              Debug Mode
            </label>
            <div className='flex items-center h-[38px]'>
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
                className='h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
              />
              <span className='ml-2 text-sm text-gray-600 dark:text-gray-400'>
                Use localhost for development
              </span>
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