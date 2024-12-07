import { useSlideTransition } from '../hooks/useTransition.ts';

interface AnimatedNotificationProps {
	visible: boolean;
	type?: 'info' | 'success' | 'warning' | 'error';
	children: preact.ComponentChildren;
	className?: string;
}

export function AnimatedNotification({
	visible,
	type = 'info',
	children,
	className = '',
}: AnimatedNotificationProps) {
	const transition = useSlideTransition(visible, 'up', {
		duration: 200,
	});

	if (!transition.mounted) return null;

	const colors = {
		info: {
			bg: 'bg-blue-50',
			border: 'border-blue-200',
			text: 'text-blue-700',
		},
		success: {
			bg: 'bg-green-50',
			border: 'border-green-200',
			text: 'text-green-700',
		},
		warning: {
			bg: 'bg-yellow-50',
			border: 'border-yellow-200',
			text: 'text-yellow-700',
		},
		error: {
			bg: 'bg-red-50',
			border: 'border-red-200',
			text: 'text-red-700',
		},
	};

	const { bg, border, text } = colors[type];

	return (
		<div
			className={`${bg} ${border} border-b rounded-t-lg overflow-hidden ${className}`}
			style={{
				...transition.style,
				transformOrigin: 'top',
			}}
			role={type === 'error' ? 'alert' : 'status'}
			aria-live={type === 'error' ? 'assertive' : 'polite'}
		>
			<div className={`p-2 ${text}`}>
				{children}
			</div>
		</div>
	);
}
