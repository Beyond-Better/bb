import { JSX } from 'preact';
import { AnimatedNotification } from './AnimatedNotification.tsx';
import { ApiStatus } from 'shared/types.ts';

type ActionVariant = 'default' | 'danger';

export interface Action {
	label: string;
	onClick: () => void;
	variant?: ActionVariant;
}

interface InputStatusBarProps {
	visible: boolean;
	message: string;
	status: ApiStatus;
	toolName?: string;
	action?: Action;
	className?: string;
}

export function InputStatusBar({
	visible,
	message,
	status,
	toolName,
	action,
	className = '',
}: InputStatusBarProps): JSX.Element {
	const getActionStyles = (variant?: ActionVariant): string => {
		if (variant === 'danger') {
			return 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-600 hover:border-red-400 dark:hover:border-red-500 focus:ring-red-500 font-medium shadow-sm';
		}
		return 'bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900/70 text-blue-700 dark:text-blue-400 focus:ring-blue-500';
	};

	const getStatusIcon = () => {
		switch (status) {
			case ApiStatus.ERROR:
				return (
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
						/>
					</svg>
				);
			case ApiStatus.LLM_PROCESSING:
			case ApiStatus.TOOL_HANDLING:
			case ApiStatus.API_BUSY:
				return (
					<div className='animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent' />
				);
			default:
				return (
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
						/>
					</svg>
				);
		}
	};

	const getStatusColors = () => {
		switch (status) {
			case ApiStatus.LLM_PROCESSING:
				return { bg: 'bg-green-500/20 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400' };
			case ApiStatus.TOOL_HANDLING:
				return { bg: 'bg-yellow-500/20 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' };
			case ApiStatus.API_BUSY:
				return { bg: 'bg-cyan-500/20 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' };
			case ApiStatus.ERROR:
				return { bg: 'bg-red-500/20 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' };
			default:
				return { bg: 'bg-gray-500/20 dark:bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400' };
		}
	};

	const colors = getStatusColors();

	const getNotificationType = () => {
		switch (status) {
			case ApiStatus.ERROR:
				return 'error';
			case ApiStatus.LLM_PROCESSING:
			case ApiStatus.TOOL_HANDLING:
			case ApiStatus.API_BUSY:
				return 'info';
			default:
				return 'info';
		}
	};

	return (
		<AnimatedNotification
			visible={visible}
			type={getNotificationType()}
			className={`mb-2 ${colors.bg} ${colors.text} transition-colors duration-300 ${className}`}
		>
			<div className='flex items-center justify-between px-2 py-1'>
				<div className='flex items-center space-x-2'>
					{getStatusIcon()}
					<div className='flex items-center'>
						<span className='font-medium'>{message}</span>
					</div>
				</div>
				{action && (
					<>
						<div className='h-6 w-px bg-blue-200 dark:bg-blue-700 mx-3' aria-hidden='true' />
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
