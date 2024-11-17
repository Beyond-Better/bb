import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';

interface ToastProps {
	message: string;
	type?: 'success' | 'error' | 'info';
	duration?: number;
	onClose?: () => void;
}

export function Toast({
	message,
	type = 'success',
	duration = 3000,
	onClose,
}: ToastProps): JSX.Element | null {
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false);
			onClose?.();
		}, duration);

		return () => clearTimeout(timer);
	}, [duration, onClose]);

	if (!isVisible) return null;

	const typeStyles = {
		success: 'bg-green-500',
		error: 'bg-red-500',
		info: 'bg-blue-500',
	};

	return (
		<div
			className={`fixed bottom-4 right-4 ${typeStyles[type]} text-white px-6 py-3 rounded-lg shadow-lg
                       transform transition-all duration-300 ease-in-out
                       animate-slide-in-right`}
			role='alert'
		>
			<div className='flex items-center'>
				{type === 'success' && (
					<svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
					</svg>
				)}
				{type === 'error' && (
					<svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
					</svg>
				)}
				{type === 'info' && (
					<svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
						/>
					</svg>
				)}
				<span>{message}</span>
			</div>
		</div>
	);
}
