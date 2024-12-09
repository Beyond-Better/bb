import { useContext, useEffect, useState } from 'preact/hooks';
import { JSX } from 'preact';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { VersionContext } from '../../providers/VersionProvider';
import type { InstallProgress, InstallProgressEvent } from '../../types/version';

interface UpgradeState {
  isInstalling: boolean;
  progress: InstallProgress;
  error?: string;
}

const initialProgress: InstallProgress = {
  stage: 'idle',
  progress: 0,
};

export function VersionUpgradePrompt(): JSX.Element {
  const { versionState, checkForUpdates, isCheckingUpdates } = useContext(VersionContext);
  const [upgradeState, setUpgradeState] = useState<UpgradeState>({
    isInstalling: false,
    progress: initialProgress,
  });

  // Listen for progress events from Rust
  useEffect(() => {
    const unlisten = listen<InstallProgressEvent>('install-progress', (event) => {
      setUpgradeState(prev => ({
        ...prev,
        progress: {
          stage: event.payload.stage,
          progress: event.payload.progress,
          message: event.payload.message,
        },
      }));
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleInstall = async () => {
    if (isCheckingUpdates || upgradeState.isInstalling) return;

    setUpgradeState({
      isInstalling: true,
      progress: { stage: 'preparing', progress: 0 },
    });

    try {
      await invoke('perform_install');
      await checkForUpdates();
      setUpgradeState({
        isInstalling: false,
        progress: { stage: 'complete', progress: 100 },
      });
    } catch (error) {
      console.error('[VersionUpgradePrompt] Installation failed:', error);
      setUpgradeState({
        isInstalling: false,
        progress: initialProgress,
        error: (error as Error).message,
      });
    }
  };

  const handleUpgrade = async () => {
    if (isCheckingUpdates || upgradeState.isInstalling) return;

    setUpgradeState({
      isInstalling: true,
      progress: { stage: 'preparing', progress: 0 },
    });

    try {
      await invoke('perform_upgrade');
      await checkForUpdates();
      setUpgradeState({
        isInstalling: false,
        progress: { stage: 'complete', progress: 100 },
      });
    } catch (error) {
      console.error('[VersionUpgradePrompt] Upgrade failed:', error);
      setUpgradeState({
        isInstalling: false,
        progress: initialProgress,
        error: (error as Error).message,
      });
    }
  };

  // Reset error after 5 seconds
  useEffect(() => {
    if (upgradeState.error) {
      const timer = setTimeout(() => {
        setUpgradeState(prev => ({ ...prev, error: undefined }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [upgradeState.error]);

  const { versionInfo, versionCompatibility } = versionState.value;

  // Loading state
  if (isCheckingUpdates) {
    return null;
  }

  // Wait for data
  if (!versionInfo || !versionCompatibility) {
    return null;
  }

  const renderProgressBar = () => {
    const { stage, progress, message } = upgradeState.progress;
    const stageText = stage === 'idle' ? '' : stage.charAt(0).toUpperCase() + stage.slice(1);
    
    return (
      <div className="mt-3">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>{stageText}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        {message && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        )}
      </div>
    );
  };

  // Not installed
  if (!versionInfo.binaryVersion) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              BB Server Not Installed
            </h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p>BB Server is required but not installed. Would you like to install it now?</p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleInstall}
                disabled={upgradeState.isInstalling}
                className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600 disabled:opacity-50"
              >
                {upgradeState.isInstalling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Installing...
                  </>
                ) : (
                  'Install BB Server'
                )}
              </button>
              {upgradeState.isInstalling && renderProgressBar()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Version incompatible or update available
  if (!versionCompatibility.compatible || versionCompatibility.updateAvailable) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {!versionCompatibility.compatible ? 'Update Required' : 'Update Available'}
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p>
                {!versionCompatibility.compatible
                  ? `BB Server version ${versionCompatibility.requiredVersion} or higher is required. Would you like to update now?`
                  : `A new version of BB Server is available (${versionCompatibility.latestVersion}). Would you like to update now?`}
              </p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={upgradeState.isInstalling}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
              >
                {upgradeState.isInstalling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Update BB Server'
                )}
              </button>
              {upgradeState.isInstalling && renderProgressBar()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (upgradeState.error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>{upgradeState.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Up to date - don't show anything
  return null;
}