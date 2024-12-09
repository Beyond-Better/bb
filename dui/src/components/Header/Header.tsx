import { JSX } from 'preact';
import { ApiStatus } from '../../types/ApiStatus';
import { VersionDisplay } from '../Version/VersionDisplay';

interface HeaderProps {
	serverStatus: ApiStatus;
	isConnected: boolean;
	onNavigate: (path: string) => void;
}

export function Header({
	serverStatus,
	isConnected,
	onNavigate,
}: HeaderProps): JSX.Element {
	return (
		<header className='bg-[#1B2333] text-white py-2 pl-4 pr-0 shadow-lg'>
			<div className='max-w-7xl ml-auto mr-4 flex justify-between items-center gap-8 pl-4 pr-1'>
				<div className='flex items-center gap-3 flex-1'>
					{/* Logo */}
					<div className='flex items-center gap-2'>
						<img src='/assets/bb-logo.png' alt='BB Logo' className='h-6 w-6' />
						<h1 className='text-lg font-bold leading-none tracking-tight'>Beyond Better</h1>
					</div>
				</div>

				<div className='text-sm shrink-0 border-l border-gray-600 pl-4 flex items-center'>
					<VersionDisplay />
				</div>

				{/* Status Indicators */}
				<div className='flex items-center space-x-4 text-sm shrink-0 border-l border-gray-600 pl-4'>
					{/* Server Status */}
					<div className='flex items-center space-x-2'>
						<span
							className={`flex items-center ${
								serverStatus === ApiStatus.Error ? 'text-red-400' : 'text-gray-300'
							}`}
						>
							{serverStatus === ApiStatus.Processing && 'Processing...'}
							{serverStatus === ApiStatus.Error && 'Error'}
							{serverStatus === ApiStatus.Ready && 'Ready'}
						</span>
					</div>

					{/* Connection Status */}
					<span className={`flex items-center ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
						<span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
						{isConnected ? 'Connected' : 'Disconnected'}
					</span>
				</div>
			</div>
		</header>
	);
}