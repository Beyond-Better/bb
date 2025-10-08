import { IS_BROWSER } from '$fresh/runtime.ts';
import { signal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { WebSocketConfigApp, WebSocketStatus } from '../types/websocket.types.ts';
import type { ProjectId } from 'shared/types.ts';
import type { SystemMeta, VersionInfo } from 'shared/types/version.ts';
//import {} from 'shared/types/version.ts';
import { createWebSocketManagerApp, type WebSocketManagerApp } from '../utils/websocketManagerApp.utils.ts';
import { type ApiClient, createApiClientManager } from '../utils/apiClient.utils.ts';
import { getApiHostname, getApiPort, getApiUseTls } from '../utils/url.utils.ts';
import { getWorkingApiUrl } from '../utils/connectionManager.utils.ts';
import type { BuiConfig } from 'shared/config/types.ts';
//import { BuiConfigDefaults } from 'shared/config/types.ts';

export interface AppState {
	systemMeta: SystemMeta | null;
	wsManager: WebSocketManagerApp | null;
	apiClient: ApiClient | null;
	status: WebSocketStatus;
	path: string | null;
	error: string | null;
	versionInfo: VersionInfo | undefined;
	projectId: ProjectId | null;
	collaborationId: string | null;
	buiConfig: BuiConfig | null;
}

// Load initial state from localStorage and URL
const loadStoredState = () => {
	let projectId = null;
	let collaborationId = null;
	let path = '/';

	if (IS_BROWSER && typeof globalThis !== 'undefined') {
		// Check URL parameters first
		const params = new URLSearchParams(globalThis.location.search);
		projectId = params.get('projectId');
		collaborationId = params.get('collaborationId');

		// If not in URL, check localStorage
		if (!projectId) {
			projectId = localStorage.getItem('bb_projectId');
		}
		if (!collaborationId) {
			collaborationId = localStorage.getItem('bb_collaborationId');
		}
		// Get current path from location
		path = globalThis.location.pathname;
	}

	return {
		projectId,
		collaborationId,
		path,
	};
};

const appState = signal<AppState>({
	systemMeta: null,
	wsManager: null,
	apiClient: null,
	status: {
		isConnecting: false,
		isReady: false,
		isLoading: false,
		error: null,
	},
	error: null,
	versionInfo: undefined,
	buiConfig: null,
	...loadStoredState(),
});

// Function to update URL parameters
const updateUrlParams = (projectId: ProjectId | null, collaborationId: string | null) => {
	if (!IS_BROWSER || typeof globalThis === 'undefined') return;

	const url = new URL(globalThis.location.href);
	if (projectId) {
		url.searchParams.set('projectId', projectId);
	} else {
		url.searchParams.delete('projectId');
	}
	if (collaborationId) {
		url.searchParams.set('collaborationId', collaborationId);
	} else {
		url.searchParams.delete('collaborationId');
	}

	globalThis.history.replaceState({}, '', url.toString());
};

// Function to update localStorage
const updateLocalStorage = (projectId: ProjectId | null, collaborationId: string | null) => {
	if (typeof localStorage === 'undefined') return;

	if (projectId) {
		localStorage.setItem('bb_projectId', projectId);
	} else {
		localStorage.removeItem('bb_projectId');
	}
	if (collaborationId) {
		localStorage.setItem('bb_collaborationId', collaborationId);
	} else {
		localStorage.removeItem('bb_collaborationId');
	}
};

export function useAppState(): Signal<AppState> {
	if (IS_BROWSER && (!appState.value.apiClient || !appState.value.wsManager)) {
		console.log('useAppState: DOING SELF INIT - only for login or error pages!!!');
		initializeAppStateAsync();
	}

	return appState;
}

/**
 * Asynchronously initialize the app state using the connection manager
 * to determine the best protocol to use.
 */
async function initializeAppStateAsync() {
	try {
		// Get connection parameters
		const { hostname, port, useTls } = {
			hostname: getApiHostname(),
			port: getApiPort(),
			useTls: getApiUseTls(),
		};

		console.log('useAppState: Getting working API URL with params:', { hostname, port, useTls });

		// Auto-detect the working protocol
		const { apiUrl, wsUrl, fallbackUsed } = await getWorkingApiUrl();

		console.log('useAppState: Connection established', {
			apiUrl,
			wsUrl,
			fallbackUsed,
			originalProtocol: useTls ? 'HTTPS/WSS' : 'HTTP/WS',
		});

		// Initialize app state with the working URLs
		initializeAppState(
			{
				wsUrl: wsUrl,
				apiUrl: apiUrl,
				onMessage: (message) => {
					console.log('useAppState: Received message:', message);
				},
				onError: (error) => {
					console.error('useAppState: WebSocket error:', error);
				},
				onClose: () => {
					console.log('useAppState: WebSocket closed');
				},
				onOpen: () => {
					console.log('useAppState: WebSocket opened');
				},
			},
		);
	} catch (error) {
		console.error('useAppState: Failed to initialize connection:', error);

		// Use default parameters as fallback
		const apiHostname = getApiHostname();
		const apiPort = getApiPort();
		const apiUseTls = getApiUseTls();
		const apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}/api/v1/ws`;

		console.warn('useAppState: Falling back to default connection parameters', {
			apiHostname,
			apiPort,
			apiUseTls,
			apiUrl,
			wsUrl,
		});

		initializeAppState({
			wsUrl: wsUrl,
			apiUrl: apiUrl,
			onMessage: (message) => {
				console.log('useAppState: Received message:', message);
			},
			onError: (error) => {
				console.error('useAppState: WebSocket error:', error);
			},
			onClose: () => {
				console.log('useAppState: WebSocket closed');
			},
			onOpen: () => {
				console.log('useAppState: WebSocket opened');
			},
		});
	}
}

export function setBuiConfig(buiConfig: BuiConfig) {
	const redactedConfig = {
		...buiConfig,
		googleOauth: {
			...buiConfig.googleOauth,
			clientSecret: '[REDACTED]',
		},
	};

	appState.value = {
		...appState.value,
		buiConfig: redactedConfig,
	};
}

export function setPath(path: string) {
	appState.value = {
		...appState.value,
		path,
	};
}

export function setProject(projectId: ProjectId | null) {
	console.log('AppState: setProject', projectId);
	appState.value = {
		...appState.value,
		projectId,
	};
	updateLocalStorage(projectId, appState.value.collaborationId);
	updateUrlParams(projectId, appState.value.collaborationId);
}

export function setCollaboration(collaborationId: string | null) {
	appState.value = {
		...appState.value,
		collaborationId,
	};
	updateLocalStorage(appState.value.projectId, collaborationId);
	updateUrlParams(appState.value.projectId, collaborationId);
}

export function initializeAppState(config: WebSocketConfigApp): void {
	console.log('useAppState: initializeAppState called', {
		hasExistingManagers: !!(appState.value.wsManager || appState.value.apiClient),
		apiUrl: config.apiUrl,
		wsUrl: config.wsUrl,
	});

	if (appState.value.wsManager || appState.value.apiClient) {
		console.log('AppState already initialized');
		return;
	}

	const wsManager = createWebSocketManagerApp({
		wsUrl: config.wsUrl,
		apiUrl: config.apiUrl,
		onMessage: (message) => {
			console.log('AppState: Received message:', message);
		},
		onError: (error) => {
			console.error('AppState: WebSocket error:', error);
			appState.value = {
				...appState.value,
				error: error.message,
			};
		},
		onClose: () => {
			console.log('AppState: WebSocket closed');
			appState.value = {
				...appState.value,
				status: {
					...appState.value.status,
					isReady: false,
					isConnecting: false,
				},
			};
		},
		onOpen: () => {
			console.log('AppState: WebSocket opened');
		},
	});

	const apiClient = createApiClientManager(config.apiUrl);

	// Load system metadata
	apiClient.getMeta().then((meta) => {
		appState.value = {
			...appState.value,
			systemMeta: meta,
		};
	}).catch((error) => {
		console.error('AppState: Failed to load system metadata:', error);
	});

	// Update state with managers
	appState.value = {
		...appState.value,
		wsManager,
		apiClient,
	};

	// Set up WebSocket event handlers
	wsManager.on('statusChange', (isConnected: boolean) => {
		appState.value = {
			...appState.value,
			status: {
				...appState.value.status,
				isConnecting: !isConnected && appState.value.status.isConnecting,
			},
		};
	});

	wsManager.on('readyChange', (isReady: boolean) => {
		appState.value = {
			...appState.value,
			status: {
				...appState.value.status,
				isReady,
			},
		};
	});

	wsManager.on('versionInfo', (versionInfo: VersionInfo) => {
		appState.value = {
			...appState.value,
			versionInfo,
		};
	});

	wsManager.on('error', (error: Error) => {
		appState.value = {
			...appState.value,
			error: error.message,
		};
	});

	wsManager.on('clearError', () => {
		appState.value = {
			...appState.value,
			error: null,
		};
	});

	// Start connection
	wsManager.connect().catch((error) => {
		console.error('AppState: Failed to connect:', error);
		appState.value = {
			...appState.value,
			error: error.message,
		};
	});
}

export function updateAppStateHandlers(handlers: {
	onMessage?: (message: unknown) => void;
	onError?: (error: Error) => void;
	onClose?: () => void;
	onOpen?: () => void;
}): void {
	const { wsManager } = appState.value;
	if (wsManager) {
		// Update only provided handlers
		if (handlers.onMessage) wsManager.on('message', handlers.onMessage);
		if (handlers.onError) wsManager.on('error', handlers.onError);
		if (handlers.onClose) wsManager.on('close', handlers.onClose);
		if (handlers.onOpen) wsManager.on('open', handlers.onOpen);
	}
}

export function cleanupAppState(): void {
	const { wsManager } = appState.value;
	if (wsManager) {
		wsManager.disconnect();
	}

	// Preserve project and collaboration IDs during cleanup
	const { projectId, collaborationId } = appState.value;

	appState.value = {
		wsManager: null,
		apiClient: null,
		status: {
			isConnecting: false,
			isReady: false,
			isLoading: false,
			error: null,
		},
		systemMeta: null,
		error: null,
		versionInfo: undefined,
		projectId,
		collaborationId,
		path: '/',
		buiConfig: null,
	};
}
