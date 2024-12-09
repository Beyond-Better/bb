import { JSX } from 'preact';
import type { VersionInfo as VersionInfoType } from '../../types/version';

interface VersionInfoProps {
  versionInfo: VersionInfoType;
  className?: string;
}

export function VersionInfo({ versionInfo, className = '' }: VersionInfoProps): JSX.Element {
  const { version, installLocation, canAutoUpdate } = versionInfo;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className='flex items-center justify-between'>
        <span className='text-gray-600 dark:text-gray-400'>Version</span>
        <span className='font-medium dark:text-gray-200'>{version}</span>
      </div>

      <div className='flex items-center justify-between'>
        <span className='text-gray-600 dark:text-gray-400'>Installation</span>
        <span className='font-medium capitalize dark:text-gray-200'>{installLocation}</span>
      </div>

      <div className='flex items-center justify-between'>
        <span className='text-gray-600 dark:text-gray-400'>Auto-update</span>
        <span className={`font-medium ${canAutoUpdate ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {canAutoUpdate ? 'Available' : 'Not available'}
        </span>
      </div>
    </div>
  );
}

interface CompactVersionProps {
  version: string;
  className?: string;
}

export function CompactVersion({ version, className = '' }: CompactVersionProps): JSX.Element {
  return (
    <span className={`text-xs text-gray-500 dark:text-gray-400 ${className}`}>
      v{version}
    </span>
  );
}