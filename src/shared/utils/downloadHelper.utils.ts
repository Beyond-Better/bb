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
	// This avoids TypeScript errors from accessing __TAURI__ globals
	const isTauriEnvironment = window.location.hash.includes('platform=tauri');
	
	// For debugging only - don't actually use these values in the detection
	const hasTauriGlobalsDebug = false; // Avoid TypeScript errors by not directly checking

	console.log('[DOWNLOAD HELPER] Environment detection:', {
		platformParam: window.location.hash.includes('platform=tauri'),
		isTauriEnvironment: isTauriEnvironment,
		windowLocation: window.location.toString(),
		locationHash: window.location.hash
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
export function getDownloadClickHandler(originalUrl: string): (event: MouseEvent) => void {
	return (event: MouseEvent) => {
		event.preventDefault();

		const url = generateDownloadUrl(originalUrl);

		// Detect Tauri environment using the platform parameter
		const isTauriEnvironment = window.location.hash.includes('platform=tauri');

		if (isTauriEnvironment) {
			// For Tauri, open in new window but don't redirect the current page
			// This opens in system browser without affecting the current page
			window.open(originalUrl, '_blank');

			// Show a toast message if available (using a safe type check)
			const showToastFn = window['showToast']; // Access as indexed property to satisfy TypeScript
			if (typeof showToastFn === 'function') {
				showToastFn({
					message: 'Download started in your default browser',
					type: 'info',
					duration: 3000,
				});
			} else {
				console.log('[DOWNLOAD HELPER] Download started in system browser');
			}
		} else {
			// For regular browsers, standard download behavior
			window.location.href = url;
		}
	};
}

/**
 * Type declarations for global objects used in the download helper
 * This makes TypeScript aware of these custom properties
 */
declare global {
	interface Window {
		__TAURI__?: unknown;
		__TAURI_INVOKE__?: unknown;
		__TAURI_IPC__?: unknown;
		showToast?: (options: { message: string; type: string; duration: number }) => void;
	}
	
	// Add the same properties to globalThis
	interface globalThis {
		__TAURI__?: unknown;
		__TAURI_INVOKE__?: unknown;
		__TAURI_IPC__?: unknown;
		showToast?: (options: { message: string; type: string; duration: number }) => void;
	}
}

// Simple interface for our mouse event handlers
interface MouseEvent {
	preventDefault: () => void;
}
