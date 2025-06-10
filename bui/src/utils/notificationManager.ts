/**
 * Notification Manager
 *
 * Handles all types of notifications when BB completes processing:
 * - Audio notifications
 * - Browser push notifications
 * - Visual indicators (tab title, favicon)
 * - Page visibility state management
 */

import { signal } from '@preact/signals';
import { IS_BROWSER } from '$fresh/runtime.ts';
import type { StatementCompletionNotifications } from '../storage/userPersistence.ts';
import { userPersistenceManager } from '../storage/userPersistence.ts';

export interface NotificationState {
	/** Whether notifications are currently enabled */
	enabled: boolean;
	/** Whether browser has notification permission */
	hasPermission: boolean;
	/** Whether page is currently visible */
	isPageVisible: boolean;
	/** Whether user is currently away (inferred from inactivity) */
	isUserAway: boolean;
	/** Count of unread notifications */
	unreadCount: number;
	/** Original page title (before modifications) */
	originalTitle: string;
	/** Original favicon href */
	originalFavicon: string;
}

export interface NotificationManagerConfig {
	/** How long to wait for user interaction before considering them "away" (ms) */
	awayTimeoutMs: number;
	/** How long to show visual indicators before auto-clearing (ms) */
	indicatorTimeoutMs: number;
	/** Default audio file path */
	defaultAudioPath: string;
}

const DEFAULT_CONFIG: NotificationManagerConfig = {
	awayTimeoutMs: 30000, // 30 seconds
	indicatorTimeoutMs: 300000, // 5 minutes
	defaultAudioPath: '/notification-sound.mp3',
};

class NotificationManager {
	private state = signal<NotificationState>({
		enabled: true,
		hasPermission: false,
		isPageVisible: true,
		isUserAway: false,
		unreadCount: 0,
		originalTitle: '',
		originalFavicon: '',
	});

	private isInitialized: boolean = false;

	private config: NotificationManagerConfig;
	private audioContext: AudioContext | null = null;
	private userActivityTimeout: number | null = null;
	private indicatorTimeout: number | null = null;
	private lastUserActivity: number = Date.now();

