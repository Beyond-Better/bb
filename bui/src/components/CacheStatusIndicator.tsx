import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';

interface TimerState {
	startTimestamp: number;
	duration: number;
	remaining: number;
}

type CacheStatus = 'active' | 'expiring' | 'inactive';

interface CacheStatusIndicatorProps {
	status: CacheStatus;
	className?: string;
}

export function CacheStatusIndicator({ status, className = '' }: CacheStatusIndicatorProps): JSX.Element {
	const [timer, setTimer] = useState<TimerState | null>(null);
	const [intervalId, setIntervalId] = useState<number | null>(null);

	useEffect(() => {
		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	}, []);

	const startTimer = (startTimestamp: number, duration: number) => {
		if (intervalId) clearInterval(intervalId);

		setTimer({ startTimestamp, duration, remaining: duration });
		const id = setInterval(() => {
			const now = Date.now();
			const elapsed = now - startTimestamp;
			const remaining = Math.max(0, duration - elapsed);

			if (remaining <= 0) {
				clearInterval(id);
				setTimer(null);
			} else {
				setTimer((prev) => prev ? { ...prev, remaining } : null);
			}
		}, 1000) as unknown as number;
		setIntervalId(id);
	};

	// This would be called when receiving a promptCacheTimer message
	const handleTimerMessage = (startTimestamp: number, duration: number) => {
		startTimer(startTimestamp, duration);
	};

	const getTimerStatus = (): CacheStatus => {
		if (!timer) return 'inactive';
		if (timer.remaining > 60000) return 'active'; // More than 1 minute
		return 'expiring';
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

	const formatTimeRemaining = (ms: number): string => {
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	const getStatusText = (status: CacheStatus): string => {
		switch (status) {
			case 'active':
				return `Anthropic API prompt cache status: Active (${
					timer ? formatTimeRemaining(timer.remaining) : ''
				} remaining)`;
			case 'expiring':
				return 'Anthropic API prompt cache status: Expiring Soon';
			case 'inactive':
				return 'Anthropic API prompt cache status: Inactive';
		}
	};

	return (
		<div
			className={`relative inline-flex items-center gap-2 ${className}`}
			title={getStatusText(status)}
		>
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
			<div
				className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`}
				aria-hidden='true'
			/>
			<span className='sr-only'>{getStatusText(status)}</span>
		</div>
	);
}
