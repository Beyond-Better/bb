import { computed } from '@preact/signals';
import { compare, parse } from '@std/semver';
//import type { VersionCompatibility } from 'shared/types/version.ts';
import { useAppState } from './useAppState.ts';

export function useVersion() {
	const appState = useAppState();

	const versionCompatibility = computed(() => {
		const versionInfo = appState.value.versionInfo;
		if (!versionInfo) return null;

		const current = parse(versionInfo.version);
		const required = parse(versionInfo.minVersion);
		const comparison = compare(current, required);

		// Compatible if current version is equal to or higher than required
		const compatible = comparison >= 0;

		return {
			compatible,
			currentVersion: versionInfo.version,
			requiredVersion: versionInfo.minVersion,
			updateAvailable: !compatible && versionInfo.canAutoUpdate,
			latestVersion: undefined, // Will be set when available
		};
	});

	return {
		versionInfo: appState.value.versionInfo,
		versionCompatibility: versionCompatibility.value,
	};
}
