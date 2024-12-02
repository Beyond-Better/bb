import { compare, parse } from '@std/semver';
import { VERSION } from 'version.ts';
import { VersionCompatibility, VersionInfo } from '../types/version.types.ts';
import { canAutoUpdate, detectInstallLocation } from './installLocation.ts';
import { ConfigManager } from 'shared/configManager.ts';

/**
 * Gets the current version information including installation location and auto-update capability
 * @returns Promise<VersionInfo>
 */
export async function getVersionInfo(): Promise<VersionInfo> {
	const installLocation = await detectInstallLocation();
	const autoUpdatePossible = await canAutoUpdate();

	return {
		version: VERSION,
		installLocation,
		canAutoUpdate: autoUpdatePossible,
	};
}

export async function checkVersionCompatibility(requiredVersion: string): Promise<VersionCompatibility> {
	const { version: currentVersion } = await getVersionInfo();

	// Compare versions
	const current = parse(currentVersion);
	const required = parse(requiredVersion);

	// Compatible if current version is equal to or higher than required
	const compatible = compare(current, required) >= 0;

	// For now, we're not checking for latest version
	// This will be implemented when we add update checking
	return {
		compatible,
		currentVersion,
		requiredVersion,
		updateAvailable: false,
	};
}
