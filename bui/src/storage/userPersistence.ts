/**
 * User Persistence Module
 * 
 * Manages user preferences and settings across cloud and local storage strategies.
 * Cloud-first approach with local storage fallback for local-only mode.
 */

import { signal } from '@preact/signals';
import type { ApiClient } from '../utils/apiClient.utils.ts';

export interface NotificationPreferences {
	/** Enable audio notifications when statement processing completes */
	audioEnabled: boolean;
	/** Enable browser push notifications */
	browserNotifications: boolean;
	/** Enable visual indicators (tab title changes, favicon badges) */
	visualIndicators: boolean;
	/** Custom audio file URL (optional) */
	customAudioUrl?: string;
	/** Notification volume (0.0 to 1.0) */
	volume: number;
}

export interface UserPreferences {
	theme: 'light' | 'dark' | 'system';
	fontSize: 'small' | 'medium' | 'large';
	language: string;
	timezone: string;
	notifications: NotificationPreferences;
	/** Project-specific preferences */
	defaultProjectId?: string;
	recentProjects: string[];
	projectViewMode: 'list' | 'grid';
}

export interface UserPersistenceState {
	preferences: UserPreferences | null;
	isLoading: boolean;
	error: string | null;
	isLocalMode: boolean;
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
	theme: 'system',
	fontSize: 'medium',
	language: 'en',
	timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	notifications: {
		audioEnabled: true,
		browserNotifications: true,
		visualIndicators: true,
		volume: 0.5,
	},
	recentProjects: [],
	projectViewMode: 'list',
};

// Local storage keys
const STORAGE_KEYS = {
	PREFERENCES: 'bb_user_preferences',
	LAST_SYNC: 'bb_preferences_last_sync',
} as const;

class UserPersistenceManager {
	private state = signal<UserPersistenceState>({
		preferences: null,
		isLoading: false,
		error: null,
		isLocalMode: false,
	});

	private apiClient: ApiClient | null = null;
	private syncTimeoutId: number | null = null;

	/**
	 * Initialize the persistence manager
	 */
	public initialize(apiClient: ApiClient | null, isLocalMode: boolean): void {
		this.apiClient = apiClient;
		this.state.value = {
			...this.state.value,
			isLocalMode,
		};
	}

	/**
	 * Get current state as a signal
	 */
	public getState() {
		return this.state;
	}

	/**
	 * Load user preferences from appropriate storage
	 */
	public async loadPreferences(): Promise<UserPreferences> {
		this.state.value = {
			...this.state.value,
			isLoading: true,
			error: null,
		};

		try {
			let preferences: UserPreferences;

			if (this.state.value.isLocalMode || !this.apiClient) {
				// Load from local storage
				preferences = await this.loadFromLocalStorage();
			} else {
				// Try cloud storage first, fallback to local
				try {
					preferences = await this.loadFromCloudStorage();
				} catch (cloudError) {
					console.warn('Failed to load from cloud, using local storage:', cloudError);
					preferences = await this.loadFromLocalStorage();
				}
			}

			this.state.value = {
				...this.state.value,
				preferences,
				isLoading: false,
			};

			return preferences;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to load preferences';
			this.state.value = {
				...this.state.value,
				isLoading: false,
				error: errorMessage,
				preferences: DEFAULT_PREFERENCES, // Fallback to defaults
			};
			console.error('UserPersistence: Failed to load preferences:', error);
			return DEFAULT_PREFERENCES;
		}
	}

	/**
	 * Save user preferences to appropriate storage
	 */
	public async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
		const currentPreferences = this.state.value.preferences || DEFAULT_PREFERENCES;
		const updatedPreferences: UserPreferences = {
			...currentPreferences,
			...preferences,
		};

		this.state.value = {
			...this.state.value,
			preferences: updatedPreferences,
			error: null,
		};

		try {
			if (this.state.value.isLocalMode || !this.apiClient) {
				await this.saveToLocalStorage(updatedPreferences);
			} else {
				// Save to both cloud and local for redundancy
				await Promise.allSettled([
					this.saveToCloudStorage(updatedPreferences),
					this.saveToLocalStorage(updatedPreferences),
				]);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Failed to save preferences';
			this.state.value = {
				...this.state.value,
				error: errorMessage,
			};
			console.error('UserPersistence: Failed to save preferences:', error);
			throw error;
		}
	}

	/**
	 * Update specific notification preferences
	 */
	public async updateNotificationPreferences(
		notifications: Partial<NotificationPreferences>,
	): Promise<void> {
		const currentPreferences = this.state.value.preferences || DEFAULT_PREFERENCES;
		await this.savePreferences({
			notifications: {
				...currentPreferences.notifications,
				...notifications,
			},
		});
	}

	/**
	 * Get current notification preferences
	 */
	public getNotificationPreferences(): NotificationPreferences {
		return this.state.value.preferences?.notifications || DEFAULT_PREFERENCES.notifications;
	}

