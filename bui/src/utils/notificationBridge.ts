/**
 * Cross-Platform Notification Bridge
 *
 * Provides a unified notification API that works across different environments:
 * - Browser environments: Uses Web Notification API
 * - DUI environments: Uses Tauri's native notification system
 * - Fallback: Console logging and visual indicators only
 */

import { IS_BROWSER } from '$fresh/runtime.ts';
import { isDuiEnvironment } from 'shared/externalLinkHelper.ts';

export interface NotificationOptions {
	title: string;
	body?: string;
	icon?: string;
	badge?: string;
	tag?: string;
	requireInteraction?: boolean;
	data?: any;
}

export type Permission = 'granted' | 'denied' | 'default';

export interface NotificationBridge {
	isSupported(): boolean;
	isPermissionGranted(): Promise<boolean>;
	requestPermission(): Promise<Permission>;
	sendNotification(options: NotificationOptions): Promise<void>;
	getEnvironmentType(): 'dui' | 'browser' | 'unsupported';
}

/*
class TauriEventBridge implements NotificationBridge {
	private _tauriEvents: any = null;
	private _initPromise: Promise<boolean> | null = null;

	isSupported(): boolean {
		if (!IS_BROWSER) return false;
		return isDuiEnvironment();
	}

	private async initTauriEvents(): Promise<boolean> {
		if (this._tauriEvents) {
			return true;
		}

		if (this._initPromise) {
			return this._initPromise;
		}

		this._initPromise = (async () => {
			try {
				if (!this.isSupported()) {
					console.log('TauriNotificationBridge: Not in DUI environment');
					return false;
				}

				// Dynamic import of Tauri event system (IPC bridge)
				this._tauriEvents = await import('@tauri-apps/api/event');
				console.log('TauriNotificationBridge: Successfully loaded Tauri event system for IPC bridge');
				return true;
			} catch (error) {
				console.warn('TauriNotificationBridge: Failed to load Tauri events:', error);
				return false;
			}
		})();

		return this._initPromise;
	}

	async isPermissionGranted(): Promise<boolean> {
		// For IPC bridge, we'll assume permission checking is handled by main window
		// We can't directly check from remote content, so return true for now
		return true;
	}

	async requestPermission(): Promise<Permission> {
		// For IPC bridge, permission requests are handled by main window
		// We'll assume granted since main window handles the actual permission logic
		return 'granted';
	}

	async sendNotification(options: NotificationOptions): Promise<void> {
		const initialized = await this.initTauriEvents();
		if (!initialized) {
			throw new Error('Tauri IPC bridge not supported');
		}

		try {
			console.log('TauriNotificationBridge: Sending notification request via IPC bridge');

			// Convert our NotificationOptions to format expected by main window
			const tauriOptions = {
				title: options.title,
				body: options.body,
				icon: options.icon,
			};

			// Send notification request to main window via IPC
			await this._tauriEvents.emit('bb-notification-request', tauriOptions);
			console.log('TauriNotificationBridge: Notification request sent to main window');

			// Wait for response from main window (with timeout)
			const response = await this.waitForNotificationResponse();

			if (response.success) {
				console.log('TauriNotificationBridge: Notification sent successfully via IPC bridge');
			} else {
				throw new Error(response.error || 'Notification failed');
			}
		} catch (error) {
			console.error('TauriNotificationBridge: Failed to send notification via IPC bridge:', error);
			throw error;
		}
	}

	private async waitForNotificationResponse(): Promise<{success: boolean; error?: string}> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Notification response timeout'));
			}, 5000); // 5 second timeout

			// Listen for success response
			const successListener = this._tauriEvents.listen('bb-notification-success', (event: any) => {
				clearTimeout(timeout);
				resolve({ success: true });
			});

			// Listen for error response
			const errorListener = this._tauriEvents.listen('bb-notification-error', (event: any) => {
				clearTimeout(timeout);
				resolve({ success: false, error: event.payload?.error || 'Unknown error' });
			});

			// Clean up listeners on timeout
			setTimeout(async () => {
				try {
					const [successUnlisten, errorUnlisten] = await Promise.all([successListener, errorListener]);
					successUnlisten();
					errorUnlisten();
				} catch (error) {
					// Ignore cleanup errors
				}
			}, 5100);
		});
	}

	getEnvironmentType(): 'dui' | 'browser' | 'unsupported' {
		return 'dui';
	}
}
 */

class TauriNotificationBridge implements NotificationBridge {
	private _tauriNotification: any = null;
	private _initPromise: Promise<boolean> | null = null;

	isSupported(): boolean {
		if (!IS_BROWSER) return false;
		return isDuiEnvironment();
	}

	private async initTauriNotification(): Promise<boolean> {
		if (this._tauriNotification) {
			return true;
		}

		if (this._initPromise) {
			return this._initPromise;
		}

		this._initPromise = (async () => {
			try {
				if (!this.isSupported()) {
					console.log('TauriNotificationBridge: Not in DUI environment');
					return false;
				}

				// Dynamic import of Tauri notification plugin
				this._tauriNotification = await import('@tauri-apps/plugin-notification');
				console.log('TauriNotificationBridge: Successfully loaded Tauri notification plugin');
				return true;
			} catch (error) {
				console.warn('TauriNotificationBridge: Failed to load notification plugin:', error);
				return false;
			}
		})();

		return this._initPromise;
	}

