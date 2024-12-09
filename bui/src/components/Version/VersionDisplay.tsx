import { JSX } from 'preact';
import { useVersion } from '../../hooks/useVersion.ts';
import { CompactVersion } from './VersionInfo.tsx';
import { VersionWarning } from './VersionWarning.tsx';
import type { ApiClient, ApiUpgradeResponse } from '../../utils/apiClient.utils.ts';

interface VersionDisplayProps {
	className?: string;
	showWarning?: boolean;
	apiClient: ApiClient;
}

export function VersionDisplay({ className = '', showWarning = true, apiClient }: VersionDisplayProps): JSX.Element {
	const { versionState, versionInfo } = useVersion();
	//console.log('versionState', versionState.value);

	if (!versionInfo) return <></>;

	const versionCompatibility = versionState.value.versionCompatibility;
	//console.log('VersionDisplay: versionCompatibility', versionCompatibility);

	return (
		<div className={`relative ${className}`}>
			<div className='flex items-center gap-2'>
				<VersionStatusIndicator />
				<CompactVersion version={versionInfo.version} />
			</div>

			{showWarning && versionCompatibility && !versionCompatibility.compatible && (
				<div className='absolute top-full right-0 mt-2 w-80 z-50'>
					<VersionWarning
						apiClient={apiClient}
						className='shadow-lg'
					/>
				</div>
			)}
		</div>
	);
}

interface VersionStatusIndicatorProps {
	className?: string;
}

export function VersionStatusIndicator({ className = '' }: VersionStatusIndicatorProps): JSX.Element {
	const { versionState } = useVersion();
	const versionCompatibility = versionState.value.versionCompatibility;

	if (!versionCompatibility) return <></>;

	const { compatible } = versionCompatibility;

	return (
		<div
			className={`w-2 h-2 rounded-full ${compatible ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'} ${
				className ?? ''
			}`}
			title={compatible ? 'Version compatible' : 'Version mismatch'}
		/>
	);
}
