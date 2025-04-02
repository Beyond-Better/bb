import { JSX } from 'preact';
import { useState } from 'preact/hooks';
//import { VersionCompatibility } from 'shared/types/version.ts';
import { useVersion } from '../../hooks/useVersion.ts';
import type { ApiClient } from '../../utils/apiClient.utils.ts';
import { ExternalLink } from '../ExternalLink.tsx';

// export interface ApiUpgradeResponse {
// 	success: boolean;
// 	currentVersion: string;
// 	latestVersion: string;
// 	needsUpdate: boolean; // We just updated
// 	needsSudo: boolean;
// }

interface VersionWarningProps {
	className?: string;
	apiClient: ApiClient;
}

// export interface VersionCompatibility {
// 	compatible: boolean;
// 	currentVersion: string;
// 	requiredVersion: string;
// 	updateAvailable: boolean;
// 	latestVersion?: string;
// }

export function VersionWarning({ className = '', apiClient }: VersionWarningProps): JSX.Element {
	const [isUpdating, setIsUpdating] = useState(false);
	const [error, setError] = useState<string>();
	const { versionCompatibility } = useVersion();

	if (!apiClient) return <div></div>;

	if (!versionCompatibility) return <div></div>;

	const { compatible, currentVersion, requiredVersion, updateAvailable, latestVersion } = versionCompatibility;
	if (compatible) return <div></div>;
	// Version compatibility is now computed directly

	return (
		<div className={`rounded-md bg-yellow-50 dark:bg-yellow-900/30 p-4 ${className}`}>
			<div className='flex'>
				<div className='flex-shrink-0'>
					<svg
						className='h-5 w-5 text-yellow-400 dark:text-yellow-300'
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
					<h3 className='text-sm font-medium text-yellow-800 dark:text-yellow-300'>Version Mismatch</h3>
					<div className='mt-2 text-sm text-yellow-700 dark:text-yellow-400'>
						<p>
							The Beyond Better server version (v{currentVersion}) is not compatible with the required
							version (v{requiredVersion}).
							{updateAvailable && latestVersion && (
								<span>A new version (v{latestVersion}) is available.</span>
							)}
						</p>
					</div>
					<div className='mt-4'>
						<div className='-mx-2 -my-1.5 flex'>
							{updateAvailable
								? (
									<div className='flex flex-col gap-2'>
										{currentVersion.startsWith('0.3') || currentVersion.startsWith('0.2') ||
												currentVersion.startsWith('0.1')
											? (
												<ExternalLink
													href='https://github.com/Beyond-Better/bb/tree/main/docs/user/upgrading-bb.md'
													className='rounded-md bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1.5 text-sm font-medium text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50 text-center'
												>
													View Upgrade Guide
												</ExternalLink>
											)
											: (
												<button
													type='button'
													className='rounded-md bg-yellow-50 px-2 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed'
													onClick={async () => {
														setError(undefined);
														setIsUpdating(true);
														try {
															const result = await apiClient.upgradeApi();
															console.log('VersionWarning: upgradeApi - result', result);
														} catch (e) {
															setError((e as Error).message);
														} finally {
															setIsUpdating(false);
														}
													}}
													disabled={isUpdating}
												>
													{isUpdating ? 'Updating...' : 'Update Now'}
												</button>
											)}
										{error && <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>}
									</div>
								)
								: (
									<p className='px-2 py-1.5 text-sm text-yellow-800 dark:text-yellow-300'>
										<ExternalLink
											href='https://github.com/Beyond-Better/bb/tree/main/docs/user/upgrading-bb.md'
											className='rounded-md bg-yellow-50 px-2 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50 text-center'
										>
											View Upgrade Guide
										</ExternalLink>
									</p>
								)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
