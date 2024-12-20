import { forwardRef } from 'preact/compat';
import type { Project } from '../../hooks/useProjectState.ts';

interface ProjectTriggerProps {
	isCollapsed: boolean;
	isOpen: boolean;
	project: Project | undefined;
	onClick: () => void;
	className?: string;
}

export const ProjectTrigger = forwardRef<HTMLButtonElement, ProjectTriggerProps>(({
	isCollapsed,
	isOpen,
	project,
	onClick,
	className = '',
}, ref) => {
	if (isCollapsed) {
		return (
			<button
				ref={ref}
				onClick={onClick}
				className={`w-full p-2 flex justify-center hover:bg-gray-50 dark:hover:bg-gray-700 relative border border-gray-300 dark:border-gray-600 rounded-lg ${className}`}
				title={project?.name || 'Select Project'}
				aria-expanded={isOpen}
			>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					fill='none'
					viewBox='0 0 24 24'
					strokeWidth='1.5'
					stroke='currentColor'
					className='w-5 h-5 text-gray-500 dark:text-gray-400'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						d='M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
					/>
				</svg>
			</button>
		);
	}

	return (
		<button
			ref={ref}
			onClick={onClick}
			className={`flex items-center justify-between w-full gap-2 px-4 py-2 ${
				isOpen
					? 'border border-blue-500 dark:border-blue-400 rounded-t-lg rounded-b-none border-b-0 bg-white dark:bg-gray-800 ring-2 ring-blue-200 dark:ring-blue-900'
					: 'border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700'
			} transition-colors ${className}`}
			style={{ height: '40px' }}
			aria-expanded={isOpen}
		>
			<div className='flex items-center min-w-0'>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					fill='none'
					viewBox='0 0 24 24'
					strokeWidth='1.5'
					stroke='currentColor'
					className='w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						d='M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
					/>
				</svg>
				<div className='ml-2 flex-1 min-w-0'>
					{project
						? (
							<div className='flex flex-col'>
								<span className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
									{project.name}
								</span>
								<span className='text-xs text-gray-500 dark:text-gray-400 truncate'>
									{project.path}
								</span>
							</div>
						)
						: (
							<span className='text-sm text-gray-500 dark:text-gray-400'>
								Select Project
							</span>
						)}
				</div>
			</div>
			<svg
				xmlns='http://www.w3.org/2000/svg'
				fill='none'
				viewBox='0 0 24 24'
				strokeWidth='1.5'
				stroke='currentColor'
				className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ml-2 flex-shrink-0 ${
					isOpen ? 'rotate-180' : ''
				}`}
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					d='M19.5 8.25l-7.5 7.5-7.5-7.5'
				/>
			</svg>
		</button>
	);
});
