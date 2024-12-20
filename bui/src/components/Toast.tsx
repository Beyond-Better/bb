import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useFadeTransition } from '../hooks/useTransition.ts';

interface ToastProps {
	message: string;
	type?: 'success' | 'info';
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

	const transition = useFadeTransition(isVisible, {
		duration: 300,
	});

	if (!transition.mounted) return null;

	const typeStyles = {
		success: {
			bg: 'bg-green-500 dark:bg-green-600',
			icon: (
				<svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
				</svg>
			),
		},
		info: {
			bg: 'bg-blue-500 dark:bg-blue-600',
			icon: (
				<svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
					/>
				</svg>
			),
		},
	};

	const { bg, icon } = typeStyles[type];

	return (
		<div
			className={`fixed bottom-4 right-4 ${bg} text-white px-6 py-3 rounded-lg shadow-lg dark:shadow-black/30`}
			style={transition.style}
			role='status'
			aria-live='polite'
		>
			<div className='flex items-center'>
				{icon}
				<span>{message}</span>
			</div>
		</div>
	);
}
