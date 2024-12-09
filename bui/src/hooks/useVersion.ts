import { Signal, signal } from '@preact/signals';
import { compare, parse } from '@std/semver';
import type { VersionCompatibility } from 'shared/types/version.ts';
import { useAppState } from './useAppState.ts';

interface VersionState {
    versionCompatibility: VersionCompatibility | null;
}

const versionState = signal<VersionState>({
    versionCompatibility: null,
});

export function useVersion() {
    const appState = useAppState();

    const checkVersionCompatibility = () => {
        const versionInfo = appState.value.versionInfo;
        if (!versionInfo) return;

        const current = parse(versionInfo.version);
        const required = parse(versionInfo.minVersion);
        const comparison = compare(current, required);

        // Compatible if current version is equal to or higher than required
        const compatible = comparison >= 0;

        versionState.value = {
            versionCompatibility: {
                compatible,
                currentVersion: versionInfo.version,
                requiredVersion: versionInfo.minVersion,
                updateAvailable: !compatible && versionInfo.canAutoUpdate,
                latestVersion: undefined, // Will be set when available
            },
        };
    };

    return {
        versionState,
        versionInfo: appState.value.versionInfo,
        versionCompatibility: versionState.value.versionCompatibility,
        checkVersionCompatibility,
    };
}