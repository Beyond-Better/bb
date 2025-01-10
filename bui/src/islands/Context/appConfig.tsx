import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { initializeAuthState, useAuthState } from '../../hooks/useAuthState.ts';
import type { BuiConfig } from 'shared/config/v2/types.ts';

interface AppConfigContextProps {
	children: ComponentChildren;
	buiConfig: BuiConfig;
}

export default function AppConfigContext({ children, buiConfig }: AppConfigContextProps) {
	const { authState } = useAuthState();
	if (IS_BROWSER) console.log('AppConfigContext: authState', authState.value);

	useEffect(() => {
		if (!IS_BROWSER) return;

		// Initialize app state
		const initializeAppConfig = () => {
			initializeAuthState(buiConfig);
		};

		initializeAppConfig();
	}, []);

	return (
		<>
			{children}
		</>
	);
}
