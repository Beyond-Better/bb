import { Signal, signal } from '@preact/signals';
import { REQUIRED_API_VERSION } from '../config/version.ts';
import { compare, parse, SemVer } from '@std/semver';
import type { VersionCompatibility, VersionInfo } from 'shared/types/version.ts';

interface VersionState {
	versionInfo: VersionInfo | null;
	versionCompatibility: VersionCompatibility | null;
}

const versionState = signal<VersionState>({
	versionInfo: null,
	versionCompatibility: null,
});

export function useVersion() {
	const setVersionInfo = (info: VersionInfo) => {
		// Always check compatibility with required version when version info changes
		const current = parse(info.version);
		const required = parse(REQUIRED_API_VERSION);
		const comparison = compare(current, required);

		// Compatible if current version is equal to or higher than required
		const compatible = comparison >= 0;

		const compatibility: VersionCompatibility = {
			compatible,
			currentVersion: info.version,
			requiredVersion: REQUIRED_API_VERSION,
			updateAvailable: !compatible && info.canAutoUpdate,
			latestVersion: undefined, // Will be set when available
		};

		versionState.value = {
			...versionState.value,
			versionInfo: info,
			versionCompatibility: compatibility,
		};
	};

	const checkVersionCompatibility = (requiredVersion: string) => {
		if (!versionState.value.versionInfo) return;

		const current = versionState.value.versionInfo.version;
		const comparison = compare(parse(current), parse(requiredVersion));

		// Compatible if current version is equal to or higher than required
		const compatible = comparison >= 0;

		versionState.value = {
			...versionState.value,
			versionCompatibility: {
				compatible,
				currentVersion: current,
				requiredVersion,
				updateAvailable: false, // Will be set when we implement update checking
				latestVersion: undefined, // Will be set when we implement update checking
			},
		};
	};

	return {
		versionState,
		versionInfo: versionState.value.versionInfo,
		versionCompatibility: versionState.value.versionCompatibility,
		setVersionInfo,
		checkVersionCompatibility,
	};
}
