/**
 * Utility function to determine whether running the DUI (tauri) or BUI (browser) environment.
 *
 * Webview in DUI should have `platform` injected into URL.
 *
 * @param forUrl Optional - The URL to check for platform
 * @returns boolean
 */

export function isDuiEnvironment(forUrl?: string): boolean {
	// Check if running in a Tauri environment using multiple detection methods
	const hasTauriGlobals = typeof (globalThis as any).__TAURI_INTERNALS__ !== 'undefined';
	//	|| typeof (globalThis as any).__TAURI__ !== 'undefined'
	//	|| typeof (globalThis as any).__TAURI_IPC__ !== 'undefined';
	const url = forUrl ? new URL(forUrl) : globalThis.location;
	const searchParams = new URLSearchParams(url.search || '');
	const hasTauriPlatform = url && (
		url.hash.includes('platform=dui') ||
		url.hash.includes('platform=tauri') ||
		searchParams.get('platform') === 'dui' ||
		searchParams.get('platform') === 'tauri'
	);
	//console.log('[DOWNLOAD HELPER] isDuiEnvironment', {
	//	hasTauriGlobals,
	//	hasTauriPlatform,
	//	location: globalThis.location,
	//	forUrl,
	//}
	//);

	// Check if running in a DUI environment using the platform parameter method
	return (hasTauriGlobals || hasTauriPlatform);
}

/**
 * Check if the current environment is the BUI (Browser User Interface)
 *
 * @returns {boolean} true if running in browser environment, false otherwise
 */
export function isBuiEnvironment(): boolean {
	// Must have globalThis object and NOT be in Tauri
	return typeof globalThis !== 'undefined' && !isDuiEnvironment();
}

/**
 * Get environment-specific OAuth window dimensions
 *
 * @returns {object} Window dimensions for OAuth flow
 */
export function getOAuthWindowDimensions() {
	return isDuiEnvironment()
		? { width: 500, height: 650 } // Native window dimensions
		: { width: 500, height: 600 }; // Popup dimensions
}

/**
 * Get environment-specific OAuth redirect URI path
 *
 * @returns {string} OAuth callback path for current environment
 */
export function getOAuthCallbackPath(): string {
	return '/oauth/google/callback';
	// pass `isDui` as part of state instead
	//return isDuiEnvironment()
	//	? '/oauth/google/callback/tauri' // Tauri-specific callback
	//	: '/oauth/google/callback'; // Standard BUI callback
}
