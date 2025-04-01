import { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { AnimatedNotification } from '../AnimatedNotification.tsx';
import { getBBAppAssetName, getSecurityInstructions } from '../../utils/platform.utils.ts';
import { fetchLatestRelease } from '../../utils/upgrade.utils.ts';
import { ExternalLink } from '../ExternalLink.tsx';

const downloadUrl = signal<string>('');
const releaseUrl = signal<string>('');
const showDownload = signal(false);
const version = signal<string>('');
const error = signal<string>('');

interface BBAppDownloadProps {
	isCollapsed: boolean;
	className?: string;
	onClose?: () => void;
}

export function BBAppDownload({ isCollapsed, className = '', onClose }: BBAppDownloadProps): JSX.Element {
	// Wait 2 seconds before showing download prompt
	useEffect(() => {
		const timer = setTimeout(() => {
			showDownload.value = true;
			fetchDownloadInfo().catch(console.error);
		}, 2000);

		return () => {
			clearTimeout(timer);
			if (onClose) onClose();
		};
	}, []);

	async function fetchDownloadInfo() {
		console.log('BBAppDownload: Starting fetchDownloadInfo');
		try {
			const release = await fetchLatestRelease();
			console.log('BBAppDownload: Fetched release:', {
				tag_name: release.tag_name,
				assetCount: release.assets.length,
				assets: release.assets.map((a) => a.name),
			});
			version.value = release.tag_name.replace(/^v/, '');

			const assetName = getBBAppAssetName(version.value);
			console.log('BBAppDownload: Looking for asset:', { assetName });
			const asset = release.assets.find((a) => a.name === assetName);
			console.log('BBAppDownload: Found asset:', { asset });

			if (!asset) {
				console.error('BBAppDownload: No matching asset found for:', {
					assetName,
					availableAssets: release.assets.map((a) => a.name),
				});
				throw new Error('No compatible Beyond Better app version found for your system');
			}

			downloadUrl.value = asset.browser_download_url;
			releaseUrl.value = release.html_url;
		} catch (e) {
			error.value = (e as Error).message;
			console.error('BBAppDownload: Failed to fetch download info:', e);
		}
	}

	if (!showDownload.value) return <div></div>;

	const securityInstructions = getSecurityInstructions();

	return (
		<AnimatedNotification
			visible
			type='warning'
			className={`${className} ${isCollapsed ? 'fixed bottom-4 right-4 z-50 max-w-sm shadow-lg' : ''}`}
		>
			<div className='space-y-4'>
				<div className='flex items-start justify-between'>
					<div>
						<h3 className='text-sm font-medium text-yellow-800'>Beyond Better Server Not Connected</h3>
						<p className='mt-1 text-sm text-yellow-700 dark:text-yellow-400'>
							Unable to connect to Beyond Better server. Please try launching the Beyond Better app first.
						</p>
					</div>
					{/* Close button */}
					<button
						type='button'
						onClick={() => showDownload.value = false}
						className='ml-4 text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300'
						aria-label='Dismiss'
					>
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				{error.value ? <p className='text-sm text-red-600'>{error.value}</p> : (
					<div className='space-y-3'>
						<div className='text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-md'>
							<h4 className='font-medium mb-2'>Launch Beyond Better App</h4>
							<ol className='list-decimal list-inside space-y-1'>
								<li>Open the Beyond Better app on your computer</li>
								<li>Wait for the server to start</li>
								<li>Refresh this page</li>
							</ol>
						</div>
						<div className='border-t border-yellow-200 dark:border-yellow-800 pt-3'>
							<p className='text-sm text-yellow-700 dark:text-yellow-400 mb-3'>
								Don't have Beyond Better installed yet?
							</p>
							{downloadUrl.value
								? (
									<div className='space-y-3'>
										<div className='flex flex-col gap-2'>
											<ExternalLink
												href={downloadUrl.value}
												className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-yellow-600 dark:bg-yellow-700 hover:bg-yellow-700 dark:hover:bg-yellow-800 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500'
												download
												toastMessage="Downloading Beyond Better App"
											>
												Download Beyond Better App v{version.value}
											</ExternalLink>
											<ExternalLink
												href={releaseUrl.value}
												className='text-sm text-yellow-700 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300'
											>
												View release on GitHub →
											</ExternalLink>
										</div>

										{securityInstructions && (
											<div className='text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md'>
												<h4 className='font-medium mb-2'>Important Security Notice</h4>
												<pre className='whitespace-pre-wrap font-mono text-xs text-yellow-700 dark:text-yellow-400'>
													{securityInstructions}
												</pre>
											</div>
										)}
									</div>
								)
								: (
									<div className='flex items-center justify-center py-4'>
										<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-700' />
									</div>
								)}
						</div>
					</div>
				)}
			</div>
		</AnimatedNotification>
	);
}