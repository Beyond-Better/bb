import { REQUIRED_API_VERSION, VERSION } from 'version.ts';

export type InstallLocationType = 'user' | 'system';

export interface VersionInfo {
	version: string;
	minVersion: string;
	installLocation: InstallLocationType;
	canAutoUpdate: boolean;
}

export interface VersionCompatibility {
	compatible: boolean;
	currentVersion: string;
	requiredVersion: string;
	updateAvailable: boolean;
	latestVersion?: string;
}

// Default version info - will be updated with actual install location
export const DEFAULT_VERSION_INFO: VersionInfo = {
	version: VERSION,
	minVersion: REQUIRED_API_VERSION,
	installLocation: 'system', // Default assumption
	canAutoUpdate: false, // Default to false until confirmed
};

export interface SystemMeta {
	os: 'windows' | 'darwin' | 'linux';
	pathSeparator: string;
	apiVersion: string;
}
