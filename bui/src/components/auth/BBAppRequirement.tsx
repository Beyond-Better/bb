import { JSX } from 'preact';
import { useComputed, useSignal } from '@preact/signals';
import { getBBAppAssetName } from '../../utils/platform.utils.ts';
import { fetchLatestRelease } from '../../utils/upgrade.utils.ts';
import { ExternalLink } from '../ExternalLink.tsx';

export function BBAppRequirement(): JSX.Element {
	const downloadUrl = useSignal('');
	const releaseUrl = useSignal('');
	const version = useSignal('');
	const error = useSignal<string | undefined>(undefined);
	const isLoading = useSignal(true);

	// Fetch download info on mount
	if (typeof window !== 'undefined') {
		fetchDownloadInfo().catch(console.error);
	}

	async function fetchDownloadInfo() {
		try {
			const release = await fetchLatestRelease();
			version.value = release.tag_name.replace(/^v/, '');

			const assetName = getBBAppAssetName(version.value);
			const asset = release.assets.find((a) => a.name === assetName);

			if (!asset) {
				throw new Error('No compatible BB app version found for your system');
			}

			downloadUrl.value = asset.browser_download_url;
			releaseUrl.value = release.html_url;
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Failed to fetch download info';
			console.error('BBAppRequirement: Failed to fetch download info:', e);
		} finally {
			isLoading.value = false;
		}
	}

	return (
		<div class='mt-6 space-y-4'>
			<div class='p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md'>
				<div class='flex items-start'>
					<div class='flex-shrink-0'>
						<svg class='h-5 w-5 text-yellow-600 dark:text-yellow-400' fill='currentColor' viewBox='0 0 20 20'>
							<path fillRule='evenodd' d='M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z' clipRule='evenodd' />
						</svg>
					</div>
					<div class='ml-3'>
						<h3 class='text-sm font-bold text-yellow-800 dark:text-yellow-200'>
							⚠️ CRITICAL REQUIREMENT: BB Desktop App Must Be Installed & Running
						</h3>
						<p class='mt-2 text-sm text-yellow-700 dark:text-yellow-300'>
							The BB Desktop App is <strong>absolutely required</strong> - not optional. Without it running, 
							you cannot sign in, sign up, or use any BB features. Download and install it first.
						</p>
					</div>
				</div>
			</div>

			{error.value
				? <p class='text-sm text-red-600 dark:text-red-400'>{error.value}</p>
				: isLoading.value
				? (
					<div class='flex justify-center py-4'>
						<div class='animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600' />
					</div>
				)
				: (
					<div class='space-y-3'>
						<div class='flex flex-col gap-2'>
							<ExternalLink
								href={downloadUrl.value}
								class='inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
								download
								toastMessage='Downloading BB App'
							>
								Download BB App v{version.value}
							</ExternalLink>
							<ExternalLink
								href={releaseUrl.value}
								class='text-sm text-purple-600 hover:text-purple-500'
							>
								View release on GitHub →
							</ExternalLink>
						</div>
					</div>
				)}
		</div>
	);
}
