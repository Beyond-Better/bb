/**
 * Theme Manager Island
 *
 * Handles browser-side theme management including:
 * - System preference detection and monitoring
 * - Theme application when user preferences change
 * - Integration with the theme manager utilities
 */

import { useEffect } from 'preact/hooks';
import { JSX } from 'preact';
import { useUserPersistence } from '../storage/userPersistence.ts';
import { themeManager } from '../utils/themeManager.ts';

interface ThemeManagerProps {
	/** Optional class name for the container */
	className?: string;
}

export default function ThemeManager({ className = '' }: ThemeManagerProps): JSX.Element {
	const {
		state: persistenceState,
		loadPreferences,
		getCurrentTheme,
	} = useUserPersistence();

	useEffect(() => {
		// Initialize theme manager in browser context
		console.log('ThemeManager Island: Initializing theme system...');

		try {
			// Initialize the theme manager
			themeManager.initialize();

			// Load and apply initial theme
			const initializeTheme = async () => {
				try {
					console.log('ThemeManager Island: Loading preferences...');
					await loadPreferences();

					// Get the current theme preference
					const currentTheme = getCurrentTheme();
					console.log('ThemeManager Island: Current theme preference:', currentTheme);

					// Apply the theme (this will handle system detection if needed)
					themeManager.applyTheme(currentTheme);

					console.log('ThemeManager Island: Theme applied', {
						preference: currentTheme,
						resolved: themeManager.getResolvedTheme(),
						supportsSystem: themeManager.supportsSystemTheme(),
					});
				} catch (error) {
					console.warn('ThemeManager Island: Failed to load preferences, using system default:', error);
					// Fallback to system theme if loading fails
					themeManager.applyTheme('system');
				}
			};

			initializeTheme();
		} catch (error) {
			console.error('ThemeManager Island: Failed to initialize theme system:', error);
		}

		// Cleanup on unmount
		return () => {
			console.log('ThemeManager Island: Cleaning up theme system...');
			themeManager.cleanup();
		};
	}, []); // Run once on mount

	// Apply theme when preferences change
	useEffect(() => {
		if (persistenceState.value.preferences?.theme) {
			const theme = persistenceState.value.preferences.theme;
			console.log('ThemeManager Island: Preference changed, applying theme:', theme);
			themeManager.applyTheme(theme);

			console.log('ThemeManager Island: Theme updated', {
				preference: theme,
				resolved: themeManager.getResolvedTheme(),
			});
		}
	}, [persistenceState.value.preferences?.theme]);

	// Listen for theme change events (optional, for debugging/monitoring)
	useEffect(() => {
		const handleThemeChange = (event: CustomEvent) => {
			console.log('ThemeManager Island: Theme change event received', event.detail);
		};

		globalThis.addEventListener('themechange', handleThemeChange as EventListener);

		return () => {
			globalThis.removeEventListener('themechange', handleThemeChange as EventListener);
		};
	}, []);

	// This island renders nothing visible - it's purely for side effects
	return (
		<div
			className={`theme-manager-island ${className}`}
			style={{ display: 'none' }}
			data-theme-manager='active'
		/>
	);
}