	/**
	 * Load preferences from local storage
	 */
	private async loadFromLocalStorage(): Promise<UserPreferences> {
		try {
			const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
			if (stored) {
				const parsed = JSON.parse(stored);
				// Merge with defaults to handle new preference additions
				return {
					...DEFAULT_PREFERENCES,
					...parsed,
					notifications: {
						...DEFAULT_PREFERENCES.notifications,
						...parsed.notifications,
					},
				};
			}
		} catch (error) {
			console.warn('Failed to parse local storage preferences:', error);
		}
		return DEFAULT_PREFERENCES;
	}

	/**
	 * Save preferences to local storage
	 */
	private async saveToLocalStorage(preferences: UserPreferences): Promise<void> {
		try {
			localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
			localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
		} catch (error) {
			console.error('Failed to save to local storage:', error);
			throw new Error('Local storage save failed');
		}
	}

	/**
	 * Load preferences from cloud storage (user_profiles table)
	 */
	private async loadFromCloudStorage(): Promise<UserPreferences> {
		if (!this.apiClient) {
			throw new Error('API client not available');
		}

		try {
			// Call API endpoint to get user profile with preferences
			const response = await this.apiClient.get<{
				preferences?: UserPreferences;
			}>('/api/v1/user/preferences');

			if (response?.preferences) {
				// Merge with defaults to handle new preference additions
				return {
					...DEFAULT_PREFERENCES,
					...response.preferences,
					notifications: {
						...DEFAULT_PREFERENCES.notifications,
						...response.preferences.notifications,
					},
				};
			}
		} catch (error) {
			console.error('Failed to load from cloud storage:', error);
			throw error;
		}

		return DEFAULT_PREFERENCES;
	}

	/**
	 * Save preferences to cloud storage (user_profiles table)
	 */
	private async saveToCloudStorage(preferences: UserPreferences): Promise<void> {
		if (!this.apiClient) {
			throw new Error('API client not available');
		}

		try {
			await this.apiClient.put('/api/v1/user/preferences', {
				preferences,
			});
		} catch (error) {
			console.error('Failed to save to cloud storage:', error);
			throw error;
		}
	}

	/**
	 * Sync preferences between local and cloud storage
	 */
	public async syncPreferences(): Promise<void> {
		if (this.state.value.isLocalMode || !this.apiClient) {
			return; // No sync needed in local mode
		}

		try {
			const [localPrefs, cloudPrefs] = await Promise.allSettled([
				this.loadFromLocalStorage(),
				this.loadFromCloudStorage(),
			]);

			if (localPrefs.status === 'fulfilled' && cloudPrefs.status === 'fulfilled') {
				// Simple last-write-wins strategy
				// In a more sophisticated implementation, you might use timestamps
				const lastSyncStr = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
				const lastSync = lastSyncStr ? new Date(lastSyncStr) : new Date(0);
				const now = new Date();

				// If local storage is newer, push to cloud
				if (lastSync.getTime() > now.getTime() - 5 * 60 * 1000) { // 5 minutes tolerance
					await this.saveToCloudStorage(localPrefs.value);
				} else {
					// Otherwise, use cloud preferences
					await this.saveToLocalStorage(cloudPrefs.value);
					this.state.value = {
						...this.state.value,
						preferences: cloudPrefs.value,
					};
				}
			}
		} catch (error) {
			console.warn('Preference sync failed:', error);
		}
	}

	/**
	 * Schedule a delayed sync (debounced)
	 */
	public scheduleDeferredSync(): void {
		if (this.syncTimeoutId) {
			clearTimeout(this.syncTimeoutId);
		}

		this.syncTimeoutId = setTimeout(() => {
			this.syncPreferences().catch(console.error);
		}, 2000); // 2 second delay
	}

	/**
	 * Clear all stored preferences (useful for logout)
	 */
	public clearPreferences(): void {
		try {
			localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
			localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
		} catch (error) {
			console.warn('Failed to clear local preferences:', error);
		}

		this.state.value = {
			...this.state.value,
			preferences: null,
			error: null,
		};
	}
}

// Export singleton instance
export const userPersistenceManager = new UserPersistenceManager();

/**
 * Hook for components to use user persistence
 */
export function useUserPersistence() {
	return {
		state: userPersistenceManager.getState(),
		loadPreferences: () => userPersistenceManager.loadPreferences(),
		savePreferences: (prefs: Partial<UserPreferences>) =>
			userPersistenceManager.savePreferences(prefs),
		updateNotificationPreferences: (notifications: Partial<NotificationPreferences>) =>
			userPersistenceManager.updateNotificationPreferences(notifications),
		getNotificationPreferences: () => userPersistenceManager.getNotificationPreferences(),
		syncPreferences: () => userPersistenceManager.syncPreferences(),
		clearPreferences: () => userPersistenceManager.clearPreferences(),
	};
}