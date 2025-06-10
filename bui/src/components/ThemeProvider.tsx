/**
 * Theme Provider Component
 *
 * Simple provider that just wraps children. The actual theme management
 * is handled by the ThemeManager island to ensure browser-side execution.
 */

import { JSX } from 'preact';

interface ThemeProviderProps {
	children: JSX.Element | JSX.Element[];
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
	// This component is now just a wrapper since the actual theme management
	// happens in the ThemeManager island to ensure browser context
	return <>{children}</>;
}

/**
 * Higher-order component for theme initialization
 * Use this to wrap components that need immediate theme support
 */
export function withTheme<T extends Record<string, unknown>>(
	Component: (props: T) => JSX.Element,
) {
	return function ThemedComponent(props: T): JSX.Element {
		return (
			<ThemeProvider>
				<Component {...props} />
			</ThemeProvider>
		);
	};
}
