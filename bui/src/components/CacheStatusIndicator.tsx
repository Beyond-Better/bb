import { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

/*
interface TimerState {
	startTimestamp: number;
	duration: number;
	remaining: number;
}
 */

type CacheStatus = 'active' | 'expiring' | 'inactive';

interface CacheStatusIndicatorProps {
	status: CacheStatus;
	className?: string;
}

export function CacheStatusIndicator({ status, className = '' }: CacheStatusIndicatorProps): JSX.Element {
	/*
	const timer = signal<TimerState | null>(null);
	const formatTimeRemaining = (ms: number): string => {
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};
	const getStatusText = (status: CacheStatus): string => {
		switch (status) {
			case 'active':
				return `Anthropic API prompt cache status: Active (${
					timer.value ? formatTimeRemaining(timer.value.remaining) : ''
				} remaining)`;
			case 'expiring':
				return 'Anthropic API prompt cache status: Expiring Soon';
			case 'inactive':
				return 'Anthropic API prompt cache status: Inactive';
		}
	};
	 */

	const getStatusText = (status: CacheStatus): string => {
		switch (status) {
			case 'active':
				return `Anthropic API prompt cache status: Active`;
			case 'expiring':
				return 'Anthropic API prompt cache status: Expiring Soon';
			case 'inactive':
				return 'Anthropic API prompt cache status: Inactive';
		}
	};

	const getStatusColor = (status: CacheStatus): string => {
		switch (status) {
			case 'active':
				return 'bg-green-500';
			case 'expiring':
				return 'bg-yellow-500';
			case 'inactive':
				return 'bg-gray-400';
		}
	};

	return (
		<div
			className={`relative inline-flex items-center gap-2 ${className}`}
			title={getStatusText(status)}
		>
			<div
				className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`}
				aria-hidden='true'
			/>
			<span className='sr-only'>{getStatusText(status)}</span>
			<svg
				className='w-4 h-4 text-gray-400'
				fill='none'
				stroke='currentColor'
				viewBox='0 0 24 24'
				aria-hidden='true'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={2}
					d='M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zm12-1H8m8 4H8m8 4H8'
				/>
			</svg>
		</div>
	);
}
