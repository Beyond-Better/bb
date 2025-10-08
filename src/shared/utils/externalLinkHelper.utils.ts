//import { IS_BROWSER } from '$fresh/runtime.ts';

import { isDuiEnvironment } from './environmentHelper.utils.ts';

/**
 * Utility function to generate appropriate download URLs based on the environment.
 *
 * In a DUI environment, it converts URLs to use the custom bblink:// protocol
 * which will be handled by the system's default browser.
 * In a regular browser environment, it returns the original URL.
 *
 * @param originalUrl The original URL to the downloadable resource
 * @returns URL formatted appropriately for the current environment
 */
export function generateExternalUrl(originalUrl: string): string {
	// Check if running in a DUI environment using the platform parameter method
	const isDuiEnv = isDuiEnvironment(originalUrl);

	// For debugging only - don't actually use these values in the detection
	// const hasDuiGlobalsDebug = false; // Avoid TypeScript errors by not directly checking
	// console.log('[DOWNLOAD HELPER] Environment detection:', {
	// 	isDuiEnvironment: isDuiEnv,
	// 	windowLocation: globalThis.location.toString(),
	// 	locationHash: globalThis.location.hash,
	// });

	if (isDuiEnv) {
		// In Dui, use our custom protocol to handle downloads via system browser
		//console.log('[DOWNLOAD HELPER] Running in DUI environment, using custom protocol');
		// Ensure the URL is properly encoded
		const encodedUrl = encodeURI(originalUrl);
		//console.log('[DOWNLOAD HELPER] Encoded URL for bblink:', encodedUrl);
		return `bblink://${encodedUrl}`;
	} else {
		// In regular browser, use the original URL
		//console.log('[DOWNLOAD HELPER] Running in browser environment, using original URL');
		return originalUrl;
	}
}

/**
 * Creates a modified <a> element href attribute value for downloads.
 * Use this function when setting the href attribute in JSX or templates.
 *
 * @example
 * // React JSX
 * <a href={getExternalHref('https://example.com/file.zip')} download>Download</a>
 *
 * // HTML template
 * <a href="${getExternalHref('https://example.com/file.zip')}" download>Download</a>
 *
 * @param originalUrl The original URL to the downloadable resource
 * @returns URL formatted appropriately for the current environment
 */
export function getExternalHref(originalUrl: string): string {
	return generateExternalUrl(originalUrl);
}

/**
 * Creates an onClick handler for download links that won't navigate away from the page.
 * This is the recommended approach for DUI environments.
 *
 * @example
 * // React JSX
 * <a href="#" onClick={getExternalClickHandler('https://example.com/file.zip')} download>
 *   Download
 * </a>
 *
 * @param originalUrl The original URL to the downloadable resource
 * @returns A function that handles the click event and prevents page navigation
 */
export function getExternalClickHandler(originalUrl: string, customToastMessage?: string): (event: MouseEvent) => void {
	return (event: MouseEvent) => {
		event.preventDefault();

		// Detect DUI environment
		const isDuiEnv = isDuiEnvironment();

		//const url = generateExternalUrl(originalUrl);
		if (isDuiEnv) {
			console.log('[DOWNLOAD HELPER] opening URL', originalUrl);
			// For DUI, open in new window but don't redirect the current page
			// This opens in system browser without affecting the current page
			globalThis.open(originalUrl, '_blank');

			// Show a toast message if available
			showToast({
				message: customToastMessage || 'External link opened in your default browser',
				type: 'info',
				duration: 3000,
			});
		} else {
			// For regular browsers, use standard navigation behavior
			// This allows the link to behave normally in the browser
			// which preserves back button functionality and in-page navigation
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

// declare global {
//   interface Window {
//     __TAURI_INTERNALS__?: Record<string, unknown>;
//   }
// }