	async isPermissionGranted(): Promise<boolean> {
		const initialized = await this.initTauriNotification();
		if (!initialized) return false;

		try {
			return await this._tauriNotification.isPermissionGranted();
		} catch (error) {
			console.warn('TauriNotificationBridge: Failed to check permission:', error);
			return false;
		}
	}

	async requestPermission(): Promise<Permission> {
		const initialized = await this.initTauriNotification();
		if (!initialized) return 'denied';

		try {
			const permission = await this._tauriNotification.requestPermission();
			console.log('TauriNotificationBridge: Permission result:', permission);
			return permission;
		} catch (error) {
			console.error('TauriNotificationBridge: Failed to request permission:', error);
			return 'denied';
		}
	}

	async sendNotification(options: NotificationOptions): Promise<void> {
		const initialized = await this.initTauriNotification();
		if (!initialized) {
			throw new Error('Tauri notifications not supported');
		}

		try {
			// Convert our NotificationOptions to Tauri format
			const tauriOptions = {
				title: options.title,
				body: options.body,
				icon: options.icon,
				// Tauri plugin may not support all options, so we'll include what we can
			};

			await this._tauriNotification.sendNotification(tauriOptions);
			console.log('TauriNotificationBridge: Notification sent successfully');
		} catch (error) {
			console.error('TauriNotificationBridge: Failed to send notification:', error);
			throw error;
		}
	}

	getEnvironmentType(): 'dui' | 'browser' | 'unsupported' {
		return 'dui';
	}
}

class BrowserNotificationBridge implements NotificationBridge {
	isSupported(): boolean {
		if (!IS_BROWSER) return false;
		return 'Notification' in globalThis &&
			typeof Notification !== 'undefined';
	}

	async isPermissionGranted(): Promise<boolean> {
		if (!this.isSupported()) return false;
		return Notification.permission === 'granted';
	}

	async requestPermission(): Promise<Permission> {
		if (!this.isSupported()) return 'denied';
		try {
			const permission = await Notification.requestPermission();
			return permission;
		} catch (error) {
			console.error('BrowserNotificationBridge: Failed to request permission:', error);
			return 'denied';
		}
	}

	async sendNotification(options: NotificationOptions): Promise<void> {
		if (!this.isSupported()) {
			throw new Error('Browser notifications not supported');
		}

		if (Notification.permission !== 'granted') {
			throw new Error('Notification permission not granted');
		}

		try {
			const notification = new Notification(options.title, {
				body: options.body,
				icon: options.icon,
				badge: options.badge,
				tag: options.tag,
				requireInteraction: options.requireInteraction,
				data: options.data,
			});

			// // Auto-close after 10 seconds if user doesn't interact
			// setTimeout(() => {
			// 	notification.close();
			// }, 10000);

			// Handle notification click
			notification.onclick = () => {
				globalThis.focus();
				notification.close();
			};

			console.log('BrowserNotificationBridge: Notification sent successfully');
		} catch (error) {
			console.error('BrowserNotificationBridge: Failed to send notification:', error);
			throw error;
		}
	}

	getEnvironmentType(): 'dui' | 'browser' | 'unsupported' {
		return 'browser';
	}
}

class FallbackNotificationBridge implements NotificationBridge {
	isSupported(): boolean {
		if (!IS_BROWSER) return false;
		return true; // Always supported as fallback
	}

	async isPermissionGranted(): Promise<boolean> {
		return true; // Fallback always "has permission"
	}

	async requestPermission(): Promise<Permission> {
		return 'granted'; // Fallback always grants permission
	}

	async sendNotification(options: NotificationOptions): Promise<void> {
		// Log to console as fallback
		console.log('FallbackNotificationBridge: Notification (fallback):', {
			title: options.title,
			body: options.body,
			timestamp: new Date().toISOString(),
		});

		// Could add visual fallback here (toast, etc.)
		return Promise.resolve();
	}

	getEnvironmentType(): 'dui' | 'browser' | 'unsupported' {
		return 'unsupported';
	}
}

/**
 * Creates the appropriate notification bridge for the current environment
 */
function createNotificationBridge(): NotificationBridge {
	if (!IS_BROWSER) {
		return new FallbackNotificationBridge();
	}

	// Check for DUI environment first
	if (isDuiEnvironment()) {
		console.log('NotificationBridge: Detected DUI environment');
		const tauriBridge = new TauriNotificationBridge();
		if (tauriBridge.isSupported()) {
			return tauriBridge;
		}
	}

	// Check for browser notification support
	if ('Notification' in globalThis) {
		console.log('NotificationBridge: Detected browser environment');
		return new BrowserNotificationBridge();
	}

	// Fallback for unsupported environments
	console.log('NotificationBridge: Using fallback (no notification support)');
	return new FallbackNotificationBridge();
}

// Export singleton instance
export const notificationBridge = createNotificationBridge();

/**
 * Utility function to check if we're running in a regular browser
 */
export function isBrowserEnvironment(): boolean {
	if (!IS_BROWSER) return false;
	return !isDuiEnvironment() && 'Notification' in globalThis;
}

/**
 * Hook for components to use the notification bridge
 */
export function useNotificationBridge() {
	return {
		bridge: notificationBridge,
		isSupported: () => notificationBridge.isSupported(),
		isPermissionGranted: () => notificationBridge.isPermissionGranted(),
		requestPermission: () => notificationBridge.requestPermission(),
		sendNotification: (options: NotificationOptions) => notificationBridge.sendNotification(options),
		getEnvironmentType: () => notificationBridge.getEnvironmentType(),
		isDui: isDuiEnvironment(),
		isBrowser: isBrowserEnvironment(),
	};
}
