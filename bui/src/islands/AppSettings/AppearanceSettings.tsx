/**
 * Appearance Settings Component
 *
 * Allows users to configure theme preferences and other appearance settings.
 * Uses the userPersistence system to save theme preferences.
 */

import { useEffect, useState } from 'preact/hooks';
import { JSX } from 'preact';
import { type UserPreferences, useUserPersistence } from '../../storage/userPersistence.ts';
import { Toast } from '../../components/Toast.tsx';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { useAppState } from '../../hooks/useAppState.ts';

interface AppearanceSettingsProps {
	className?: string;
}

type ThemeOption = 'light' | 'dark' | 'system';

const THEME_OPTIONS: Array<{
	value: ThemeOption;
	label: string;
	description: string;
	icon: string;
}> = [
	{
		value: 'light',
		label: 'Light',
		description: 'Use light theme',
		icon:
			'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
	},
	{
		value: 'dark',
		label: 'Dark',
		description: 'Use dark theme',
		icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
	},
	{
		value: 'system',
		label: 'System',
		description: 'Follow system preference',
		icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM21 17a2 2 0 11-4 0 2 2 0 014 0z M3 17h2m8 0h2m6 0h2M3 12h18M3 7h18',
	},
];

export function AppearanceSettings({ className = '' }: AppearanceSettingsProps): JSX.Element {
	const { authState } = useAuthState();
	const appState = useAppState();
	const {
		state: persistenceState,
		savePreferences,
		loadPreferences,
		initialize,
		saveThemePreference,
		getCurrentTheme,
	} = useUserPersistence();

	const [currentTheme, setCurrentTheme] = useState<ThemeOption>('system');
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

				console.log('AppearanceSettings: Initialization complete');
			} catch (error) {
				console.error('AppearanceSettings: Failed to initialize:', error);
			} finally {
				setIsInitializing(false);
			}
		}

		initializePersistence();
	}, [authState.value.isLocalMode, appState.value.apiClient]);

	// Load theme when preferences are available
	useEffect(() => {
		if (persistenceState.value.preferences?.theme) {
			setCurrentTheme(persistenceState.value.preferences.theme);
		} else if (!persistenceState.value.isLoading && !isInitializing) {
			// If we're not loading and have no preferences, use default
			setCurrentTheme('system');
		}
	}, [persistenceState.value.preferences, persistenceState.value.isLoading, isInitializing]);

	// Show toast helper
	const showToastMessage = (message: string, type: 'success' | 'error' = 'success') => {
		setToastMessage(message);
		setToastType(type);
		setShowToast(true);
	};

	// Save theme preference and apply it immediately
	const saveTheme = async (theme: ThemeOption) => {
		setIsSaving(true);
		try {
			// Use the new theme-specific save method that applies theme immediately
			await saveThemePreference(theme);
			setCurrentTheme(theme);
			showToastMessage('Theme preference saved and applied successfully');
		} catch (error) {
			console.error('Failed to save theme preference:', error);
			showToastMessage('Failed to save theme preference. Please try again.', 'error');
		} finally {
			setIsSaving(false);
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
	if (persistenceState.value.error) {
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

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Header */}
			<div>
				<h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
					Appearance Settings
				</h3>
				<p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
					Customize the look and feel of BB
				</p>
			</div>

			{/* Theme Selection */}
			<div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
				<div className='mb-4'>
					<h4 className='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>
						Theme
					</h4>
					<p className='text-sm text-gray-500 dark:text-gray-400'>
						Choose your preferred color scheme
					</p>
				</div>

				<div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
					{THEME_OPTIONS.map((option) => (
						<button
							key={option.value}
							type='button'
							onClick={() => saveTheme(option.value)}
							disabled={isSaving}
							className={`relative rounded-lg border p-4 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
								currentTheme === option.value
									? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
									: 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
							} ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
						>
							<div className='flex items-center space-x-3'>
								<div className='flex-shrink-0'>
									<svg
										className={`w-5 h-5 ${
											currentTheme === option.value
												? 'text-blue-600 dark:text-blue-400'
												: 'text-gray-400 dark:text-gray-500'
										}`}
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d={option.icon}
										/>
									</svg>
								</div>
								<div className='text-left'>
									<div
										className={`text-sm font-medium ${
											currentTheme === option.value
												? 'text-blue-900 dark:text-blue-200'
												: 'text-gray-900 dark:text-gray-100'
										}`}
									>
										{option.label}
									</div>
									<div
										className={`text-xs ${
											currentTheme === option.value
												? 'text-blue-700 dark:text-blue-300'
												: 'text-gray-500 dark:text-gray-400'
										}`}
									>
										{option.description}
									</div>
								</div>
							</div>
							{/* Selected indicator */}
							{currentTheme === option.value && (
								<div className='absolute top-2 right-2'>
									<svg
										className='w-4 h-4 text-blue-600 dark:text-blue-400'
										fill='currentColor'
										viewBox='0 0 20 20'
									>
										<path
											fillRule='evenodd'
											d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
											clipRule='evenodd'
										/>
									</svg>
								</div>
							)}
						</button>
					))}
				</div>
			</div>

			{/* Additional Info */}
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
							Theme Information
						</h4>
						<div className='mt-2 text-sm text-blue-800 dark:text-blue-300 space-y-1'>
							<p>
								• <strong>Light:</strong> Always use the light color scheme
							</p>
							<p>
								• <strong>Dark:</strong> Always use the dark color scheme
							</p>
							<p>
								• <strong>System:</strong> Automatically match your device's theme preference
							</p>
							<p>
								• Your theme preference is saved{' '}
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
