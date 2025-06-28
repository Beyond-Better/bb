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
  console.log('[VersionUpgradePrompt] Version state:', versionState);
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
      const serverUpdateNeeded = !versionCompatibility.compatible || versionCompatibility.updateAvailable;
      const duiUpdateNeeded = duiUpdateInfo !== null && duiUpdateInfo !== undefined;
      
      if (serverUpdateNeeded && duiUpdateNeeded) {
        console.log('[VersionUpgradePrompt] Performing atomic update (server + DUI)');
        await invoke('perform_atomic_update');
      } else if (serverUpdateNeeded) {
        console.log('[VersionUpgradePrompt] Performing server-only upgrade');
        await invoke('perform_upgrade');
      } else if (duiUpdateNeeded) {
        console.log('[VersionUpgradePrompt] Performing DUI-only update');
        await invoke('perform_dui_update_only');
      } else {
        throw new Error('No updates available');
      }
      
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

  const { versionInfo, versionCompatibility, duiUpdateInfo } = versionState.value;

  // Loading state
  console.log('[VersionUpgradePrompt] Checking updates:', isCheckingUpdates);
  if (isCheckingUpdates) {
    return null;
  }

  // Wait for data
  console.log('[VersionUpgradePrompt] Version info:', versionInfo);
  console.log('[VersionUpgradePrompt] Version compatibility:', versionCompatibility);
  if (!versionInfo || !versionCompatibility) {
    return null;
  }

  const renderProgressBar = () => {
    const { stage, progress, message } = upgradeState.progress;
    
    const getStageText = (stage: string) => {
      switch (stage) {
        case 'idle': return '';
        case 'preparing': return 'Preparing';
        case 'downloading': return 'Downloading';
        case 'installing': return 'Installing';
        case 'backup': return 'Creating Backup';
        case 'upgrading-server': return 'Updating Server';
        case 'checking-dui': return 'Checking DUI Updates';
        case 'downloading-dui': return 'Downloading DUI Update';
        case 'installing-dui': return 'Installing DUI Update';
        case 'complete': return 'Complete';
        default: return stage.charAt(0).toUpperCase() + stage.slice(1);
      }
    };
    
    const stageText = getStageText(stage);
    
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

  // Not installed (null or undefined binaryVersion)
  console.log('[VersionUpgradePrompt] Binary version:', versionInfo.binaryVersion);
  if (versionInfo.binaryVersion === null || versionInfo.binaryVersion === undefined) {
    console.log('[VersionUpgradePrompt] Showing installation prompt');
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

  // Check if any updates are available (server or DUI)
  const serverUpdateAvailable = !versionCompatibility.compatible || versionCompatibility.updateAvailable;
  const duiUpdateAvailable = duiUpdateInfo !== null && duiUpdateInfo !== undefined;
  
  if (serverUpdateAvailable || duiUpdateAvailable) {
    const hasBreakingChanges = versionCompatibility.hasBreakingChanges;
    const criticalNotice = versionCompatibility.criticalNotice;
    const releaseNotes = versionCompatibility.releaseNotes;
    
    // Use red/warning colors for breaking changes, blue for regular updates
    const colorScheme = hasBreakingChanges ? {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-700',
      icon: 'text-red-400',
      title: 'text-red-800 dark:text-red-200',
      text: 'text-red-700 dark:text-red-300',
      button: 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600'
    } : {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-700',
      icon: 'text-blue-400',
      title: 'text-blue-800 dark:text-blue-200',
      text: 'text-blue-700 dark:text-blue-300',
      button: 'bg-blue-600 hover:bg-blue-500 focus-visible:outline-blue-600'
    };
    
    return (
      <div className={`${colorScheme.bg} border ${colorScheme.border} rounded-lg p-4 mb-4`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {hasBreakingChanges ? (
              <svg className={`h-5 w-5 ${colorScheme.icon}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className={`h-5 w-5 ${colorScheme.icon}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${colorScheme.title}`}>
              {hasBreakingChanges ? 'Critical Update Required' : (!versionCompatibility.compatible ? 'Update Required' : (duiUpdateAvailable && serverUpdateAvailable ? 'Updates Available' : (duiUpdateAvailable ? 'DUI Update Available' : 'Server Update Available')))}
            </h3>
            
            {/* Critical Notice */}
            {criticalNotice && (
              <div className={`mt-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700`}>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {criticalNotice}
                </p>
              </div>
            )}
            
            <div className={`mt-2 text-sm ${colorScheme.text}`}>
              {serverUpdateAvailable && (
                <p>
                  {!versionCompatibility.compatible
                    ? `BB Server version ${versionCompatibility.requiredVersion} or higher is required. ${hasBreakingChanges ? 'This update contains breaking changes.' : ''}`
                    : `A new version of BB Server is available (${versionCompatibility.latestVersion}). ${hasBreakingChanges ? 'This update contains breaking changes.' : ''}`}
                </p>
              )}
              {duiUpdateAvailable && (
                <p className={serverUpdateAvailable ? 'mt-2' : ''}>
                  A new version of the DUI application is available (v{duiUpdateInfo?.version}).
                  {duiUpdateAvailable && serverUpdateAvailable && ' Both updates will be installed together.'}
                </p>
              )}
              
              {/* Release Notes */}
              {(releaseNotes || duiUpdateInfo?.body) && (
                <div className="mt-3 space-y-2">
                  {releaseNotes && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium hover:underline">
                        View Server Release Notes
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <pre className="text-xs whitespace-pre-wrap font-mono">{releaseNotes}</pre>
                      </div>
                    </details>
                  )}
                  {duiUpdateInfo?.body && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium hover:underline">
                        View DUI Release Notes
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <pre className="text-xs whitespace-pre-wrap font-mono">{duiUpdateInfo.body}</pre>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={upgradeState.isInstalling}
                className={`inline-flex items-center rounded-md ${colorScheme.button} px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50`}
              >
                {upgradeState.isInstalling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {duiUpdateAvailable && serverUpdateAvailable ? 'Updating All Components...' : (duiUpdateAvailable ? 'Updating DUI...' : 'Updating Server...')}
                  </>
                ) : (
                  hasBreakingChanges ? 'Update with Caution' : (duiUpdateAvailable && serverUpdateAvailable ? 'Update All Components' : (duiUpdateAvailable ? 'Update DUI' : 'Update Server'))
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