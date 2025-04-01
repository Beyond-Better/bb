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
	// Check if running in a Tauri environment using the platform parameter method
	const isTauriEnvironment = globalThis.location.hash.includes('platform=tauri');

	// For debugging only - don't actually use these values in the detection
	// const hasTauriGlobalsDebug = false; // Avoid TypeScript errors by not directly checking
	// console.log('[DOWNLOAD HELPER] Environment detection:', {
	// 	platformParam: globalThis.location.hash.includes('platform=tauri'),
	// 	isTauriEnvironment: isTauriEnvironment,
	// 	windowLocation: globalThis.location.toString(),
	// 	locationHash: globalThis.location.hash,
	// });

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
export function getDownloadClickHandler(originalUrl: string): (event: MouseEvent) => void {
	return (event: MouseEvent) => {
		event.preventDefault();

		// Detect Tauri environment using the platform parameter
		const isTauriEnvironment = globalThis.location.hash.includes('platform=tauri');

		const url = generateDownloadUrl(originalUrl);
		if (isTauriEnvironment) {
			console.log('[DOWNLOAD HELPER] opening URL', url);
			// For Tauri, open in new window but don't redirect the current page
			// This opens in system browser without affecting the current page
			window.open(url, '_blank');

			// Show a toast message if available
			showToast({
				message: 'Download started in your default browser',
				type: 'info',
				duration: 3000,
			});
		} else {
			// For regular browsers, standard download behavior
			globalThis.location.href = originalUrl;
		}
	};
}

/**
 * Simple interface for our mouse event handlers
 * This avoids requiring React imports
 */
interface MouseEvent {
	preventDefault: () => void;
}

export interface ToastOptions {
	message: string;
	type: string;
	duration: number;
}

export function showToast(options: ToastOptions): void {
	const globalShowToast = (globalThis as any)['showToast'];
	if (typeof globalShowToast === 'function') {
		globalShowToast(options);
	} else {
		console.log(`[TOAST] ${options.type}: ${options.message}`);
	}
}

///**
// * Type declarations for global objects used in the download helper
// * This makes TypeScript aware of these custom properties
// */
//declare global {
//	// Add the same properties to globalThis
//	interface globalThis {
//		showToast?: (options: { message: string; type: string; duration: number }) => void;
//	}
//}
