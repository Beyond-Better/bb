import { IS_BROWSER } from '$fresh/runtime.ts';

// Local storage keys
const STORAGE_KEYS = {
	API_HOSTNAME: 'bb_api_hostname',
	API_PORT: 'bb_api_port',
	API_USE_TLS: 'bb_api_use_tls',
};

// Helper functions for URL parameters
export const getHashParams = () => {
	if (!IS_BROWSER) return null;
	const hash = window.location.hash.slice(1);
	return new URLSearchParams(hash);
};

export const getQueryParams = () => {
	if (!IS_BROWSER) return null;
	return new URLSearchParams(window.location.search);
};

export const getUrlParams = () => {
	// For backward compatibility, return hash params
	return getHashParams();
};

// Storage helper functions
const getFromStorage = (key: string): string | null => {
	if (!IS_BROWSER) return null;
	return localStorage.getItem(key);
};

const setInStorage = (key: string, value: string) => {
	if (!IS_BROWSER) return;
	localStorage.setItem(key, value);
};

export const getApiHostname = () => {
	const params = getUrlParams();
	const urlValue = params?.get('apiHostname');

	if (urlValue) {
		// Update storage if URL param exists
		setInStorage(STORAGE_KEYS.API_HOSTNAME, urlValue);
		return urlValue;
	}

	// Fall back to storage or default
	return getFromStorage(STORAGE_KEYS.API_HOSTNAME) || 'localhost';
};

export const getApiPort = () => {
	const params = getUrlParams();
	const urlValue = params?.get('apiPort');

	if (urlValue) {
		// Update storage if URL param exists
		setInStorage(STORAGE_KEYS.API_PORT, urlValue);
		return urlValue;
	}

	// Fall back to storage or default
	return getFromStorage(STORAGE_KEYS.API_PORT) || '3162';
};

export const getApiUseTls = () => {
	const params = getUrlParams();
	const urlValue = params?.get('apiUseTls');
	//console.log('getApiUseTls: ', { urlValue });

	if (urlValue !== null && urlValue !== undefined) {
		// Update storage if URL param exists
		setInStorage(STORAGE_KEYS.API_USE_TLS, urlValue);
		return urlValue === 'true';
	}

	// Fall back to storage or default
	const storedValue = getFromStorage(STORAGE_KEYS.API_USE_TLS);
	return storedValue !== null ? storedValue === 'true' : false;
};

export const getApiUrl = (hostname: string, port: string, useTls: boolean): string => {
	return `${useTls ? 'https' : 'http'}://${hostname}:${port}`;
};

export const getWsUrl = (hostname: string, port: string, useTls: boolean): string => {
	return `${useTls ? 'wss' : 'ws'}://${hostname}:${port}/api/v1/ws`;
};
