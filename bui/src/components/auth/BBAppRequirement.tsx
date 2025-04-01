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
			<div class='text-sm text-gray-600 dark:text-gray-400'>
				<h3 class='font-medium text-gray-900 dark:text-white mb-2'>
					BB Desktop App Required
				</h3>
				<p>
					BB requires the desktop app or API to be running locally. This provides secure access to BB's
					features and capabilities.
				</p>
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
								toastMessage="Downloading BB App"
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
