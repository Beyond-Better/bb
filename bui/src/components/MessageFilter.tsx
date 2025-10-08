import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
//import { useComputed } from '@preact/signals';
import type { CollaborationLogDataEntry } from 'shared/types.ts';
import {
	FILTER_PRESET_LABELS,
	//FILTER_PRESETS,
	type FilterPreset,
	LOG_ENTRY_TYPE_LABELS,
	type LogEntryType,
	type LogEntryTypeCounts,
} from '../types/logEntryFilter.types.ts';
import { useLogEntryFilterState } from '../hooks/useLogEntryFilterState.ts';
import { countEntriesByType } from '../utils/logEntryFilterState.utils.ts';

interface MessageFilterProps {
	logDataEntries: CollaborationLogDataEntry[];
	collaborationId: string | null;
}

export function MessageFilter({ logDataEntries, collaborationId }: MessageFilterProps): JSX.Element {
	const { filterState, initializeFilterState, setPreset, toggleType, selectAll, clearAll, isTypeSelected } =
		useLogEntryFilterState();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isFilterCollapsed, setIsFilterCollapsed] = useState(() => {
		// Load collapsed state from localStorage
		const saved = localStorage.getItem('messageFilter.collapsed');
		return saved ? JSON.parse(saved) : false;
	});
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Save collapsed state to localStorage whenever it changes
	useEffect(() => {
		localStorage.setItem('messageFilter.collapsed', JSON.stringify(isFilterCollapsed));
	}, [isFilterCollapsed]);

	// Initialize filter state when collaboration changes
	useEffect(() => {
		if (collaborationId) {
			initializeFilterState(collaborationId);
		}
	}, [collaborationId]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownOpen(false);
			}
		};

		if (isDropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [isDropdownOpen]);

	// Handle keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Only handle if not typing in an input/textarea
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				event.target instanceof HTMLSelectElement
			) {
				return;
			}

			// 'f' key to toggle dropdown
			if (event.key === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
				event.preventDefault();
				setIsDropdownOpen((prev) => !prev);
			}

			// Escape to close dropdown
			if (event.key === 'Escape' && isDropdownOpen) {
				event.preventDefault();
				setIsDropdownOpen(false);
			}

			// Number keys 1-4 for presets (when dropdown is focused)
			if (isDropdownOpen && event.key >= '1' && event.key <= '4') {
				event.preventDefault();
				const presets: FilterPreset[] = ['all', 'conversation', 'mainFlow', 'tools'];
				const presetIndex = parseInt(event.key) - 1;
				if (presets[presetIndex]) {
					setPreset(presets[presetIndex]);
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isDropdownOpen]);

	// Calculate entry counts using useMemo since logDataEntries is a prop
	const entryCounts = useMemo<LogEntryTypeCounts>(() => {
		return countEntriesByType(logDataEntries);
	}, [logDataEntries]);

	// Check if a type is hidden
	const isTypeHidden = (type: LogEntryType): boolean => {
		return !isTypeSelected(type) && entryCounts[type] > 0;
	};

	// Count visible entries
	const visibleCount = useMemo(() => {
		let count = 0;
		for (const [type, typeCount] of Object.entries(entryCounts)) {
			if (type !== 'total' && isTypeSelected(type as LogEntryType)) {
				count += typeCount;
			}
		}
		return count;
	}, [entryCounts, isTypeSelected]);

	const hiddenClass = 'text-gray-400 dark:text-gray-600'; // 'line-through';
	// Render detailed counts
	const renderDetailedCounts = () => (
		<>
			<span className='font-medium'>
				Showing {visibleCount} of {entryCounts.total} entries
			</span>
			<span className='text-gray-300 dark:text-gray-600'>|</span>

			{/* Individual type counts */}
			{entryCounts.user > 0 && (
				<span className={isTypeHidden('user') ? hiddenClass : ''}>
					User: {entryCounts.user}
					{isTypeHidden('user') && <span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>}
				</span>
			)}

			{entryCounts.orchestrator > 0 && (
				<span className={isTypeHidden('orchestrator') ? hiddenClass : ''}>
					Orchestrator: {entryCounts.orchestrator}
					{isTypeHidden('orchestrator') && (
						<span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>
					)}
				</span>
			)}

			{entryCounts.assistant > 0 && (
				<span className={isTypeHidden('assistant') ? hiddenClass : ''}>
					Assistant: {entryCounts.assistant}
					{isTypeHidden('assistant') && (
						<span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>
					)}
				</span>
			)}

			{entryCounts.answer > 0 && (
				<span className={isTypeHidden('answer') ? hiddenClass : ''}>
					Answers: {entryCounts.answer}
					{isTypeHidden('answer') && <span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>}
				</span>
			)}

			{entryCounts.tool_use > 0 && (
				<span className={isTypeHidden('tool_use') ? hiddenClass : ''}>
					Tools: {entryCounts.tool_use}
					{isTypeHidden('tool_use') && (
						<span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>
					)}
				</span>
			)}

			{entryCounts.tool_result > 0 && (
				<span className={isTypeHidden('tool_result') ? hiddenClass : ''}>
					Results: {entryCounts.tool_result}
					{isTypeHidden('tool_result') && (
						<span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>
					)}
				</span>
			)}

			{entryCounts.auxiliary > 0 && (
				<span className={isTypeHidden('auxiliary') ? hiddenClass : ''}>
					Auxiliary: {entryCounts.auxiliary}
					{isTypeHidden('auxiliary') && (
						<span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>
					)}
				</span>
			)}

			{entryCounts.agent > 0 && (
				<span className={isTypeHidden('agent') ? hiddenClass : ''}>
					Agents: {entryCounts.agent}
					{isTypeHidden('agent') && <span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>}
				</span>
			)}

			{entryCounts.error > 0 && (
				<span className={isTypeHidden('error') ? hiddenClass : ''}>
					Errors: {entryCounts.error}
					{isTypeHidden('error') && <span className='ml-1 text-gray-400 dark:text-gray-600'>(hidden)</span>}
				</span>
			)}
		</>
	);

	return (
		<div className='pb-1'>
			<div className='flex gap-2'>
				{/* Collapse Toggle - Fixed on left */}
				<button
					type='button'
					onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
					className='p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 self-start'
					title={isFilterCollapsed ? 'Expand filter' : 'Collapse filter'}
				>
					<svg
						className={`w-4 h-4 transform transition-transform ${isFilterCollapsed ? '' : 'rotate-90'}`}
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M9 5l7 7-7 7'
						/>
					</svg>
				</button>

				{/* Content Area - Right side */}
				<div className='flex-1 flex flex-col gap-2'>
					{/* Preset Buttons - Only when expanded */}
					{!isFilterCollapsed && (
						<div className='flex items-center gap-2 flex-wrap'>
							<span className='text-sm font-medium text-gray-700 dark:text-gray-300'>Filter:</span>

							{/* All */}
							<button
								type='button'
								onClick={() => setPreset('all')}
								className={`px-3 py-1 text-sm rounded-md transition-colors ${
									filterState.value.preset === 'all'
										? 'bg-blue-500 text-white dark:bg-blue-600'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
								}`}
								title='Show all entry types (1)'
							>
								{FILTER_PRESET_LABELS.all}
							</button>

							{/* Conversation */}
							<button
								type='button'
								onClick={() => setPreset('conversation')}
								className={`px-3 py-1 text-sm rounded-md transition-colors ${
									filterState.value.preset === 'conversation'
										? 'bg-blue-500 text-white dark:bg-blue-600'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
								}`}
								title='Show user messages, assistant responses, and answers (2)'
							>
								{FILTER_PRESET_LABELS.conversation}
							</button>

							{/* Main Flow */}
							<button
								type='button'
								onClick={() => setPreset('mainFlow')}
								className={`px-3 py-1 text-sm rounded-md transition-colors ${
									filterState.value.preset === 'mainFlow'
										? 'bg-blue-500 text-white dark:bg-blue-600'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
								}`}
								title='Show main conversation flow including orchestrator (3)'
							>
								{FILTER_PRESET_LABELS.mainFlow}
							</button>

							{/* Tools */}
							<button
								type='button'
								onClick={() => setPreset('tools')}
								className={`px-3 py-1 text-sm rounded-md transition-colors ${
									filterState.value.preset === 'tools'
										? 'bg-blue-500 text-white dark:bg-blue-600'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
								}`}
								title='Show tool inputs, outputs, and agent tasks (4)'
							>
								{FILTER_PRESET_LABELS.tools}
							</button>

							{/* More Dropdown */}
							<div className='relative' ref={dropdownRef}>
								<button
									type='button'
									onClick={() => setIsDropdownOpen(!isDropdownOpen)}
									className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
										filterState.value.preset === 'custom'
											? 'bg-blue-500 text-white dark:bg-blue-600'
											: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
									}`}
									title='Advanced filter options (f)'
								>
									+ More
									<svg
										className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M19 9l-7 7-7-7'
										/>
									</svg>
								</button>

								{/* Dropdown Panel */}
								{isDropdownOpen && (
									// FUTURE: Add fade-in animation here for smooth appearance
									// Consider: transition-opacity duration-200 ease-in-out
									<div className='absolute top-full mt-2 left-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[240px]'>
										<div className='p-3'>
											<div className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase'>
												Message Types
											</div>
											<div className='space-y-1'>
												{/* User */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('user')}
															onChange={() => toggleType('user')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.user}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('user')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.user})
													</span>
												</label>

												{/* Orchestrator */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('orchestrator')}
															onChange={() => toggleType('orchestrator')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.orchestrator}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('orchestrator')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.orchestrator})
													</span>
												</label>

												{/* Assistant */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('assistant')}
															onChange={() => toggleType('assistant')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.assistant}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('assistant')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.assistant})
													</span>
												</label>

												{/* Answers */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('answer')}
															onChange={() => toggleType('answer')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.answer}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('answer')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.answer})
													</span>
												</label>

												{/* Tool Inputs */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('tool_use')}
															onChange={() => toggleType('tool_use')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.tool_use}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('tool_use')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.tool_use})
													</span>
												</label>

												{/* Tool Results */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('tool_result')}
															onChange={() => toggleType('tool_result')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.tool_result}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('tool_result')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.tool_result})
													</span>
												</label>

												{/* Auxiliary */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('auxiliary')}
															onChange={() => toggleType('auxiliary')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.auxiliary}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('auxiliary')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.auxiliary})
													</span>
												</label>

												{/* Agent Tasks */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('error')}
															onChange={() => toggleType('error')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.error}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('error')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.error})
													</span>
												</label>

												{/* Errors */}
												<label className='flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer'>
													<div className='flex items-center gap-2'>
														<input
															type='checkbox'
															checked={isTypeSelected('agent')}
															onChange={() => toggleType('agent')}
															className='w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
														/>
														<span className='text-sm text-gray-700 dark:text-gray-300'>
															{LOG_ENTRY_TYPE_LABELS.agent}
														</span>
													</div>
													<span
														className={`text-xs ${
															isTypeHidden('agent')
																? 'text-gray-400 dark:text-gray-500'
																: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														({entryCounts.agent})
													</span>
												</label>
											</div>

											{/* Action Buttons */}
											<div className='flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700'>
												<button
													type='button'
													onClick={() => selectAll()}
													className='px-3 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
												>
													Select All
												</button>
												<button
													type='button'
													onClick={() => clearAll()}
													className='px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors'
												>
													Clear All
												</button>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Detailed Counts - Always visible */}
					<div className='flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap'>
						{renderDetailedCounts()}
					</div>
				</div>
			</div>
		</div>
	);
}
