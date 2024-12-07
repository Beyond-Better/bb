import { JSX } from 'preact';
import { useVersion } from '../../hooks/useVersion';
import { CompactVersion } from './VersionInfo';
//import { VersionWarning } from './VersionWarning';

interface VersionDisplayProps {
  className?: string;
  showWarning?: boolean;
}

export function VersionDisplay({ className = '', showWarning = true }: VersionDisplayProps): JSX.Element {
  const { versionState } = useVersion();

  if (!versionState.value.versionInfo) {
    return <></>;
  }

  const versionCompatibility = versionState.value.versionCompatibility;

  return (
    <div className={`relative ${className}`}>
      <div className='flex items-center gap-2'>
        <VersionStatusIndicator />
        <div className='flex items-center gap-1'>
          <div className='flex items-center gap-1'>
            <span className='text-xs text-gray-500 dark:text-gray-400'>DUI</span>
            <CompactVersion version={versionState.value.versionInfo.version} />
          </div>
          <span className='text-xs text-gray-400 dark:text-gray-500'>|</span>
          <div className='flex items-center gap-1'>
            <span className='text-xs text-gray-500 dark:text-gray-400'>API</span>
            <span className='text-xs text-gray-500 dark:text-gray-400'>
              {(() => {
                const version = versionState.value.versionInfo.binaryVersion;
                if (version === null || version === undefined) {
                  return 'not installed';
                }
                return `v${version}`;
              })()}
            </span>
          </div>
          {versionCompatibility && (
            <>
              <span className='text-xs text-gray-400 dark:text-gray-500'>|</span>
              <div className='flex items-center gap-1'>
                <span className='text-xs text-gray-500 dark:text-gray-400'>Required</span>
                <span className='text-xs text-gray-500 dark:text-gray-400'>
                  v{versionCompatibility.requiredVersion}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      { /* showWarning && versionCompatibility && !versionCompatibility.compatible && (
        <div className='absolute top-full right-0 mt-2 w-80 z-50'>
          <VersionWarning className='shadow-lg' />
        </div>
      ) */ }
    </div>
  );
}

interface VersionStatusIndicatorProps {
  className?: string;
}

export function VersionStatusIndicator({ className = '' }: VersionStatusIndicatorProps): JSX.Element {
  const { versionState } = useVersion();
  const versionCompatibility = versionState.value.versionCompatibility;

  if (!versionCompatibility) return <></>;

  const { compatible, currentVersion } = versionCompatibility;
  const isInstalled = currentVersion !== 'not installed';

  let statusColor = 'bg-yellow-500';
  let statusTitle = 'Version mismatch';
  
  if (compatible) {
    statusColor = 'bg-green-500';
    statusTitle = 'Version compatible';
  } else if (!isInstalled) {
    statusColor = 'bg-red-500';
    statusTitle = 'BB API not installed';
  }

  return (
    <div
      className={`w-2 h-2 rounded-full ${statusColor} ${!compatible && 'animate-pulse'} ${className}`}
      title={statusTitle}
    />
  );
}