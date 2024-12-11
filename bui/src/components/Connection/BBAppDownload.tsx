import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { AnimatedNotification } from '../AnimatedNotification.tsx';
import { getBBAppAssetName, getSecurityInstructions } from '../../utils/platform.utils.ts';
import { fetchLatestRelease } from '../../utils/upgrade.utils.ts';

interface BBAppDownloadProps {
	isCollapsed: boolean;
	className?: string;
	onClose?: () => void;
}

export function BBAppDownload({ isCollapsed, className = '', onClose }: BBAppDownloadProps): JSX.Element {
	const [showDownload, setShowDownload] = useState(false);
	const [downloadUrl, setDownloadUrl] = useState<string>('');
	const [releaseUrl, setReleaseUrl] = useState<string>('');
	const [version, setVersion] = useState<string>('');
	const [error, setError] = useState<string>();

	// Wait 2 seconds before showing download prompt
	useEffect(() => {
		const timer = setTimeout(() => {
			setShowDownload(true);
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
			const version = release.tag_name.replace(/^v/, '');
			setVersion(version);

			const assetName = getBBAppAssetName(version);
			console.log('BBAppDownload: Looking for asset:', { assetName });
			const asset = release.assets.find((a) => a.name === assetName);
			console.log('BBAppDownload: Found asset:', { asset });

			if (!asset) {
				console.error('BBAppDownload: No matching asset found for:', {
					assetName,
					availableAssets: release.assets.map((a) => a.name),
				});
				throw new Error('No compatible BB app version found for your system');
			}

			setDownloadUrl(asset.browser_download_url);
			setReleaseUrl(release.html_url);
		} catch (e) {
			setError((e as Error).message);
			console.error('BBAppDownload: Failed to fetch download info:', e);
		}
	}

	if (isCollapsed || !showDownload) return <></>;

	return (
		<AnimatedNotification
			visible={true}
			type='warning'
			className={className}
		>
			<div className='space-y-4'>
				<div className='flex items-start justify-between'>
					<div>
						<h3 className='text-sm font-medium text-yellow-800'>BB Server Not Connected</h3>
						<p className='mt-1 text-sm text-yellow-700'>
							Unable to connect to BB server. Please try launching the BB app first.
						</p>
					</div>
					{/* Close button */}
					<button
						onClick={() => setShowDownload(false)}
						className='ml-4 text-yellow-700 hover:text-yellow-800'
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

				{error ? <p className='text-sm text-red-600'>{error}</p> : (
					<div className='space-y-3'>
						<div className='text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md'>
							<h4 className='font-medium mb-2'>Launch BB App</h4>
							<ol className='list-decimal list-inside space-y-1'>
								<li>Open the BB app on your computer</li>
								<li>Wait for the server to start</li>
								<li>Refresh this page</li>
							</ol>
						</div>
						<div className='border-t border-yellow-200 pt-3'>
							<p className='text-sm text-yellow-700 mb-3'>Don't have BB installed yet?</p>
							{downloadUrl ? (
								<div className='space-y-3'>
									<div className='flex flex-col gap-2'>
										<a
											href={downloadUrl}
											className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500'
											download
										>
											Download BB App v{version}
										</a>
										<a
											href={releaseUrl}
											target='_blank'
											rel='noopener noreferrer'
											className='text-sm text-yellow-700 hover:text-yellow-800'
										>
											View release on GitHub →
										</a>
									</div>

									<div className='text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md'>
										<h4 className='font-medium mb-2'>Important Security Notice</h4>
										<pre className='whitespace-pre-wrap font-mono text-xs'>
											{getSecurityInstructions()}
										</pre>
									</div>
								</div>
							) : (
								<div className='flex items-center justify-center py-4'>
									<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-700' />
								</div>
							)}
						</div>
					</div>
				)
					: (
						<div className='flex items-center justify-center py-4'>
							<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-700' />
						</div>
					)}
			</div>
		</AnimatedNotification>
	);
}
