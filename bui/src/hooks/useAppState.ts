import { signal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { WebSocketConfigApp, WebSocketStatus } from '../types/websocket.types.ts';
import type { VersionInfo } from 'shared/types/version.ts';
import { createWebSocketManagerApp, type WebSocketManagerApp } from '../utils/websocketManagerApp.utils.ts';
import { type ApiClient, createApiClientManager } from '../utils/apiClient.utils.ts';

export interface AppState {
	wsManager: WebSocketManagerApp | null;
	apiClient: ApiClient | null;
	status: WebSocketStatus;
	error: string | null;
	versionInfo: VersionInfo | undefined;
	projectId: string | null;
	conversationId: string | null;
}

// Load initial state from localStorage and URL
const loadStoredState = () => {
	let projectId = null;
	let conversationId = null;

	if (typeof window !== 'undefined') {
		// Check URL parameters first
		const params = new URLSearchParams(window.location.search);
		projectId = params.get('projectId');
		conversationId = params.get('conversationId');

		// If not in URL, check localStorage
		if (!projectId) {
			projectId = localStorage.getItem('bb_projectId');
		}
		if (!conversationId) {
			conversationId = localStorage.getItem('bb_conversationId');
		}
	}

	return {
		projectId,
		conversationId,
	};
};

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
	...loadStoredState(),
});

// Function to update URL parameters
const updateUrlParams = (projectId: string | null, conversationId: string | null) => {
	if (typeof window === 'undefined') return;

	const url = new URL(window.location.href);
	if (projectId) {
		url.searchParams.set('projectId', projectId);
	} else {
		url.searchParams.delete('projectId');
	}
	if (conversationId) {
		url.searchParams.set('conversationId', conversationId);
	} else {
		url.searchParams.delete('conversationId');
	}

	window.history.replaceState({}, '', url.toString());
};

// Function to update localStorage
const updateLocalStorage = (projectId: string | null, conversationId: string | null) => {
	if (typeof localStorage === 'undefined') return;

	if (projectId) {
		localStorage.setItem('bb_projectId', projectId);
	} else {
		localStorage.removeItem('bb_projectId');
	}
	if (conversationId) {
		localStorage.setItem('bb_conversationId', conversationId);
	} else {
		localStorage.removeItem('bb_conversationId');
	}
};

export function useAppState(): Signal<AppState> {
	return appState;
}

export function setProject(projectId: string | null) {
	console.log('AppState: setProject', projectId);
	appState.value = {
		...appState.value,
		projectId,
	};
	updateLocalStorage(projectId, appState.value.conversationId);
	updateUrlParams(projectId, appState.value.conversationId);
}

export function setConversation(conversationId: string | null) {
	appState.value = {
		...appState.value,
		conversationId,
	};
	updateLocalStorage(appState.value.projectId, conversationId);
	updateUrlParams(appState.value.projectId, conversationId);
}

export function initializeAppState(config: WebSocketConfigApp): void {
	console.log('useAppState: initializeAppState called', {
		hasExistingManagers: !!(appState.value.wsManager || appState.value.apiClient),
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
	onMessage?: (message: any) => void;
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

	// Preserve project and conversation IDs during cleanup
	const { projectId, conversationId } = appState.value;

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
		projectId,
		conversationId,
	};
}
