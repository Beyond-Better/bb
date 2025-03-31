/**
 * Utility function to generate appropriate download URLs based on the environment.
 *
 * In a Tauri environment, it converts URLs to use the custom bbdownload:// protocol
 * which will be handled by the system's default browser.
 * In a regular browser environment, it returns the original URL.
 *
 * @param originalUrl The original URL to the downloadable resource
 * @returns URL formatted appropriately for the current environment
 */
export function generateDownloadUrl(originalUrl: string): string {
	// Check if running in a Tauri environment using multiple detection methods
	const hasTauriGlobals = typeof globalThis.__TAURI__ !== 'undefined' ||
		typeof globalThis.__TAURI_INVOKE__ !== 'undefined' ||
		typeof globalThis.__TAURI_IPC__ !== 'undefined';

	// Check for platform parameter (most reliable method)
	//const hasPlatformParam = new URLSearchParams(globalThis.location.search).get('platform') === 'tauri';
	const hasPlatformParam = globalThis.location.hash.includes('platform=tauri');

	// Use either detection method
	const isTauriEnvironment = hasTauriGlobals || hasPlatformParam;

	console.log('[DOWNLOAD HELPER] Environment detection:', {
		__TAURI__: typeof globalThis.__TAURI__ !== 'undefined',
		__TAURI_INVOKE__: typeof globalThis.__TAURI_INVOKE__ !== 'undefined',
		__TAURI_IPC__: typeof globalThis.__TAURI_IPC__ !== 'undefined',
		platformParam: hasPlatformParam,
		isTauriEnvironment: isTauriEnvironment,
		windowLocation: globalThis.location,
	});

	if (isTauriEnvironment) {
		// In Tauri, use our custom protocol to handle downloads via system browser
		console.log('[DOWNLOAD HELPER] Running in Tauri environment, using custom protocol');
		// Ensure the URL is properly encoded
		const encodedUrl = encodeURI(originalUrl);
		console.log('[DOWNLOAD HELPER] Encoded URL for bbdownload:', encodedUrl);
		return `bbdownload://${encodedUrl}`;
	} else {
		// In regular browser, use the original URL
		console.log('[DOWNLOAD HELPER] Running in browser environment, using original URL');
		return originalUrl;
	}
}

/**
 * Creates a modified <a> element href attribute value for downloads.
 * Use this function when setting the href attribute in JSX or templates.
 *
 * @example
 * // React JSX
 * <a href={getDownloadHref('https://example.com/file.zip')} download>Download</a>
 *
 * // HTML template
 * <a href="${getDownloadHref('https://example.com/file.zip')}" download>Download</a>
 *
 * @param originalUrl The original URL to the downloadable resource
 * @returns URL formatted appropriately for the current environment
 */
export function getDownloadHref(originalUrl: string): string {
	return generateDownloadUrl(originalUrl);
}

/**
 * Creates an onClick handler for download links that won't navigate away from the page.
 * This is the recommended approach for Tauri environments.
 *
 * @example
 * // React JSX
 * <a href="#" onClick={getDownloadClickHandler('https://example.com/file.zip')} download>
 *   Download
 * </a>
 *
 * @param originalUrl The original URL to the downloadable resource
 * @returns A function that handles the click event and prevents page navigation
 */
export function getDownloadClickHandler(originalUrl: string): (event: React.MouseEvent) => void {
	return (event: React.MouseEvent) => {
		event.preventDefault();

		const url = generateDownloadUrl(originalUrl);

		// Detect Tauri environment
		const hasTauriGlobals = typeof globalThis.__TAURI__ !== 'undefined' ||
			typeof globalThis.__TAURI_INVOKE__ !== 'undefined' ||
			typeof globalThis.__TAURI_IPC__ !== 'undefined';
		const hasPlatformParam = new URLSearchParams(globalThis.location.search).get('platform') === 'tauri';
		const isTauriEnvironment = hasTauriGlobals || hasPlatformParam;

		if (isTauriEnvironment) {
			// For Tauri, open in new window but don't redirect the current page
			// This opens in system browser without affecting the current page
			globalThis.open(originalUrl, '_blank');

			// Show a toast message (if you have a toast system)
			if (typeof globalThis.showToast === 'function') {
				globalThis.showToast({
					message: 'Download started in your default browser',
					type: 'info',
					duration: 3000,
				});
			} else {
				console.log('[DOWNLOAD HELPER] Download started in system browser');
			}
		} else {
			// For regular browsers, standard download behavior
			globalThis.location.href = url;
		}
	};
}

/**
 * Type declaration for the Tauri object injected into the window
 * This helps TypeScript recognize the global properties we're using
 */
declare global {
	interface Window {
		__TAURI__?: unknown;
		__TAURI_INVOKE__?: unknown;
		__TAURI_IPC__?: unknown;
		// Optional toast function that may be available in your app
		showToast?: (options: { message: string; type: string; duration: number }) => void;
	}
}

// Add React mouse event type if React isn't imported
type ReactMouseEvent = {
	preventDefault: () => void;
};
