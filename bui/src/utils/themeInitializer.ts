/**
 * Client-Side Theme Initializer
 *
 * This script runs in the browser to initialize the theme system.
 * It's designed to be executed as early as possible to prevent theme flashing.
 */

import { themeManager } from './themeManager.ts';

// Local storage key for theme preference
const THEME_STORAGE_KEY = 'bb_user_preferences';

/**
 * Initialize theme system in the browser
 * Should be called as early as possible in the page lifecycle
 */
export function initializeThemeInBrowser(): void {
	if (typeof window === 'undefined') {
		console.warn('initializeThemeInBrowser called in non-browser context');
		return;
	}

	try {
		// Initialize the theme manager
		themeManager.initialize();

		// Load saved theme preference from localStorage
		const savedTheme = loadThemeFromStorage();

		// Apply the theme immediately
		themeManager.applyTheme(savedTheme);

		console.log('Theme system initialized in browser', {
			preference: savedTheme,
			resolved: themeManager.getResolvedTheme(),
			supportsSystem: themeManager.supportsSystemTheme(),
		});
	} catch (error) {
		console.error('Failed to initialize theme system:', error);
		// Fallback to system theme
		themeManager.applyTheme('system');
	}
}

/**
 * Load theme preference from localStorage
 */
function loadThemeFromStorage(): 'light' | 'dark' | 'system' {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			const theme = parsed?.theme;
			if (theme === 'light' || theme === 'dark' || theme === 'system') {
				return theme;
			}
		}
	} catch (error) {
		console.warn('Failed to load theme from localStorage:', error);
	}

	// Default to system if no preference or error
	return 'system';
}

/**
 * Apply theme before DOM is fully loaded to prevent flashing
 * This can be called immediately in a script tag
 */
export function applyThemeImmediately(): void {
	if (typeof window === 'undefined') return;

	const theme = loadThemeFromStorage();

	// Manually apply theme class to prevent flashing
	// This is a simplified version that runs before the full theme manager loads
	if (theme === 'dark') {
		document.documentElement.classList.add('dark');
	} else if (theme === 'light') {
		document.documentElement.classList.remove('dark');
	} else {
		// System preference
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		if (prefersDark) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
}

// Auto-initialize if this script is loaded directly
if (typeof window !== 'undefined' && document.readyState === 'loading') {
	// Apply theme immediately to prevent flashing
	applyThemeImmediately();

	// Initialize full theme system when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initializeThemeInBrowser);
	} else {
		initializeThemeInBrowser();
	}
}
