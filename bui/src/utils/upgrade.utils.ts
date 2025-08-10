// GitHub release information types and utilities for browser environment
export interface GithubAsset {
	name: string;
	browser_download_url: string;
}

export interface GithubRelease {
	tag_name: string;
	assets: GithubAsset[];
	html_url: string;
}

/**
 * Fetches the latest release information from GitHub
 * @returns Promise<GithubRelease> Release information including assets and URLs
 * @throws Error if the fetch fails or response is invalid
 */
export async function fetchLatestRelease(): Promise<GithubRelease> {
	//console.log('upgrade.utils: Fetching latest release');
	try {
		const response = await fetch(
			'https://asyagnmzoxgyhqprdaky.storage.supabase.co/storage/v1/object/releases/latest.json',
		);
		//console.log('upgrade.utils: GitHub API response status:', response.status);

		if (!response.ok) {
			throw new Error(`Failed to fetch latest release: ${response.statusText}`);
		}

		const data = await response.json();
		//console.log('upgrade.utils: Raw GitHub response:', {
		//  tag_name: data.tag_name,
		//  html_url: data.html_url,
		//  assetCount: data?.assets?.length,
		//  assets: data?.assets?.map((a: any) => a.name)
		//});

		// Validate the response has required fields
		if (!data.tag_name || !Array.isArray(data.assets)) {
			console.error('upgrade.utils: Invalid release data:', {
				hasTagName: !!data.tag_name,
				hasAssets: Array.isArray(data.assets),
			});
			throw new Error('Invalid release data received from GitHub');
		}

		return {
			tag_name: data.tag_name,
			assets: data.assets.map((asset: any) => ({
				name: asset.name,
				browser_download_url: asset.browser_download_url,
			})),
			html_url: data.html_url,
		};
	} catch (error) {
		console.error('Error fetching latest release:', error);
		throw new Error('Failed to fetch latest BB app version. Please try again later.');
	}
}

/**
 * Gets the download URL for the current platform's BB app
 * @param version Version string (e.g., "0.5.0")
 * @param assetName Asset filename to look for
 * @returns Promise<string> Direct download URL for the asset
 * @throws Error if the asset is not found or fetch fails
 */
export async function getBBAppDownloadUrl(version: string, assetName: string): Promise<string> {
	const release = await fetchLatestRelease();
	const asset = release.assets.find((a) => a.name === assetName);

	if (!asset) {
		throw new Error(`No compatible BB app version found for your system (looked for ${assetName})`);
	}

	return asset.browser_download_url;
}
