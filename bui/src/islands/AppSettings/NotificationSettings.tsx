/**
 * Notification Settings Component
 *
 * Allows users to configure notification preferences including audio, browser notifications,
 * and visual indicators for when BB completes processing statements.
 */

import { useEffect, useState } from 'preact/hooks';
import { JSX } from 'preact';
import { type StatementCompletionNotifications, useUserPersistence } from '../../storage/userPersistence.ts';
import { useNotificationManager } from '../../utils/notificationManager.ts';
import { Toast } from '../../components/Toast.tsx';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { useAppState } from '../../hooks/useAppState.ts';

interface NotificationSettingsProps {
	className?: string;
}

export function NotificationSettings({ className = '' }: NotificationSettingsProps): JSX.Element {
	const { authState } = useAuthState();
	const appState = useAppState();
	const {
		state: persistenceState,
		updateNotificationPreferences,
		loadPreferences,
		initialize,
	} = useUserPersistence();
	const { state: notificationState, requestPermission, testNotifications, initialize: notificationInitialize } =
		useNotificationManager();

	const [localPreferences, setLocalPreferences] = useState<StatementCompletionNotifications | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isInitializing, setIsInitializing] = useState(true);
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [toastType, setToastType] = useState<'success' | 'error'>('success');

	// Initialize user persistence when component mounts
	useEffect(() => {
		async function initializePersistence() {
			try {
				setIsInitializing(true);

				// Determine if we're in local mode
				const isLocalMode = authState.value.isLocalMode || !appState.value.apiClient;

				// Initialize the persistence manager
				initialize(appState.value.apiClient, isLocalMode);

				// Load preferences
				await loadPreferences();

				await notificationInitialize();

				console.log('NotificationSettings: Initialization complete');
			} catch (error) {
				console.error('NotificationSettings: Failed to initialize:', error);
			} finally {
				setIsInitializing(false);
			}
		}

		initializePersistence();
	}, [authState.value.isLocalMode, appState.value.apiClient]);

	// Load preferences when available
	useEffect(() => {
		if (persistenceState.value.preferences?.notifications?.statement_completion) {
			setLocalPreferences(persistenceState.value.preferences.notifications.statement_completion);
		} else if (!persistenceState.value.isLoading && !isInitializing) {
			// If we're not loading and have no preferences, set defaults
			const defaultNotifications: StatementCompletionNotifications = {
				audioEnabled: true,
				browserNotifications: true,
				visualIndicators: true,
				audioVolume: 0.5,
			};
			setLocalPreferences(defaultNotifications);
		}
	}, [persistenceState.value.preferences, persistenceState.value.isLoading, isInitializing]);

	// Show toast helper
	const showToastMessage = (message: string, type: 'success' | 'error' = 'success') => {
		setToastMessage(message);
		setToastType(type);
		setShowToast(true);
	};

	// Save preferences
	const savePreferences = async (newPreferences: Partial<StatementCompletionNotifications>) => {
		if (!localPreferences) return;

		setIsSaving(true);
		try {
			const updated = { ...localPreferences, ...newPreferences };
			await updateNotificationPreferences(updated);
			setLocalPreferences(updated);
			showToastMessage('Notification settings saved successfully');
		} catch (error) {
			console.error('Failed to save notification preferences:', error);
			showToastMessage('Failed to save settings. Please try again.', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	// Handle audio toggle
	const handleAudioToggle = async (enabled: boolean) => {
		await savePreferences({ audioEnabled: enabled });
	};

	// Handle browser notifications toggle
	const handleBrowserNotificationsToggle = async (enabled: boolean) => {
		if (enabled && !notificationState.value.hasPermission) {
			// Request permission first
			const granted = await requestPermission();
			if (!granted) {
				showToastMessage('Browser notification permission denied. Please enable in browser settings.', 'error');
				return;
			}
		}
		await savePreferences({ browserNotifications: enabled });
	};

	// Handle visual indicators toggle
	const handleVisualIndicatorsToggle = async (enabled: boolean) => {
		await savePreferences({ visualIndicators: enabled });
	};

	// Handle volume change
	const handleVolumeChange = async (audioVolume: number) => {
		await savePreferences({ audioVolume });
	};

	// Handle custom audio URL change
	const handleCustomAudioChange = async (customAudioUrl: string) => {
		await savePreferences({ customAudioUrl: customAudioUrl || undefined });
	};

	// Test notifications
	const handleTestNotifications = async () => {
		try {
			const granted = await requestPermission();
			if (!granted) {
				showToastMessage('Browser notification permission denied. Please enable in browser settings.', 'error');
				return;
			}
			await testNotifications();
			showToastMessage('Test notification sent! Check if you received it.');
		} catch (error) {
			console.error('Failed to test notifications:', error);
			showToastMessage('Failed to test notifications. Please check your settings.', 'error');
		}
	};

	// Show loading state during initialization
	if (isInitializing || persistenceState.value.isLoading) {
		return (
			<div className={`animate-pulse ${className}`}>
				<div className='space-y-4'>
					<div className='h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2'></div>
					<div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4'></div>
					<div className='space-y-3'>
						<div className='h-16 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div className='h-16 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div className='h-16 bg-gray-200 dark:bg-gray-700 rounded'></div>
					</div>
				</div>
			</div>
		);
	}

	// Show error state if failed to load
	if (!localPreferences && persistenceState.value.error) {
		return (
			<div className={`${className}`}>
				<div className='bg-red-50 dark:bg-red-900/20 rounded-lg p-4'>
					<div className='flex items-center space-x-3'>
						<svg
							className='w-5 h-5 text-red-600 dark:text-red-400'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
						<div>
							<h4 className='text-sm font-medium text-red-900 dark:text-red-200'>
								Error Loading Settings
							</h4>
							<p className='text-sm text-red-800 dark:text-red-300'>{persistenceState.value.error}</p>
							<button
								type='button'
								onClick={() => loadPreferences()}
								className='mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline'
							>
								Try Again
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Ensure we have preferences before rendering the main UI
	if (!localPreferences) {
		return (
			<div className={`text-center py-8 ${className}`}>
				<p className='text-gray-500 dark:text-gray-400'>Loading notification settings...</p>
			</div>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Header */}
			<div className='flex items-center justify-between'>
				<div>
					<h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
						Notification Settings
					</h3>
					<p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Configure how you want to be notified when BB finishes processing your statements
					</p>
				</div>
				<button
					type='button'
					onClick={handleTestNotifications}
					className='px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'
				>
					Test Notifications
				</button>
			</div>

			{/* Audio Notifications */}
			<div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center space-x-3'>
						<div className='flex-shrink-0'>
							<svg
								className='w-5 h-5 text-gray-600 dark:text-gray-400'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5 7h4l1-1v12l-1-1H5a2 2 0 01-2-2V9a2 2 0 012-2z'
								/>
							</svg>
						</div>
						<div>
							<h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
								Audio Notifications
							</h4>
							<p className='text-sm text-gray-500 dark:text-gray-400'>
								Play a sound when processing completes
							</p>
						</div>
					</div>
					<label className='relative inline-flex items-center cursor-pointer'>
						<input
							type='checkbox'
							className='sr-only peer'
							checked={localPreferences.audioEnabled}
							onChange={(e) => handleAudioToggle((e.target as HTMLInputElement).checked)}
							disabled={isSaving}
						/>
						<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600">
						</div>
					</label>
				</div>

				{/* Volume Control */}
				{localPreferences.audioEnabled && (
					<div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-600'>
						<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
							Volume: {Math.round(localPreferences.audioVolume * 100)}%
						</label>
						<input
							type='range'
							min='0'
							max='1'
							step='0.1'
							value={localPreferences.audioVolume}
							onChange={(e) => handleVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
							className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider'
							disabled={isSaving}
						/>
					</div>
				)}

				{/* Custom Audio URL */}
				{localPreferences.audioEnabled && (
					<div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-600'>
						<label
							htmlFor='custom-audio'
							className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
						>
							Custom Audio URL (optional)
						</label>
						<input
							id='custom-audio'
							type='url'
							value={localPreferences.customAudioUrl || ''}
							onChange={(e) => handleCustomAudioChange((e.target as HTMLInputElement).value)}
							placeholder='https://example.com/custom-sound.mp3'
							className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500'
							disabled={isSaving}
						/>
						<p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
							Leave empty to use the default notification sound
						</p>
					</div>
				)}
			</div>

			{/* Browser Notifications */}
			<div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center space-x-3'>
						<div className='flex-shrink-0'>
							<svg
								className='w-5 h-5 text-gray-600 dark:text-gray-400'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15 17h5l-5 5v-5zM4 19h6v-2H4v2zM16 13h2a2 2 0 002-2V9a2 2 0 00-2-2h-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2H4a2 2 0 00-2 2v2a2 2 0 002 2h2v2a2 2 0 002 2h8a2 2 0 002-2v-2z'
								/>
							</svg>
						</div>
						<div>
							<h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
								Browser Notifications
							</h4>
							<p className='text-sm text-gray-500 dark:text-gray-400'>
								Show system notifications even when BB is in the background
							</p>
						</div>
					</div>
					<label className='relative inline-flex items-center cursor-pointer'>
						<input
							type='checkbox'
							className='sr-only peer'
							checked={localPreferences.browserNotifications}
							onChange={(e) => handleBrowserNotificationsToggle((e.target as HTMLInputElement).checked)}
							disabled={isSaving}
						/>
						<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600">
						</div>
					</label>
				</div>

				{/* Permission Status */}
				{localPreferences.browserNotifications && (
					<div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-600'>
						<div className='flex items-center space-x-2'>
							<div
								className={`w-2 h-2 rounded-full ${
									notificationState.value.hasPermission ? 'bg-green-500' : 'bg-red-500'
								}`}
							>
							</div>
							<span className='text-sm text-gray-600 dark:text-gray-400'>
								{notificationState.value.hasPermission
									? 'Permission granted'
									: 'Permission required - click test button to grant'}
							</span>
						</div>
					</div>
				)}
			</div>

			{/* Visual Indicators */}
			<div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center space-x-3'>
						<div className='flex-shrink-0'>
							<svg
								className='w-5 h-5 text-gray-600 dark:text-gray-400'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
								/>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
								/>
							</svg>
						</div>
						<div>
							<h4 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
								Visual Indicators
							</h4>
							<p className='text-sm text-gray-500 dark:text-gray-400'>
								Update browser tab title and favicon when processing completes
							</p>
						</div>
					</div>
					<label className='relative inline-flex items-center cursor-pointer'>
						<input
							type='checkbox'
							className='sr-only peer'
							checked={localPreferences.visualIndicators}
							onChange={(e) => handleVisualIndicatorsToggle((e.target as HTMLInputElement).checked)}
							disabled={isSaving}
						/>
						<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600">
						</div>
					</label>
				</div>
			</div>

			{/* Status Information */}
			<div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4'>
				<div className='flex items-start space-x-3'>
					<div className='flex-shrink-0'>
						<svg
							className='w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
					</div>
					<div>
						<h4 className='text-sm font-medium text-blue-900 dark:text-blue-200'>
							How it works
						</h4>
						<div className='mt-2 text-sm text-blue-800 dark:text-blue-300 space-y-1'>
							<p>• Notifications are triggered when BB finishes processing your statements</p>
							<p>• They only appear when you seem to be away from the page</p>
							<p>• All notifications clear automatically when you return to BB</p>
							<p>
								• Your preferences are saved{' '}
								{persistenceState.value.isLocalMode ? 'locally' : 'to your account'}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Error State */}
			{persistenceState.value.error && (
				<div className='bg-red-50 dark:bg-red-900/20 rounded-lg p-4'>
					<div className='flex items-center space-x-3'>
						<svg
							className='w-5 h-5 text-red-600 dark:text-red-400'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
						<div>
							<h4 className='text-sm font-medium text-red-900 dark:text-red-200'>Error</h4>
							<p className='text-sm text-red-800 dark:text-red-300'>{persistenceState.value.error}</p>
						</div>
					</div>
				</div>
			)}

			{/* Toast */}
			{showToast && (
				<Toast
					message={toastMessage}
					type={toastType}
					duration={3000}
					onClose={() => setShowToast(false)}
				/>
			)}
		</div>
	);
}
