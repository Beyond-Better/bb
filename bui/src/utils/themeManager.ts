/**
 * Theme Manager
 *
 * Handles theme application logic, including system preference detection
 * and DOM manipulation for Tailwind's class-based dark mode.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

class ThemeManager {
	private currentPreference: ThemePreference = 'system';
	private systemChangeListener: ((e: MediaQueryListEvent) => void) | null = null;
	private prefersDarkQuery: MediaQueryList | null = null;

	/**
	 * Initialize the theme manager
	 */
	public initialize(): void {
		if (typeof globalThis === 'undefined') return;

		// Set up media query listener for system theme changes
		this.prefersDarkQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
		this.systemChangeListener = (e: MediaQueryListEvent) => {
			if (this.currentPreference === 'system') {
				this.applyResolvedTheme(e.matches ? 'dark' : 'light');
			}
		};

		// Add listener for system theme changes
		if (this.prefersDarkQuery.addEventListener) {
			this.prefersDarkQuery.addEventListener('change', this.systemChangeListener);
		} else {
			// Fallback for older browsers
			this.prefersDarkQuery.addListener(this.systemChangeListener);
		}
	}

	/**
	 * Clean up event listeners
	 */
	public cleanup(): void {
		if (this.prefersDarkQuery && this.systemChangeListener) {
			if (this.prefersDarkQuery.removeEventListener) {
				this.prefersDarkQuery.removeEventListener('change', this.systemChangeListener);
			} else {
				// Fallback for older browsers
				this.prefersDarkQuery.removeListener(this.systemChangeListener);
			}
		}
	}

	/**
	 * Apply a theme preference (light/dark/system)
	 */
	public applyTheme(preference: ThemePreference): void {
		this.currentPreference = preference;
		const resolvedTheme = this.resolveTheme(preference);
		this.applyResolvedTheme(resolvedTheme);
	}

	/**
	 * Get the current theme preference
	 */
	public getCurrentPreference(): ThemePreference {
		return this.currentPreference;
	}

	/**
	 * Get the currently resolved theme (what's actually applied)
	 */
	public getResolvedTheme(): ResolvedTheme {
		return this.resolveTheme(this.currentPreference);
	}

	/**
	 * Resolve a theme preference to an actual theme
	 */
	private resolveTheme(preference: ThemePreference): ResolvedTheme {
		if (preference === 'system') {
			if (typeof globalThis === 'undefined') return 'light';
			return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return preference;
	}

	/**
	 * Apply the resolved theme to the DOM
	 */
	private applyResolvedTheme(theme: ResolvedTheme): void {
		if (typeof globalThis === 'undefined') return;

		const htmlElement = document.documentElement;

		if (theme === 'dark') {
			htmlElement.classList.add('dark');
		} else {
			htmlElement.classList.remove('dark');
		}

		// Optional: Store the resolved theme in a data attribute for CSS access
		htmlElement.setAttribute('data-theme', theme);

		// Optional: Dispatch a custom event for other components to listen to
		globalThis.dispatchEvent(
			new CustomEvent('themechange', {
				detail: {
					preference: this.currentPreference,
					resolved: theme,
				},
			}),
		);
	}

	/**
	 * Get system theme preference without applying it
	 */
	public getSystemTheme(): ResolvedTheme {
		if (typeof globalThis === 'undefined') return 'light';
		return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	/**
	 * Check if system supports dark mode
	 */
	public supportsSystemTheme(): boolean {
		if (typeof globalThis === 'undefined') return false;
		return globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').media !== 'not all';
	}
}

// Export singleton instance
export const themeManager = new ThemeManager();

/**
 * Hook for components to use theme management
 */
export function useThemeManager() {
	return {
		applyTheme: (preference: ThemePreference) => themeManager.applyTheme(preference),
		getCurrentPreference: () => themeManager.getCurrentPreference(),
		getResolvedTheme: () => themeManager.getResolvedTheme(),
		getSystemTheme: () => themeManager.getSystemTheme(),
		supportsSystemTheme: () => themeManager.supportsSystemTheme(),
		initialize: () => themeManager.initialize(),
		cleanup: () => themeManager.cleanup(),
	};
}
