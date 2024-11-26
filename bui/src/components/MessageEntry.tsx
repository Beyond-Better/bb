import { JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { ApiClient } from '../utils/apiClient.utils.ts';
import type { ConversationEntry, ConversationLogEntry } from 'shared/types.ts';
import { getDefaultTokenUsage, hasLogEntry } from '../utils/typeGuards.utils.ts';
import { marked } from 'marked';
import hljs from 'highlight';
import { MessageEntryTool } from './MessageEntryTool.tsx';
import { Toast } from './Toast.tsx';
import {
	getContentSummary,
	getInitialCollapseState,
	getStructuredSummary,
	messageIcons,
	messageStyles,
	saveCollapseState,
} from '../utils/messageUtils.utils.tsx';

interface MessageEntryProps {
	logEntryData: ConversationEntry;
	index: number;
	onCopy: (text: string) => void;
	apiClient: ApiClient;
	startDir: string;
	conversationId: string;
}

marked.setOptions({
	//highlight: (code: string, lang: string) => hljs.highlight(String(code || ''), { language: lang || 'plaintext' }).value,
	pedantic: false,
	gfm: true,
	breaks: true,
	//sanitize: false,
	//smartypants: false,
	//xhtml: false,
});

export function MessageEntry({
	logEntryData,
	index,
	onCopy,
	apiClient,
	startDir,
	conversationId,
}: MessageEntryProps): JSX.Element {
	const [showToast, setShowToast] = useState(false);
	const [isExpanded, setIsExpanded] = useState(() =>
		getInitialCollapseState(
			conversationId,
			index,
			hasLogEntry(logEntryData) ? logEntryData.logEntry.entryType : 'auxiliary',
		)
	);

	const handleCopy = (text: string) => {
		onCopy(text);
		setShowToast(true);
	};

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => {
			const newState = !prev;
			saveCollapseState(conversationId, index, newState);
			return newState;
		});
	}, [conversationId, index]);

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
	if (!hasLogEntry(logEntryData)) {
		return (
			<div className='message-entry p-4 rounded-lg mb-4 shadow-md border border-gray-200 bg-gray-50'>
				<div className='font-semibold text-gray-800'>Conversation Start</div>
				<div className='text-gray-800'>Starting new conversation</div>
			</div>
		);
	}

	const entryType =
		(hasLogEntry(logEntryData) ? logEntryData.logEntry.entryType : 'start') as keyof typeof messageStyles;
	// Use type guards to safely access token usage
	const tokenUsageTurn = 'tokenUsageTurn' in logEntryData ? logEntryData.tokenUsageTurn : getDefaultTokenUsage();
	const tokenUsageConversation = logEntryData.tokenUsageConversation || getDefaultTokenUsage();
	const styles = messageStyles[entryType] || messageStyles.error;
	const icon = entryType in messageIcons
		? messageIcons[entryType as keyof typeof messageIcons]
		: messageIcons.auxiliary;
	const structuredSummary = getStructuredSummary(logEntryData.logEntry);

	// Get content preview for collapsed state
	const contentPreview = !isExpanded && logEntryData.logEntry.content
		? getContentSummary(
			typeof logEntryData.logEntry.content === 'string'
				? logEntryData.logEntry.content
				: JSON.stringify(logEntryData.logEntry.content),
		)
		: null;

	// Render content based on entry type
	const renderContent = () => {
		if (!isExpanded) return null;

		if (entryType === 'tool_use' || entryType === 'tool_result') {
			return (
				<MessageEntryTool
					type={entryType === 'tool_use' ? 'input' : 'output'}
					toolName={logEntryData.logEntry.toolName || 'Unknown Tool'}
					content={logEntryData.logEntry.content}
					onCopy={handleCopy}
					apiClient={apiClient}
					startDir={startDir}
					logEntry={logEntryData.logEntry}
				/>
			);
		}

		if (logEntryData.formattedContent) {
			return (
				<div
					className='prose max-w-none dark:prose-invert'
					dangerouslySetInnerHTML={{ __html: logEntryData.formattedContent }}
				/>
			);
		}

		const content = logEntryData.logEntry.content;
		if (typeof content === 'string') {
			// Transform <thinking> tags into styled blockquotes
			let processedContent = content;
			// Handle case with closing tag
			processedContent = processedContent.replace(/<thinking>([\s\S]*?)<\/thinking>/g, (match, p1) => {
				// Add blockquote with custom styling
				// Process the content to handle markdown within the thinking block
				const processedInnerContent = p1.split('\n')
					.map((line: string) => line.trim())
					.join('\n');
				// Process the content line by line to maintain proper markdown formatting
				const lines = processedInnerContent.split('\n');
				// Add thinking emoji to first line only
				const processedLines = lines.map((line: string, index: number) =>
					index === 0 ? '💭  <small>*thinking...*</small>' + line : line
				).join('\n');
				// Wrap in a styled div and parse markdown
				return '\n<div class=" border-l-4 border-blue-300 dark:border-blue-700 rounded-r pt-1 pb-2 px-4 my-1 prose dark:prose-invert max-w-none ">\n' +
					marked.parse(processedLines) +
					'</div>\n';
			});
			// Handle case with only opening tag (remove it)
			processedContent = processedContent.replace(/<thinking>/g, '');

			return (
				<div
					className='prose max-w-none dark:prose-invert'
					dangerouslySetInnerHTML={{ __html: marked.parse(processedContent).toString() }}
				/>
			);
		}

		// For non-string content, render as formatted JSON
		const formattedJson = JSON.stringify(content, null, 2);
		const highlighted = hljs.highlight(formattedJson, { language: 'json' }).value;

		return (
			<div className='overflow-x-auto'>
				<pre className='whitespace-pre rounded-lg bg-gray-50 p-4'>
                    <code
                        className="language-json hljs"
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
				</pre>
			</div>
		);
	};

	return (
		<>
			<div
				className={`message-entry group rounded-lg mb-4 shadow-md border ${styles.border} ${styles.bg} overflow-hidden`}
				role='region'
				aria-expanded={isExpanded}
			>
				{/* Header */}
				<button
					onClick={toggleExpanded}
					className={`w-full flex items-center justify-between p-2 ${styles.header.bg} border-b ${styles.header.border} hover:bg-opacity-75 transition-colors duration-200`}
					aria-controls={`message-content-${index}`}
				>
					<div className='flex items-center space-x-2'>
						<span className={`inline-block w-2 h-2 rounded-full ${styles.header.dot}`} />
						{icon && <span className={styles.header.text}>{icon}</span>}
						<span className={`font-semibold ${styles.header.text}`}>
							{entryType === 'tool_use' || entryType === 'tool_result'
								? `${entryType === 'tool_use' ? 'Tool Input' : 'Tool Output'} (${
									logEntryData.logEntry.toolName?.replace(/_/g, ' ')
								})`
								: entryType === 'answer'
								? 'Answer from Assistant'
								: entryType.charAt(0).toUpperCase() + entryType.slice(1)}
						</span>
						{structuredSummary && (
							<span className={`text-sm text-gray-600 dark:text-gray-400`}>
								{structuredSummary}
							</span>
						)}
					</div>
					<div className='flex items-center space-x-4'>
						{contentPreview && (
							<span className={`text-sm text-gray-700 dark:text-gray-300 truncate max-w-md`}>
								{contentPreview}
							</span>
						)}
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleCopy(
									typeof logEntryData.logEntry?.content === 'string'
										? logEntryData.logEntry.content
										: JSON.stringify(logEntryData.logEntry?.content, null, 2),
								);
							}}
							className={`opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 p-1 rounded hover:bg-opacity-10 hover:bg-gray-500 ${styles.header.text}`}
							title='Copy content'
						>
							<svg
								className='w-4 h-4'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3'
								/>
							</svg>
						</button>
						<svg
							className={`w-5 h-5 transform transition-transform duration-200 ${
								isExpanded ? 'rotate-180' : ''
							}`}
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
						</svg>
					</div>
				</button>

				{/* Content */}
				<div
					id={`message-content-${index}`}
					className={`transition-all duration-200 ${isExpanded ? 'p-4' : 'h-0 overflow-hidden'}`}
				>
					{renderContent()}
				</div>

				{/* Footer */}
				<div
					className={`px-4 py-2 ${styles.header.bg} border-t ${styles.header.border} text-xs text-gray-700 dark:text-gray-300 flex justify-between items-center`}
				>
					<div>
						{new Date(logEntryData.timestamp).toLocaleString()}
					</div>
					<div className='flex space-x-4'>
						<span title='Input/Output tokens for this turn'>
							Turn: {tokenUsageTurn?.inputTokens ?? 0}↑/{tokenUsageTurn?.outputTokens ?? 0}↓
						</span>
						<span title='Total tokens for this turn'>
							({tokenUsageTurn?.totalTokens ?? 0})
						</span>
						{(tokenUsageTurn?.cacheCreationInputTokens || tokenUsageTurn?.cacheReadInputTokens) && (
							<span
								className='border-l border-gray-300 dark:border-gray-600 pl-4'
								title='Cache tokens (creation/read)'
							>
								Cache:{' '}
								{tokenUsageTurn.cacheCreationInputTokens ?? 0}c/{tokenUsageTurn.cacheReadInputTokens ??
									0}r
							</span>
						)}
						<span
							className='border-l border-gray-300 dark:border-gray-600 pl-4'
							title='Total conversation tokens (input/output)'
						>
							Total:{' '}
							{tokenUsageConversation.inputTokens || 0}↑/{tokenUsageConversation.outputTokens || 0}↓
						</span>
						<span title='Total conversation tokens'>
							({tokenUsageConversation.totalTokens || 0})
						</span>
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
