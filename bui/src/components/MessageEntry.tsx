import { JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { ApiClient } from '../utils/apiClient.utils.ts';
import type {
	ConversationLogDataEntry,
	//ConversationLogEntry
} from 'shared/types.ts';
import type { LogEntryFormatResponse } from '../utils/apiClient.utils.ts';
import { getDefaultTokenUsage, logDataEntryHasChildren, logDataEntryHasLogEntry } from '../utils/typeGuards.utils.ts';
import { marked } from 'marked';
import hljs from 'highlight';
import { MessageEntryTool } from './MessageEntryTool.tsx';
import { MessageEntryAgentTaskGroup } from './MessageEntryAgentTaskGroup.tsx';
import { Toast } from './Toast.tsx';
import {
	getInitialCollapseState,
	messageIcons,
	messageStyles,
	saveCollapseState,
} from '../utils/messageUtils.utils.tsx';

interface MessageEntryProps {
	logDataEntry: ConversationLogDataEntry;
	index: number;
	onCopy: (text: string) => void;
	apiClient: ApiClient;
	projectId: string;
	conversationId: string;
}

marked.setOptions({
	//highlight: (code: string, lang: string) => hljs.highlight(String(code || ''), { language: lang || 'plaintext' }).value,
	pedantic: false,
	gfm: true,
	breaks: true,
});

// Add TypeScript declaration for our global functions
declare global {
	interface Window {
		bbToggleThinking: (header: HTMLElement) => void;
		bbHandleThinkingKeyDown: (event: KeyboardEvent, header: HTMLElement) => void;
		bbToggleMetadata: (button: HTMLElement) => void;
	}
}

// Check if this is a parent logDataEntry with agent tasks
function isAgentTaskParent(logDataEntry: ConversationLogDataEntry): boolean {
	// Tool inputs for delegate_tasks are parents of agent tasks
	return logDataEntry.logEntry?.entryType === 'tool_use' &&
		logDataEntry.logEntry?.toolName === 'delegate_tasks';
	// 		&&
	// 		logDataEntryHasChildren(logDataEntry);
	// 		 logDataEntry.children.length > 0);
}

export function MessageEntry({
	logDataEntry,
	index,
	onCopy,
	apiClient,
	projectId,
	conversationId,
}: MessageEntryProps & { allEntries?: ConversationLogDataEntry[] }): JSX.Element {
	const [showToast, setShowToast] = useState(false);
	const [isExpanded, setIsExpanded] = useState(() =>
		getInitialCollapseState(
			conversationId,
			logDataEntry.agentInteractionId || null,
			index,
			logDataEntryHasLogEntry(logDataEntry) ? logDataEntry.logEntry.entryType : 'auxiliary',
		)
	);
	const [showMetadata, setShowMetadata] = useState(false);
	const [formatted, setFormatted] = useState<LogEntryFormatResponse | null>(null);

	// Fetch formatted content
	useEffect(() => {
		const fetchFormatted = async () => {
			if (!logDataEntryHasLogEntry(logDataEntry)) return;

			try {
				const response = await apiClient.formatLogEntry(
					logDataEntry.logEntry.entryType,
					logDataEntry.logEntry,
					projectId,
					conversationId,
				);
				if (response) {
					setFormatted(response);
				}
			} catch (error) {
				console.error('Error fetching formatted entry:', error);
			}
		};

		fetchFormatted();
	}, [logDataEntry, apiClient, projectId, conversationId]);

	// Handle code block truncation
	useEffect(() => {
		const addCodeBlockTruncation = () => {
			const codeBlocks = document.querySelectorAll('.message-entry pre');
			codeBlocks.forEach((block) => {
				// Skip if already processed
				if (block.classList.contains('bb-code-truncated') || block.classList.contains('bb-code-expanded')) {
					return;
				}

				const codeElement = block.querySelector('code');
				if (!codeElement) return;

				const lineCount = (codeElement.textContent || '').split('\n').length;

				// Only apply to code blocks with more than 10 lines
				if (lineCount > 10) {
					// Cast to HTMLElement to avoid TypeScript errors
					const blockEl = block as HTMLElement;
					blockEl.classList.add('bb-code-truncated');
					blockEl.style.maxHeight = '250px';

					// Create expand button
					const expandButton = document.createElement('button');
					expandButton.innerText = 'Show more';
					expandButton.className =
						'absolute bottom-0 right-0 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs px-2 py-1 rounded-tl text-gray-700 dark:text-gray-300 z-20';

					// Create fade element
					const fadeElement = document.createElement('div');
					fadeElement.className = 'bb-code-fade-overlay';

					// Add them to the block
					blockEl.appendChild(fadeElement);
					blockEl.appendChild(expandButton);

					// Setup click handler
					expandButton.onclick = function () {
						if (blockEl.classList.contains('bb-code-truncated')) {
							blockEl.classList.remove('bb-code-truncated');
							blockEl.classList.add('bb-code-expanded');
							blockEl.style.maxHeight = 'none';
							expandButton.innerText = 'Show less';

							// Remove fade overlay when expanded
							const fadeOverlay = blockEl.querySelector('.bb-code-fade-overlay');
							if (fadeOverlay) {
								fadeOverlay.remove();
							}
						} else {
							blockEl.classList.remove('bb-code-expanded');
							blockEl.classList.add('bb-code-truncated');
							blockEl.style.maxHeight = '250px';
							expandButton.innerText = 'Show more';

							// Add back fade overlay
							if (!blockEl.querySelector('.bb-code-fade-overlay')) {
								const newFadeElement = document.createElement('div');
								newFadeElement.className = 'bb-code-fade-overlay';
								blockEl.appendChild(newFadeElement);
							}
						}
					};
				}
			});
		};

		// Run once when component mounts
		if (isExpanded) {
			// Small delay to ensure content is rendered
			const timer = setTimeout(() => {
				addCodeBlockTruncation();
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [isExpanded, formatted]);

	const handleCopy = (text: string) => {
		onCopy(text);
		setShowToast(true);
	};

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => {
			const newState = !prev;
			saveCollapseState(conversationId, logDataEntry.agentInteractionId || null, index, newState);
			return newState;
		});
	}, [conversationId, logDataEntry.agentInteractionId, index]);

	const toggleMetadata = useCallback(() => {
		setShowMetadata((prev) => !prev);
	}, []);

	// Define global functions (once) for thinking block toggle functionality
	// deno-lint-ignore no-explicit-any
	if (!(globalThis as any).bbToggleThinking) {
		// Main toggle function called from onclick handler
		// deno-lint-ignore no-explicit-any
		(globalThis as any).bbToggleThinking = (header: HTMLElement) => {
			if (!header) return;

			const container = header.closest('.bb-thinking-container');
			const content = container?.querySelector('.bb-thinking-content');
			const icon = container?.querySelector('.bb-thinking-icon');

			if (content && icon) {
				const isHidden = content.classList.contains('hidden');
				content.classList.toggle('hidden');
				icon.classList.toggle('rotate-90');
				header.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
			}
		};

		// Keyboard handler for accessibility
		// deno-lint-ignore no-explicit-any
		(globalThis as any).bbHandleThinkingKeyDown = (event: KeyboardEvent, header: HTMLElement) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				// deno-lint-ignore no-explicit-any
				(globalThis as any).bbToggleThinking(header);
			}
		};

		(globalThis as any).bbToggleMetadata = (button: HTMLElement) => {
			if (!button) return;

			const container = button.closest('.message-entry');
			const metadata = container?.querySelector('.bb-metadata');

			if (metadata) {
				metadata.classList.toggle('hidden');
				button.setAttribute('aria-expanded', metadata.classList.contains('hidden') ? 'false' : 'true');
			}
		};
	}

	// Keyboard navigation
	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (document.activeElement?.closest('.message-entry') !== e.target) return;

			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleExpanded();
			}
		};

		document.addEventListener('keydown', handleKeyPress);
		return () => document.removeEventListener('keydown', handleKeyPress);
	}, [toggleExpanded]);

	// Handle entries without logEntry (ConversationStart or invalid entries)
	if (!logDataEntryHasLogEntry(logDataEntry)) {
		return (
			<div className='bb-message-entry py-3 pl-4 pr-6 mb-2 text-gray-500 dark:text-gray-400 text-sm italic'>
				<div className='font-medium'>Conversation Start</div>
			</div>
		);
	}

	const entryType =
		(logDataEntryHasLogEntry(logDataEntry)
			? logDataEntry.logEntry.entryType
			: 'start') as keyof typeof messageStyles;
	// Use type guards to safely access token usage
	const tokenUsageTurn = 'tokenUsageStats' in logDataEntry
		? logDataEntry.tokenUsageStats.tokenUsageTurn
		: getDefaultTokenUsage();
	const tokenUsageConversation = 'tokenUsageStats' in logDataEntry
		? logDataEntry.tokenUsageStats.tokenUsageConversation
		: getDefaultTokenUsage();
	const styles = messageStyles[entryType] || messageStyles.error;
	const icon = entryType in messageIcons
		? messageIcons[entryType as keyof typeof messageIcons]
		: messageIcons.auxiliary;

	// Determine if this is an agent logDataEntry
	const isAgentEntry = !!logDataEntry.agentInteractionId;

	// Message type indicator
	const getMessageTypeIndicator = (useAgentEntry: boolean) => {
		//if (useAgentEntry) return 'border-l-4 border-l-orange-500 dark:border-l-orange-600';
		switch (entryType) {
			case 'user':
				return 'border-l-4 border-l-blue-500 dark:border-l-blue-600';
			case 'orchestrator':
				return 'border-l-4 border-l-orange-500 dark:border-l-orange-600';
			case 'assistant':
				return 'border-l-4 border-l-green-500 dark:border-l-green-600';
			case 'answer':
				return 'border-l-4 border-l-green-500 dark:border-l-green-600';
			case 'tool_use':
				return 'border-l-4 border-l-amber-500 dark:border-l-amber-600';
			case 'tool_result':
				return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-600';
			case 'auxiliary':
				return 'border-l-4 border-l-purple-400 dark:border-l-purple-600';
			default:
				return 'border-l-4 border-l-gray-300 dark:border-l-gray-700';
		}
	};

	// Determine success/error state for tool results
	const isToolResult = entryType === 'tool_result';
	// 	const toolStatus = isToolResult && typeof logDataEntry.logEntry.content === 'object'
	// 		? logDataEntry.logEntry.content.success === false ? 'error' : 'success'
	// 		: null;
	const toolSubtitle = String(formatted?.formattedResult?.subtitle);
	const toolStatus = isToolResult
		? (toolSubtitle.includes('failed') && !toolSubtitle.includes('0 failed')) ? 'error' : 'success'
		: null;

	// Calculate margin-left for thread style indentation
	//const leftMargin = depth > 0 ? `ml-${Math.min(depth * 6, 12)}` : '';
	const leftMargin = isAgentEntry ? `ml-4` : '';

	// Thread line classes - only visible for agent entries
	//const threadLineClasses = isAgentEntry ? `absolute left-0 top-0 bottom-0 ml-1 w-1 bg-orange-300 dark:bg-orange-600` : '';
	const threadLineClasses = isAgentEntry
		? `absolute left-0 top-0 bottom-0 ${leftMargin} w-1 ${messageStyles[entryType].thread}`
		: '';
	//const threadLineClasses = isAgentEntry ? getMessageTypeIndicator(false) : '';

	// Agent entry status badge
	const statusBadge = isToolResult && (
		<span
			className={`ml-2 inline-flex items-center px-1.5 py-1 rounded-full text-xs font-medium
			${
				toolStatus === 'error'
					? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
					: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
			}`}
		>
			{toolStatus === 'error'
				? (
					<svg
						width='10'
						height='10'
						viewBox='0 0 16 16'
						fill='currentColor'
						aria-label='Tool execution failed'
						role='img'
					>
						<path d='M13.4 2.6c-.8-.8-2-.8-2.8 0L8 5.2 5.4 2.6c-.8-.8-2-.8-2.8 0-.8.8-.8 2 0 2.8L5.2 8l-2.6 2.6c-.8.8-.8 2 0 2.8.4.4.9.6 1.4.6s1-.2 1.4-.6L8 10.8l2.6 2.6c.4.4.9.6 1.4.6s1-.2 1.4-.6c.8-.8.8-2 0-2.8L10.8 8l2.6-2.6c.8-.8.8-2 0-2.8z' />
					</svg>
				)
				: (
					<svg
						width='10'
						height='10'
						viewBox='0 0 16 16'
						fill='currentColor'
						aria-label='Tool executed without errors'
						role='img'
					>
						<path d='M6 12.4L2.6 9c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0L6 9.6l6-6c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-6 6c-.4.4-1 .4-1.4 0z' />
					</svg>
				)}
		</span>
	);
	// 	{toolStatus === 'error' ? 'Failed' : 'OK'}

	const hasTokenUsage = (): boolean => {
		return !!((tokenUsageTurn?.inputTokens && tokenUsageTurn?.inputTokens > 0) ||
			(tokenUsageTurn?.outputTokens && tokenUsageTurn?.outputTokens > 0) ||
			(tokenUsageTurn?.totalTokens && tokenUsageTurn?.totalTokens > 0) ||
			(tokenUsageTurn?.cacheCreationInputTokens && tokenUsageTurn?.cacheCreationInputTokens > 0) ||
			(tokenUsageTurn?.cacheReadInputTokens && tokenUsageTurn?.cacheReadInputTokens > 0));
	};

	// Check if this is a delegate_tasks tool parent with agent tasks
	const isAgentParent = isAgentTaskParent(logDataEntry);

	// Render content based on entry type
	const renderContent = () => {
		if (!isExpanded) return null;

		console.log('MessageEntry: agent parent', { isAgentParent, logDataEntry });
		// Handle delegate_tasks with agent tasks
		if (isAgentParent) {
			console.log('MessageEntry: Entry is agent parent', { children: logDataEntry.children });
			return (
				<>
					{/* First render the tool input normally */}
					<MessageEntryTool
						type='input'
						toolName={logDataEntry.logEntry.toolName || 'Unknown Tool'}
						content={logDataEntry.logEntry.content}
						apiClient={apiClient}
						projectId={projectId}
						conversationId={conversationId}
						logEntry={logDataEntry.logEntry}
					/>
					<div className='agent-tasks-container mt-4'>
						{/* Show loading indicator while fetching agent entries */}
						{
							/*isLoadingAgentEntries && (
						<div className="flex items-center justify-center p-4 mt-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
							<svg className="animate-spin h-5 w-5 mr-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span>Loading agent tasks...</span>
						</div>
					)*/
						}

						{/* Then render each agent group */}
						{logDataEntry.children &&
							Object.entries(logDataEntry.children).map((
								[agentInteractionId, childLogDataEntries],
								groupIndex,
							) => (
								<MessageEntryAgentTaskGroup
									key={agentInteractionId}
									entries={childLogDataEntries}
									parentEntry={logDataEntry}
									parentIndex={index * 1000 + groupIndex}
									onCopy={onCopy}
									apiClient={apiClient}
									projectId={projectId}
									conversationId={conversationId}
								/>
							))}

						{/* Show message when no tasks are found */}
						{logDataEntry.children && Object.keys(logDataEntry.children).length === 0 && (
							<div className='p-4 mt-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700'>
								No agent tasks found for this delegate_tasks call.
							</div>
						)}
					</div>
				</>
			);
		}

		if (entryType === 'tool_use' || entryType === 'tool_result') {
			return (
				<MessageEntryTool
					type={entryType === 'tool_use' ? 'input' : 'output'}
					toolName={logDataEntry.logEntry.toolName || 'Unknown Tool'}
					content={logDataEntry.logEntry.content}
					//onCopy={handleCopy}
					apiClient={apiClient}
					projectId={projectId}
					conversationId={conversationId}
					logEntry={logDataEntry.logEntry}
				/>
			);
		}

		if (formatted?.formattedResult?.content) {
			return (
				<div
					className='prose dark:prose-invert max-w-full break-words overflow-hidden'
					// deno-lint-ignore react-no-danger
					dangerouslySetInnerHTML={{ __html: formatted.formattedResult.content as string }}
				/>
			);
		}

		if (logDataEntry.formattedContent) {
			return (
				<div
					className='prose max-w-none dark:prose-invert'
					// deno-lint-ignore react-no-danger
					dangerouslySetInnerHTML={{ __html: logDataEntry.formattedContent }}
				/>
			);
		}

		const content = logDataEntry.logEntry.content;
		if (typeof content === 'string') {
			return (
				<div
					className='prose max-w-none dark:prose-invert'
					// deno-lint-ignore react-no-danger
					dangerouslySetInnerHTML={{ __html: marked.parse(content).toString() }}
				/>
			);
		}

		// For non-string content, render as formatted JSON
		const formattedJson = JSON.stringify(content, null, 2);
		const highlighted = hljs.highlight(formattedJson, { language: 'json' }).value;

		return (
			<div className='overflow-x-auto'>
				<pre className='whitespace-pre rounded-md bg-gray-50 dark:bg-gray-900 p-4'>
                    <code
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                        className="language-json hljs"
                    />
				</pre>
			</div>
		);
	};

	return (
		<>
			<div
				className={`message-entry group relative mb-3 overflow-hidden ${
					getMessageTypeIndicator(isAgentEntry)
				} pl-3 w-full`}
				data-agent-id={logDataEntry.agentInteractionId || ''}
				data-entry-type={entryType || ''}
				role='region'
				aria-expanded={isExpanded}
			>
				{/* Thread line for agent entries */}
				{/*isAgentEntry && <div className={threadLineClasses}></div>*/}

				{/* Message container */}
				<div className='transition-all duration-200 w-full overflow-hidden'>
					{/* Header */}
					<div className='flex items-start'>
						{/* Entry type icon */}
						<button
							type='button'
							onClick={toggleExpanded}
							className={`flex-shrink-0 ${
								isExpanded ? 'mb-2' : ''
							} p-1 rounded-full ${styles.header.bg} ${styles.border} ${styles.header.text}`}
							aria-controls={`message-content-${index}`}
							title={entryType.replace('_', ' ')}
						>
							{icon}
						</button>

						{/* Header content */}
						<div className='flex flex-col ml-2 w-full overflow-hidden'>
							{/* Title & Subtitle row */}
							<div className='flex items-center justify-between flex-wrap'>
								<div className='flex items-center flex-wrap max-w-[70%]'>
									<button
										type='button'
										onClick={toggleExpanded}
										className={`font-medium text-sm ${styles.header.text}`}
									>
										{formatted?.formattedResult?.title
											? (
												<span
													dangerouslySetInnerHTML={{
														__html: formatted.formattedResult.title as string,
													}}
												/>
											)
											: (
												<span>
													{entryType === 'tool_use' || entryType === 'tool_result'
														? `${
															entryType === 'tool_use' ? 'Tool Input' : 'Tool Output'
														} (${logDataEntry.logEntry.toolName?.replace(/_/g, ' ')})`
														: entryType === 'answer'
														? 'Answer from Assistant'
														: entryType.charAt(0).toUpperCase() + entryType.slice(1)}
												</span>
											)}
										{statusBadge} {formatted?.formattedResult?.subtitle && (
											<span
												className='ml-2 truncate max-w-md text-xs'
												dangerouslySetInnerHTML={{
													__html: formatted.formattedResult.subtitle as string,
												}}
											/>
										)}
									</button>
								</div>

								{/* Action buttons */}
								<div className='flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
									{/* Copy button */}
									<button
										type='button'
										onClick={(e) => {
											e.stopPropagation();
											handleCopy(
												typeof logDataEntry.logEntry?.content === 'string'
													? logDataEntry.logEntry.content
													: JSON.stringify(logDataEntry.logEntry?.content, null, 2),
											);
										}}
										className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
										title='Copy content'
									>
										<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3'
											/>
										</svg>
									</button>

									{/* Metadata toggle */}
									<button
										type='button'
										onClick={(e) => {
											e.stopPropagation();
											toggleMetadata();
										}}
										className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
										title='Show metadata'
										aria-expanded={showMetadata}
									>
										<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
											/>
										</svg>
									</button>

									{/* Expand/collapse toggle */}
									<button
										type='button'
										onClick={toggleExpanded}
										className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
										aria-expanded={isExpanded}
										title={isExpanded ? 'Collapse' : 'Expand'}
									>
										<svg
											className={`w-4 h-4 transform transition-transform duration-200 ${
												isExpanded ? 'rotate-180' : ''
											}`}
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M19 9l-7 7-7-7'
											/>
										</svg>
									</button>
								</div>
							</div>

							{/* Metadata (initially hidden) */}
							<div
								className={`bb-metadata text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2 pb-2 border-b border-gray-100 dark:border-gray-800 ${
									showMetadata ? '' : 'hidden'
								}`}
							>
								<div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
									<span>{new Date(logDataEntry.timestamp)?.toLocaleString()}</span>
									{/* Token Usage */}
									{hasTokenUsage() && (
										<>
											<span
												title='Token Usage'
												className='ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900'
											>
												Token Usage
											</span>
											<span title='Input/Output tokens for this turn'>
												Turn: {tokenUsageTurn?.inputTokens?.toLocaleString() ?? 0}↑ /{' '}
												{tokenUsageTurn?.outputTokens?.toLocaleString() ?? 0}↓
												({tokenUsageTurn?.totalTokens?.toLocaleString() ?? 0})
											</span>
											{(tokenUsageTurn?.cacheCreationInputTokens ||
												tokenUsageTurn?.cacheReadInputTokens) && (
												<>
													<span title='Cache tokens (creation/read)'>
														Cache:{' '}
														{tokenUsageTurn.cacheCreationInputTokens?.toLocaleString() ??
															0}c /{' '}
														{tokenUsageTurn.cacheReadInputTokens?.toLocaleString() ?? 0}r
													</span>
													<span title='Combined (turn + cache)'>
														Combined: {((tokenUsageTurn?.totalTokens ?? 0) +
															(tokenUsageTurn.cacheCreationInputTokens ?? 0) +
															(tokenUsageTurn.cacheReadInputTokens ?? 0))
															.toLocaleString()}
													</span>
												</>
											)}
											<span title='Total conversation tokens (input/output)'>
												Conversation:{' '}
												{tokenUsageConversation.inputTokens?.toLocaleString() || 0}↑ /{' '}
												{tokenUsageConversation.outputTokens?.toLocaleString() || 0}↓
												({tokenUsageConversation.totalTokens?.toLocaleString() || 0})
											</span>
										</>
									)}
								</div>
							</div>

							{/* Preview */}
							<div className='flex items-center flex-wrap space-x-2 text-xs text-gray-500 dark:text-gray-400 max-w-full'>
								{!isExpanded && formatted?.formattedResult?.preview && (
									<span
										className='truncate max-w-[90%]'
										dangerouslySetInnerHTML={{
											__html: formatted.formattedResult.preview as string,
										}}
									/>
								)}
							</div>

							{/* Content area */}
							<div
								id={`message-content-${index}`}
								className={`mt-2 ${isExpanded ? '' : 'hidden'} w-full overflow-hidden`}
							>
								{renderContent()}
							</div>
						</div>
					</div>
				</div>
			</div>

			{showToast && (
				<Toast
					message='Content copied to clipboard!'
					type='success'
					duration={2000}
					onClose={() => setShowToast(false)}
				/>
			)}
		</>
	);
}
