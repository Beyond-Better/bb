import { IS_BROWSER } from '$fresh/runtime.ts';

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

export const getApiHostname = () => {
	// console.log('url.utils: getApiHostname called', {
	//     isBrowser: IS_BROWSER,
	//     params: getUrlParams()?.toString(),
	//     hash: IS_BROWSER ? window.location.hash : null
	// });
	const params = getUrlParams();
	return params?.get('apiHostname') || 'localhost';
};

export const getApiPort = () => {
	// console.log('url.utils: getApiPort called', {
	//     isBrowser: IS_BROWSER,
	//     params: getUrlParams()?.toString(),
	//     hash: IS_BROWSER ? window.location.hash : null
	// });
	const params = getUrlParams();
	return params?.get('apiPort') || '3162';
};

export const getApiUseTls = () => {
	// console.log('url.utils: getApiUseTls called', {
	//     isBrowser: IS_BROWSER,
	//     params: getUrlParams()?.toString(),
	//     hash: IS_BROWSER ? window.location.hash : null
	// });
	const params = getUrlParams();
	return params?.get('apiUseTls') === 'true';
};

export const getApiUrl = (hostname: string, port: string, useTls: boolean): string => {
	// console.log('url.utils: getApiUrl called', { hostname, port, useTls });
	return `${useTls ? 'https' : 'http'}://${hostname}:${port}`;
};

export const getWsUrl = (hostname: string, port: string, useTls: boolean): string => {
	// console.log('url.utils: getWsUrl called', { hostname, port, useTls });
	return `${useTls ? 'wss' : 'ws'}://${hostname}:${port}/api/v1/ws`;
};
