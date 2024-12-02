import { JSX } from 'preact';
import { VersionInfo as VersionInfoType } from 'shared/types/version.ts';

interface VersionInfoProps {
	versionInfo: VersionInfoType;
	className?: string;
}

export function VersionInfo({ versionInfo, className = '' }: VersionInfoProps): JSX.Element {
	const { version, installLocation, canAutoUpdate } = versionInfo;

	return (
		<div className={`space-y-2 ${className}`}>
			<div className='flex items-center justify-between'>
				<span className='text-gray-600'>Version</span>
				<span className='font-medium'>{version}</span>
			</div>

			<div className='flex items-center justify-between'>
				<span className='text-gray-600'>Installation</span>
				<span className='font-medium capitalize'>{installLocation}</span>
			</div>

			<div className='flex items-center justify-between'>
				<span className='text-gray-600'>Auto-update</span>
				<span className={`font-medium ${canAutoUpdate ? 'text-green-600' : 'text-gray-500'}`}>
					{canAutoUpdate ? 'Available' : 'Not available'}
				</span>
			</div>
		</div>
	);
}

interface CompactVersionProps {
	version: string;
	className?: string;
}

export function CompactVersion({ version, className = '' }: CompactVersionProps): JSX.Element {
	return (
		<span className={`text-xs text-gray-500 ${className}`}>
			v{version}
		</span>
	);
}
