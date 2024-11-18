import { ComponentChildren, JSX } from 'preact';
import { AnimatedNotification } from './AnimatedNotification.tsx';

type ActionVariant = 'default' | 'danger';

export interface Action {
	label: string;
	onClick: () => void;
	variant?: ActionVariant;
}

interface InputStatusBarProps {
	visible: boolean;
	message: string;
	type?: 'info' | 'warning' | 'error';
	action?: Action;
	className?: string;
}

export function InputStatusBar({
	visible,
	message,
	type = 'info',
	action,
	className = '',
}: InputStatusBarProps): JSX.Element {
	const getActionStyles = (variant?: ActionVariant): string => {
		if (variant === 'danger') {
			return 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 hover:border-red-400 focus:ring-red-500 font-medium shadow-sm';
		}
		return 'bg-blue-100 hover:bg-blue-200 text-blue-700 focus:ring-blue-500';
	};

	return (
		<AnimatedNotification
			visible={visible}
			type={type}
			className={`mb-2 ${className}`}
		>
			<div className='flex items-center justify-between px-2 py-1'>
				<div className='flex items-center space-x-2'>
					{type === 'error' && (
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
							/>
						</svg>
					)}
					{type === 'warning' && (
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
							/>
						</svg>
					)}
					{type === 'info' && (
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
					)}
					<div className='flex items-center'>
						{type === 'info' && message === 'Claude is working...' && (
							<div className='animate-spin rounded-full h-4 w-4 border-2 border-blue-700 border-t-transparent mr-2' />
						)}
						<span className='font-medium'>{message}</span>
					</div>
				</div>
				{action && (
					<>
						<div className='h-6 w-px bg-blue-200 mx-3' aria-hidden='true' />
						<button
							onClick={action.onClick}
							className={`ml-4 px-3 py-1.5 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
								getActionStyles(action.variant)
							}`}
							aria-label={`${action.label} processing`}
							title={`${action.label} current operation`}
						>
							{action.label}
						</button>
					</>
				)}
			</div>
		</AnimatedNotification>
	);
}
