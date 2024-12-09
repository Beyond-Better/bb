import { useEffect } from 'preact/hooks';
import { initializeAppState, useAppState } from '../hooks/useAppState.ts';

interface AppStateProviderProps {
    wsUrl: string;
    apiUrl: string;
}

/**
 * Root-level island component that manages the application state.
 * Must be included in the Layout component before any components that need access to appState.
 */
export default function AppStateProvider({ wsUrl, apiUrl }: AppStateProviderProps) {
    const appState = useAppState();

    // Initialize app state on mount
    useEffect(() => {
        console.log('AppStateProvider: Initializing app state');
        initializeAppState({
            url: wsUrl,
            apiUrl: apiUrl,
            onMessage: (message) => {
                console.log('AppStateProvider: Received message:', message);
            },
            onError: (error) => {
                console.error('AppStateProvider: WebSocket error:', error);
            },
            onClose: () => {
                console.log('AppStateProvider: WebSocket closed');
            },
            onOpen: () => {
                console.log('AppStateProvider: WebSocket opened');
            }
        });
    }, [wsUrl, apiUrl]);

    // This component doesn't render anything - it just manages state
    return null;
}