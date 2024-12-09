import { signal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { AppConfig, AppState } from '../types/websocket.types.ts';
import type { VersionInfo } from 'shared/types/version.ts';
import { createWebSocketManagerApp } from '../utils/websocketManagerApp.utils.ts';
import { createApiClientManager } from '../utils/apiClient.utils.ts';

const appState = signal<AppState>({
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
});

export function useAppState(): Signal<AppState> {
	// console.log('useAppState: hook called', {
	//     currentState: appState.value
	// });
	return appState;
}

export function initializeAppState(config: AppConfig): void {
	console.log('useAppState: initializeAppState called', {
		hasExistingManagers: !!(appState.value.wsManager || appState.value.apiClient),
	});
	if (appState.value.wsManager || appState.value.apiClient) {
		console.log('AppState already initialized');
		return;
	}

	const wsManager = createWebSocketManagerApp({
		url: config.url,
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
	//console.log('AppState: initializeAppState finished - ws handlers', wsManager.eventHandlers);
}

export function cleanupAppState(): void {
	const { wsManager } = appState.value;
	if (wsManager) {
		wsManager.disconnect();
	}

	appState.value = {
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
	};
}