	constructor(config: Partial<NotificationManagerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Initialize the notification manager
	 */
	public async initialize(): Promise<void> {
		if (!IS_BROWSER) return;
		if (this.isInitialized) return;
		console.log('NotificationManager: Initializing');

		// Store original page state
		this.state.value = {
			...this.state.value,
			originalTitle: document.title,
			originalFavicon: this.getCurrentFavicon(),
		};

		// Set up event listeners
		this.setupEventListeners();

		// Check and request notification permission - only request permission from explicit user gesture, eg button click
		//await this.requestNotificationPermission();

		// Initialize audio context (user activation required)
		this.setupAudioContext();

		// Start user activity tracking
		this.startUserActivityTracking();

		this.isInitialized = true;
		console.log('NotificationManager: Initialized successfully');
	}

	/**
	 * Get current state as signal
	 */
	public getState() {
		return this.state;
	}

	/**
	 * Send notification when statement processing completes
	 */
	public async notifyStatementComplete(
		message: string = 'Statement processing complete',
		shouldNotifyOverride?: boolean,
	): Promise<void> {
		console.log('NotificationManager: Statement complete notification triggered');

		const preferences = userPersistenceManager.getNotificationPreferences();
		console.log('NotificationManager: preferences', preferences);

		if (!this.state.value.enabled) {
			console.log('NotificationManager: Notifications disabled');
			return;
		}

		// Determine if user seems to be away from the page
		const shouldNotify = shouldNotifyOverride !== undefined ? shouldNotifyOverride : this.shouldSendNotification();

		if (!shouldNotify) {
			console.log('NotificationManager: User appears to be active, skipping intrusive notifications');
			// Still show subtle visual indicator
			if (preferences.visualIndicators) {
				this.showSubtleVisualIndicator();
			}
			return;
		}

		console.log('NotificationManager: User appears away, sending notifications');

		// Execute all enabled notification types
		const promises: Promise<void>[] = [];

		if (preferences.audioEnabled) {
			promises.push(this.playAudioNotification(preferences));
		}

		//if (preferences.browserNotifications && this.state.value.hasPermission) {
		if (preferences.browserNotifications) {
			promises.push(this.showBrowserNotification(message));
		}

		if (preferences.visualIndicators) {
			promises.push(this.showVisualIndicators());
		}

		// Execute all notifications concurrently
		await Promise.allSettled(promises);
	}

	/**
	 * Clear all visual indicators when user returns
	 */
	public clearNotifications(): void {
		console.log('NotificationManager: Clearing notifications');

		// Clear timeouts
		if (this.indicatorTimeout) {
			clearTimeout(this.indicatorTimeout);
			this.indicatorTimeout = null;
		}

		// Reset visual indicators
		this.resetPageTitle();
		this.resetFavicon();

		// Reset unread count
		this.state.value = {
			...this.state.value,
			unreadCount: 0,
		};
	}

	/**
	 * Request notification permission from browser
	 */
	public async requestNotificationPermission(): Promise<boolean> {
		if (!IS_BROWSER) return false;
		if (!('Notification' in globalThis)) {
			console.warn('NotificationManager: Browser notifications not supported');
			return false;
		}

		try {
			//console.warn('NotificationManager: Checking Browser notifications permission');
			const permission = await Notification.requestPermission();
			const hasPermission = permission === 'granted';

			this.state.value = {
				...this.state.value,
				hasPermission,
			};

			console.log('NotificationManager: Permission status:', permission);
			return hasPermission;
		} catch (error) {
			console.error('NotificationManager: Failed to request permission:', error);
			return false;
		}
	}

	/**
	 * Test notification system
	 */
	public async testNotifications(): Promise<void> {
		console.log('NotificationManager: Testing notifications');
		await this.notifyStatementComplete('Test notification - BB is working!', true);
	}

	/**
	 * Determine if we should send intrusive notifications
	 */
	private shouldSendNotification(): boolean {
		// Always notify if page is hidden
		if (!this.state.value.isPageVisible) {
			return true;
		}

		// Notify if user appears to be away (no activity for a while)
		if (this.state.value.isUserAway) {
			return true;
		}

		// Otherwise, user seems active
		return false;
	}

	/**
	 * Play audio notification
	 */
	private async playAudioNotification(preferences: StatementCompletionNotifications): Promise<void> {
		try {
			console.log('NotificationManager: Playing audio notification');

			const audioUrl = preferences.customAudioUrl || this.config.defaultAudioPath;
			const audioVolume = preferences.audioVolume || 0.5;

			// Try Web Audio API first for better control
			if (this.audioContext) {
				await this.playAudioWithWebAudio(audioUrl, audioVolume);
			} else {
				// Fallback to HTML Audio API
				await this.playAudioWithHTMLAudio(audioUrl, audioVolume);
			}

			console.log('NotificationManager: Audio notification played successfully');
		} catch (error) {
			console.error('NotificationManager: Failed to play audio:', error);
			throw new Error('Audio notification failed');
		}
	}

	/**
	 * Play audio using Web Audio API
	 */
	private async playAudioWithWebAudio(url: string, audioVolume: number): Promise<void> {
		if (!this.audioContext) {
			throw new Error('AudioContext not available');
		}
		//console.log('NotificationManager: playing web audio from url: ', url);

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch audio: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

		const source = this.audioContext.createBufferSource();
		const gainNode = this.audioContext.createGain();

		source.buffer = audioBuffer;
		gainNode.gain.value = audioVolume;

		source.connect(gainNode);
		gainNode.connect(this.audioContext.destination);

		source.start(0);
	}

	/**
	 * Play audio using HTML Audio API (fallback)
	 */
	private playAudioWithHTMLAudio(url: string, audioVolume: number): Promise<void> {
		return new Promise((resolve, reject) => {
			//console.log('NotificationManager: playing html audio from url: ', url);

			const audio = new Audio(url);
			audio.volume = audioVolume;

			audio.addEventListener('canplaythrough', () => {
				audio.play()
					.then(() => resolve())
					.catch(reject);
			});

			audio.addEventListener('error', (e) => {
				reject(new Error(`Audio playback failed: ${e}`));
			});

			audio.load();
		});
	}

	/**
	 * Show browser notification
	 */
	private async showBrowserNotification(message: string): Promise<void> {
		//if (!this.state.value.hasPermission) {
		//	throw new Error('Notification permission not granted');
		//}

		try {
			console.log('NotificationManager: Showing browser notification');

			const notification = new Notification('Beyond Better', {
				body: message,
				icon: '/logo-light.png',
				badge: '/logo-light.png',
				tag: 'bb-statement-complete',
				requireInteraction: true, // Keep notification until user interacts
				data: {
					timestamp: Date.now(),
					type: 'statement-complete',
				},
			});

			// // Auto-close after 10 seconds if user doesn't interact
			// setTimeout(() => {
			// 	notification.close();
			// }, 10000);

			// Optional: Handle notification click
			notification.onclick = () => {
				globalThis.focus();
				notification.close();
			};

			console.log('NotificationManager: Browser notification sent');
		} catch (error) {
			console.error('NotificationManager: Failed to show browser notification:', error);
			throw error;
		}
	}

	/**
	 * Show prominent visual indicators
	 */
	private async showVisualIndicators(): Promise<void> {
		console.log('NotificationManager: Showing visual indicators');

		// Update unread count
		this.state.value = {
			...this.state.value,
			unreadCount: this.state.value.unreadCount + 1,
		};

		// Update page title
		this.updatePageTitle();

		// Update favicon if available
		this.updateFavicon();

		// Auto-clear after timeout
		if (this.indicatorTimeout) {
			clearTimeout(this.indicatorTimeout);
		}

		this.indicatorTimeout = setTimeout(() => {
			this.clearNotifications();
		}, this.config.indicatorTimeoutMs);
	}

	/**
	 * Show subtle visual indicator for active users
	 */
	private showSubtleVisualIndicator(): void {
		console.log('NotificationManager: Showing subtle visual indicator');

		// Brief title flash
		const originalTitle = document.title;
		document.title = '✅ Complete - ' + originalTitle;

		setTimeout(() => {
			document.title = originalTitle;
		}, 3000); // 3 seconds
	}

	/**
	 * Update page title with notification indicator
	 */
	private updatePageTitle(): void {
		const count = this.state.value.unreadCount;
		const prefix = count > 1 ? `(${count}) ✅ ` : '✅ ';
		document.title = prefix + this.state.value.originalTitle;
	}

	/**
	 * Reset page title to original
	 */
	private resetPageTitle(): void {
		document.title = this.state.value.originalTitle;
	}

	/**
	 * Update favicon with notification badge
	 */
	private updateFavicon(): void {
		try {
			// This is a simple approach - in a more sophisticated implementation,
			// you might generate a favicon with a notification badge overlay
			const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
			if (link) {
				// For now, just ensure we can revert later
				// A more advanced implementation would draw a badge on the favicon
				console.log('NotificationManager: Favicon update placeholder');
			}
		} catch (error) {
			console.warn('NotificationManager: Failed to update favicon:', error);
		}
	}

	/**
	 * Reset favicon to original
	 */
	private resetFavicon(): void {
		try {
			const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
			if (link && this.state.value.originalFavicon) {
				link.href = this.state.value.originalFavicon;
			}
		} catch (error) {
			console.warn('NotificationManager: Failed to reset favicon:', error);
		}
	}

	/**
	 * Get current favicon URL
	 */
	private getCurrentFavicon(): string {
		const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
		return link?.href || '';
	}

	/**
	 * Set up page visibility and focus event listeners
	 */
	private setupEventListeners(): void {
		// Page visibility
		document.addEventListener('visibilitychange', () => {
			const isVisible = !document.hidden;
			this.state.value = {
				...this.state.value,
				isPageVisible: isVisible,
			};

			// Clear notifications when user returns to page
			if (isVisible) {
				this.clearNotifications();
				this.updateUserActivity();
			}

			console.log('NotificationManager: Page visibility changed:', isVisible);
		});

		// Window focus
		globalThis.addEventListener('focus', () => {
			this.clearNotifications();
			this.updateUserActivity();
		});

		// User activity events
		const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
		activityEvents.forEach((event) => {
			document.addEventListener(event, () => {
				this.updateUserActivity();
			}, { passive: true });
		});
	}

	/**
	 * Set up audio context (requires user interaction)
	 */
	private setupAudioContext(): void {
		// Audio context can only be created after user interaction
		const createAudioContext = () => {
			if (!this.audioContext) {
				try {
					this.audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();
					console.log('NotificationManager: AudioContext created');
				} catch (error) {
					console.warn('NotificationManager: Failed to create AudioContext:', error);
				}
			}
		};

		// Create on first user interaction
		const firstInteractionEvents = ['click', 'keydown', 'touchstart'];
		const handleFirstInteraction = () => {
			createAudioContext();
			firstInteractionEvents.forEach((event) => {
				document.removeEventListener(event, handleFirstInteraction);
			});
		};

		firstInteractionEvents.forEach((event) => {
			document.addEventListener(event, handleFirstInteraction, { once: true });
		});
	}

	/**
	 * Track user activity to determine if they're away
	 */
	private startUserActivityTracking(): void {
		this.updateUserActivity(); // Initial activity

		// Check periodically if user is away
		setInterval(() => {
			const timeSinceActivity = Date.now() - this.lastUserActivity;
			const isAway = timeSinceActivity > this.config.awayTimeoutMs;

			if (isAway !== this.state.value.isUserAway) {
				this.state.value = {
					...this.state.value,
					isUserAway: isAway,
				};
				console.log('NotificationManager: User away status changed:', isAway);
			}
		}, 5000); // Check every 5 seconds
	}

	/**
	 * Update last user activity timestamp
	 */
	private updateUserActivity(): void {
		this.lastUserActivity = Date.now();

		if (this.state.value.isUserAway) {
			this.state.value = {
				...this.state.value,
				isUserAway: false,
			};
		}
	}

	/**
	 * Clean up resources
	 */
	public dispose(): void {
		if (this.userActivityTimeout) {
			clearTimeout(this.userActivityTimeout);
		}
		if (this.indicatorTimeout) {
			clearTimeout(this.indicatorTimeout);
		}
		if (this.audioContext) {
			this.audioContext.close();
		}
		this.clearNotifications();
	}
}

// Export singleton instance
//export const notificationManager = await new NotificationManager().initialize();
export const notificationManager = new NotificationManager();

/**
 * Hook for components to use notifications
 */
export function useNotificationManager() {
	return {
		state: notificationManager.getState(),
		initialize: () => notificationManager.initialize(),
		notifyStatementComplete: (message?: string) => notificationManager.notifyStatementComplete(message),
		clearNotifications: () => notificationManager.clearNotifications(),
		requestPermission: () => notificationManager.requestNotificationPermission(),
		testNotifications: () => notificationManager.testNotifications(),
	};
}
