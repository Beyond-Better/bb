//import { type ComponentChildren } from 'preact';
//import { useState } from 'preact/hooks';
import type { ClientDataSource } from 'shared/types/project.ts';
import { formatPathForDisplay } from '../utils/path.utils.ts';
import { useAppState } from '../hooks/useAppState.ts';

interface DataSourceItemProps {
	dataSource: ClientDataSource;
	onSetPrimary: () => void;
	onEdit: () => void;
	onRemove: () => void;
}

/**
 * Displays a single data source with management options
 */
export function DataSourceItem({ dataSource, onSetPrimary, onEdit, onRemove }: DataSourceItemProps) {
	const { id: _id, name, type, enabled, isPrimary, capabilities = [] } = dataSource;
	const appState = useAppState();
	return (
		<div
			className={`border rounded-lg p-4 shadow-sm ${
				isPrimary
					? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
					: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
			} 
				${!enabled ? 'opacity-60' : ''}`}
		>
			<div className='flex justify-between items-center mb-2'>
				<h4 className='text-base font-medium text-gray-900 dark:text-gray-100'>{name || type}</h4>
				<div className='flex gap-2'>
					{!isPrimary && (
						<button
							type='button'
							className='px-2 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors'
							onClick={onSetPrimary}
						>
							Set as Primary
						</button>
					)}
					<button
						type='button'
						className='px-2 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors'
						onClick={onEdit}
					>
						Edit
					</button>
					<button
						type='button'
						className='px-2 py-1 text-xs rounded bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 transition-colors'
						onClick={onRemove}
						disabled={isPrimary}
					>
						Remove
					</button>
				</div>
			</div>

			<div className='space-y-2'>
				<div className='flex flex-wrap gap-2'>
					<span className='px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'>
						{type}
					</span>
					{isPrimary &&
						(
							<span className='px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'>
								Primary
							</span>
						)}
					{enabled
						? (
							<span className='px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'>
								Enabled
							</span>
						)
						: (
							<span className='px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'>
								Disabled
							</span>
						)}
				</div>

				<div className='flex flex-wrap gap-1.5'>
					{capabilities.map((cap) => (
						<span
							key={cap}
							className='px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
						>
							{cap}
						</span>
					))}
				</div>

				{dataSource.type === 'filesystem' && dataSource.config.dataSourceRoot && (
					<div className='text-sm text-gray-600 dark:text-gray-400 truncate border-t border-gray-100 dark:border-gray-700 mt-2 pt-2 flex items-center'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.5}
							stroke='currentColor'
							className='w-4 h-4 mr-1 flex-shrink-0'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'
							/>
						</svg>
						<span className='font-mono'>
							{formatPathForDisplay(
								dataSource.config.dataSourceRoot as string,
								appState.value.systemMeta?.pathSeparator,
							)}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
