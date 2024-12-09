import { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { useVersion } from '../../hooks/useVersion';

interface VersionWarningProps {
  className?: string;
}

export function VersionWarning({ className = '' }: VersionWarningProps): JSX.Element {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string>();
  const { versionState, performUpgrade } = useVersion();

  const { versionCompatibility } = versionState.value;
  if (!versionCompatibility || versionCompatibility.compatible) return <></>;

  const { currentVersion, requiredVersion, updateAvailable, latestVersion } = versionCompatibility;

  const handleUpgrade = async () => {
    setError(undefined);
    setIsUpdating(true);
    try {
      await performUpgrade();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`rounded-md bg-yellow-50 dark:bg-yellow-900/50 p-4 ${className}`}>
      <div className='flex'>
        <div className='flex-shrink-0'>
          <svg
            className='h-5 w-5 text-yellow-400'
            viewBox='0 0 20 20'
            fill='currentColor'
            aria-hidden='true'
          >
            <path
              fillRule='evenodd'
              d='M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z'
              clipRule='evenodd'
            />
          </svg>
        </div>
        <div className='ml-3'>
          <h3 className='text-sm font-medium text-yellow-800 dark:text-yellow-200'>Version Mismatch</h3>
          <div className='mt-2 text-sm text-yellow-700 dark:text-yellow-300'>
            <p>
              The BB Server version {currentVersion === 'not installed' ? 'is not installed' : `(v${currentVersion}) is not compatible with the minimum required version (v${requiredVersion})`}.
              {currentVersion !== 'not installed' && (
                <span className='mt-1'>
                  Please upgrade your BB Server installation to continue using the DUI.
                </span>
              )}
              {updateAvailable && latestVersion && (
                <span> A new version (v{latestVersion}) is available.</span>
              )}
            </p>
          </div>
          <div className='mt-4'>
            <div className='-mx-2 -my-1.5 flex'>
              {updateAvailable ? (
                <div className='flex flex-col gap-2'>
                  <button
                    type='button'
                    className='rounded-md bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1.5 text-sm font-medium 
                      text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 
                      focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 
                      focus:ring-offset-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    onClick={handleUpgrade}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating...' : 'Update Now'}
                  </button>
                  {error && <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>}
                </div>
              ) : (
                <p className='px-2 py-1.5 text-sm text-yellow-800 dark:text-yellow-200'>
                  Please check for updates manually
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}