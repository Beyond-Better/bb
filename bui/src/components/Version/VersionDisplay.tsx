import { JSX } from 'preact';
import { useVersion } from '../../hooks/useVersion.ts';
import { CompactVersion } from './VersionInfo.tsx';
// VersionWarning moved to SideNav
import type { ApiClient, ApiUpgradeResponse } from '../../utils/apiClient.utils.ts';

interface VersionDisplayProps {
	className?: string;
	apiClient: ApiClient;
}

export function VersionDisplay({ className = '', apiClient }: VersionDisplayProps): JSX.Element {
	const { versionInfo, versionCompatibility } = useVersion();

	if (!versionInfo) return <></>;

	// Version compatibility is now computed directly

	return (
		<div className={`relative ${className}`}>
			<div className='flex items-center gap-2'>
				<VersionStatusIndicator />
				<CompactVersion version={versionInfo.version} />
			</div>
		</div>
	);
}

interface VersionStatusIndicatorProps {
	className?: string;
}

export function VersionStatusIndicator({ className = '' }: VersionStatusIndicatorProps): JSX.Element {
	const { versionCompatibility } = useVersion();

	if (!versionCompatibility) return <></>;

	const { compatible } = versionCompatibility;

	return (
		<div
			className={`w-2 h-2 rounded-full ${
				compatible ? 'bg-green-500 dark:bg-green-400' : 'bg-yellow-500 dark:bg-yellow-400 animate-pulse'
			} ${className ?? ''}`}
			title={compatible ? 'Version compatible' : 'Version mismatch'}
		/>
	);
}
