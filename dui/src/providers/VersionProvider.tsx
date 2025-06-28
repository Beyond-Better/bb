import { createContext, JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import type { VersionInfo, VersionState, VersionCompatibility, DuiUpdateInfo } from '../types/version';

const initialState: VersionState = {
	versionInfo: undefined,
	versionCompatibility: undefined,
	duiUpdateInfo: undefined,
	error: undefined,
};

export const VersionContext = createContext<{
	versionState: { value: VersionState };
	checkForUpdates: () => Promise<void>;
	isCheckingUpdates: boolean;
}>({
	versionState: { value: initialState },
	checkForUpdates: async () => {},
	isCheckingUpdates: false,
});

interface VersionProviderProps {
	children: JSX.Element | JSX.Element[];
}

export function VersionProvider({ children }: VersionProviderProps): JSX.Element {
	const [versionState, setVersionState] = useState<{ value: VersionState }>({
		value: initialState,
	});
	const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

	const checkVersion = useCallback(async () => {
		if (isCheckingUpdates) {
			console.log('[VersionProvider] Skip check - already checking');
			return;
		}
		
		console.log('[VersionProvider] Starting version check');
		setIsCheckingUpdates(true);
		try {
			console.log('[VersionProvider] Starting version info check');
			// Get version info from Tauri command
			const versionInfo = await invoke<VersionInfo>('get_version_info');
			console.log('[VersionProvider] Version info:', versionInfo);

			// Get binary version
			try {
				const binaryVersion = await invoke<string | null>('get_binary_version');
				versionInfo.binaryVersion = binaryVersion;
				console.log('[VersionProvider] Binary version:', binaryVersion);
			} catch (error) {
				console.log('[VersionProvider] Binary check failed:', error);
				versionInfo.binaryVersion = null;
			}

			// Get compatibility info from Tauri command
			let versionCompatibility: VersionCompatibility;
			try {
				versionCompatibility = await invoke<VersionCompatibility>('check_version_compatibility');
				console.log('[VersionProvider] Version compatibility:', versionCompatibility);
			} catch (error) {
				console.log('[VersionProvider] Compatibility check failed:', error);
				versionCompatibility = {
					compatible: false,
					currentVersion: 'not installed',
					requiredVersion: '0.0.0',
					updateAvailable: false,
					latestVersion: null
				};
			}

			// Check for DUI updates
			let duiUpdateInfo: DuiUpdateInfo | null = null;
			try {
				duiUpdateInfo = await invoke<DuiUpdateInfo | null>('check_dui_update');
				console.log('[VersionProvider] DUI update info:', duiUpdateInfo);
			} catch (error) {
				console.log('[VersionProvider] DUI update check failed:', error);
				// Not a critical error, continue without DUI update info
			}

			console.log('[VersionProvider] Setting version state with:', {
				versionInfo,
				versionCompatibility,
				duiUpdateInfo
			});
			setVersionState({
				value: {
					versionInfo,
					versionCompatibility,
					duiUpdateInfo,
					error: undefined,
				},
			});
			console.log('[VersionProvider] State updated successfully');
		} catch (error) {
			console.log('[VersionProvider] Error in version check:', error);
			console.error('[VersionProvider] Error checking version:', error);
			setVersionState({
				value: {
					...initialState,
					error: (error as Error).message,
				},
			});
		} finally {
			setIsCheckingUpdates(false);
		}
	}, [isCheckingUpdates]);

	// Initial version check - only run once
	useEffect(() => {
		console.log('[VersionProvider] Running initial version check');
		checkVersion();
	}, []); // Remove checkVersion from dependencies

	// Periodic version check (every 5 minutes)
	useEffect(() => {
		console.log('[VersionProvider] Setting up periodic version check');
		const interval = setInterval(() => {
			console.log('[VersionProvider] Running periodic version check');
			checkVersion();
		}, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, []); // Remove checkVersion from dependencies

	return (
		<VersionContext.Provider 
			value={{ 
				versionState, 
				checkForUpdates: checkVersion,
				isCheckingUpdates
			}}
		>
			{children}
		</VersionContext.Provider>
	);
}