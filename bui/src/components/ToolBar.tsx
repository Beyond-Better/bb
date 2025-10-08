import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { RefObject } from 'preact/compat';
type TargetedMouseEvent = JSX.TargetedMouseEvent<HTMLButtonElement>;

import { HelpButton } from './Help/HelpButton.tsx';
import { HelpDialog } from './Help/HelpDialog.tsx';

import type { ApiClient, LogEntryFormatResponse } from '../utils/apiClient.utils.ts';
import type { CollaborationLogDataEntry } from 'shared/types.ts';
import { logDataEntryHasLogEntry } from '../utils/typeGuards.utils.ts';
import { getContentSummary, getInitialCollapseState } from '../utils/messageUtils.utils.tsx';
import type { AuxiliaryChatContent } from 'api/logEntries/types.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

interface ChatInputRef {
	textarea: HTMLTextAreaElement;
	adjustHeight: () => void;
}

interface ToolBarProps {
	onSendMessage: (message: string) => Promise<void>;
	chatInputRef: RefObject<ChatInputRef>;
	disabled: boolean;
	projectId: string;
	apiClient: ApiClient;
	logDataEntries: CollaborationLogDataEntry[];
	onCopy: (text: string, html?: string, toastMessage?: string) => void;
	getFormattedLogEntry: (logDataEntry: CollaborationLogDataEntry) => LogEntryFormatResponse['formattedResult'] | null;
	collaborationTitle?: string;
	collaborationId?: string;
	projectConfig?: ProjectConfig | null; // Project configuration
}

type ExportMode = 'all' | 'displayed' | 'conversation';

export function ToolBar(
	{
		onSendMessage,
		chatInputRef,
		disabled,
		projectId,
		apiClient,
		logDataEntries,
		onCopy,
		getFormattedLogEntry,
		collaborationTitle,
		collaborationId,
		projectConfig,
	}: ToolBarProps,
): JSX.Element {
	const [showHelp, setShowHelp] = useState(false);
	const [showExportDropdown, setShowExportDropdown] = useState(false);
	const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
	const [previewMode, setPreviewMode] = useState<ExportMode>('displayed');

	const handleMetricsClick = () => {
		onSendMessage('Provide conversation metrics');
	};

	const handleSummaryClick = () => {
		onSendMessage("Create a 'long' conversation summary keeping max of 20,000 tokens");
	};

	const handleExportClick = (mode: ExportMode) => {
		const content = collectMessageContent(mode);
		onCopy(content);
		setShowExportDropdown(false);
	};

	const handlePreviewClick = () => {
		setShowPreviewOverlay(true);
		setShowExportDropdown(false);
	};

	const generateHtmlContent = (): string => {
		if (!logDataEntries || logDataEntries.length === 0) {
			return '<p>No conversation content to preview.</p>';
		}

		let html = '';

		// Add conversation title if available
		if (collaborationTitle) {
			html += `<h1>${collaborationTitle}</h1>`;
		}

		// For conversation mode, consolidate sequential entries of the same type
		if (previewMode === 'conversation') {
			const consolidatedEntries: Array<{
				entryType: string;
				combinedContent: string;
				lastTimestamp: string;
				headerTitle: string;
			}> = [];

			logDataEntries.forEach((logDataEntry) => {
				if (!logDataEntryHasLogEntry(logDataEntry)) {
					return; // Skip conversation start entries for conversation mode
				}

				const entryType = logDataEntry.logEntry.entryType;
				const content = logDataEntry.logEntry.content;
				const timestamp = new Date(logDataEntry.timestamp).toLocaleString();

				// Only include user and assistant messages for conversation mode
				if (!['user', 'assistant', 'answer', 'orchestrator'].includes(entryType)) {
					return;
				}

				// Determine header title
				let headerTitle = '';
				switch (entryType) {
					case 'user':
						headerTitle = projectConfig?.myPersonsName || 'User';
						break;
					case 'assistant':
					case 'answer':
						headerTitle = projectConfig?.myAssistantsName || 'Assistant';
						break;
					case 'orchestrator':
						headerTitle = 'Orchestrator';
						break;
					default:
						headerTitle = entryType.charAt(0).toUpperCase() + entryType.slice(1);
				}

				const contentHtml = typeof content === 'string'
					? content.replace(/\n/g, '<br>')
					: `<pre><code>${JSON.stringify(content, null, 2)}</code></pre>`;

				// Check if we can consolidate with the last entry
				const lastEntry = consolidatedEntries[consolidatedEntries.length - 1];
				if (lastEntry && lastEntry.entryType === entryType) {
					// Consolidate with previous entry
					lastEntry.combinedContent += '<br><br>' + contentHtml;
					lastEntry.lastTimestamp = timestamp; // Use timestamp from last entry
				} else {
					// Create new consolidated entry
					consolidatedEntries.push({
						entryType,
						combinedContent: contentHtml,
						lastTimestamp: timestamp,
						headerTitle,
					});
				}
			});

			// Generate HTML from consolidated entries
			consolidatedEntries.forEach((entry, index) => {
				html += `<div class="message-entry" data-entry-type="${entry.entryType}">`;
				html += `<h3>${entry.headerTitle}</h3>`;
				html += `<p><em>${entry.lastTimestamp}</em></p>`;
				html += `<div>${entry.combinedContent}</div>`;
				html += '</div>';

				// Add separator between entries (except for the last one)
				if (index < consolidatedEntries.length - 1) {
					html += '<hr>';
				}
			});

			return html;
		}

		// Process each log entry for other modes
		logDataEntries.forEach((logDataEntry, index) => {
			if (!logDataEntryHasLogEntry(logDataEntry)) {
				// Handle conversation start entries
				if ((previewMode as ExportMode) !== 'conversation') {
					html += `<hr><p><strong>Conversation Start</strong></p>`;
				}
				return;
			}

			const entryType = logDataEntry.logEntry.entryType;
			const content = logDataEntry.logEntry.content;
			const timestamp = new Date(logDataEntry.timestamp).toLocaleString();
			const isExpanded = isEntryExpanded(logDataEntry, index);
			const formattedResult = getFormattedLogEntry(logDataEntry);

			// Filter based on preview mode (this shouldn't be reached for conversation mode)
			if (previewMode === 'displayed' && !isExpanded) {
				// For displayed mode with collapsed entries, show summary
				// This logic will be handled below
			}
			// For 'all' mode, include everything

			// Skip entries that don't match any supported type
			if (
				!['user', 'assistant', 'answer', 'orchestrator', 'tool_use', 'tool_result', 'auxiliary'].includes(
					entryType,
				)
			) {
				return;
			}

			html += `<div class="message-entry" data-entry-type="${entryType}">`;

			if (!isExpanded && formattedResult) {
				// Use formatted result for collapsed entries
				const title = formattedResult.title || `${entryType.charAt(0).toUpperCase() + entryType.slice(1)}`;
				html += `<h3>${title} (collapsed)</h3>`;
				html += `<p><em>${timestamp}</em></p>`;
				if (formattedResult.preview) {
					html += `<p><em>${formattedResult.preview}</em></p>`;
				}
			} else {
				// Use formatted result content or fallback for expanded entries
				let headerTitle = '';
				switch (entryType) {
					case 'user':
						headerTitle = projectConfig?.myPersonsName || 'User';
						break;
					case 'assistant':
					case 'answer':
						headerTitle = projectConfig?.myAssistantsName || 'Assistant';
						break;
					case 'orchestrator':
						headerTitle = 'Orchestrator';
						break;
					case 'tool_use':
						headerTitle = `Tool Input: ${logDataEntry.logEntry.toolName || 'Unknown Tool'}`;
						break;
					case 'tool_result':
						headerTitle = `Tool Output: ${logDataEntry.logEntry.toolName || 'Unknown Tool'}`;
						break;
					default:
						headerTitle = entryType.charAt(0).toUpperCase() + entryType.slice(1);
				}

				html += formattedResult?.title ? `<h3>${formattedResult.title}</h3>` : `<h3>${headerTitle}</h3>`;
				html += `<p><em>${timestamp}</em></p>`;

				// Add content
				if (formattedResult?.content) {
					// Use formatted HTML content
					html += formattedResult.content;
				} else if (typeof content === 'string') {
					// Fallback: convert markdown/plain text to basic HTML
					html += `<div>${content.replace(/\n/g, '<br>')}</div>`;
				} else {
					// Fallback: show JSON in code block
					html += `<pre><code>${JSON.stringify(content, null, 2)}</code></pre>`;
				}
			}

			html += '</div>';

			// Add separator between entries (except for the last one)
			if (index < logDataEntries.length - 1) {
				html += '<hr>';
			}
		});

		return html;
	};

	const handleCopyFromPreview = async () => {
		try {
			const previewContent = document.getElementById('conversation-preview-content');
			if (!previewContent) return;

			// Select the content
			const selection = window.getSelection();
			selection?.removeAllRanges();
			const range = document.createRange();
			range.selectNodeContents(previewContent);
			selection?.addRange(range);

			onCopy(selection?.toString() || '', previewContent.outerHTML, 'Content copied from preview!');

			// Clear selection
			selection?.removeAllRanges();
		} catch (error) {
			console.error('Failed to copy from preview:', error);
			onCopy('', 'Failed to copy content');
		}
	};

	const handlePrintFromPreview = () => {
		const previewContent = document.getElementById('conversation-preview-content');
		if (!previewContent) return;

		// Create a new window for printing
		const printWindow = window.open('', '_blank');
		if (!printWindow) return;

		printWindow.document.write(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>${collaborationTitle || 'Conversation Export'}</title>
				<style>
					body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
					h1, h2, h3 { color: #333; margin-top: 2em; margin-bottom: 0.5em; }
					h1 { border-bottom: 2px solid #333; padding-bottom: 0.3em; }
					hr { margin: 2em 0; border: none; border-top: 1px solid #ddd; }
					.message-entry { margin-bottom: 2em; }
					pre { background: #f5f5f5; padding: 1em; border-radius: 4px; overflow-wrap: break-word; }
					code { font-family: 'Courier New', monospace; }
					em { color: #666; }
				</style>
			</head>
			<body>
				${previewContent.innerHTML}
			</body>
			</html>
		`);
		printWindow.document.close();
		printWindow.print();
	};

	const isEntryExpanded = (logDataEntry: CollaborationLogDataEntry, index: number): boolean => {
		if (!logDataEntryHasLogEntry(logDataEntry)) return true;

		const entryType = logDataEntry.logEntry
			.entryType as keyof typeof import('../utils/messageUtils.utils.tsx').defaultExpanded;
		return getInitialCollapseState(
			collaborationId || 'default',
			logDataEntry.agentInteractionId || null,
			index,
			entryType,
		);
	};

	const collectMessageContent = (mode: ExportMode): string => {
		if (!logDataEntries || logDataEntries.length === 0) {
			return 'No conversation content to copy.';
		}

		let markdown = '';

		// Add conversation title if available
		if (collaborationTitle) {
			markdown += `# ${collaborationTitle}\n\n`;
		}

		// For conversation mode, consolidate sequential entries of the same type
		if (mode === 'conversation') {
			const consolidatedEntries: Array<{
				entryType: string;
				combinedContent: string;
				lastTimestamp: string;
				headerTitle: string;
			}> = [];

			logDataEntries.forEach((logDataEntry) => {
				if (!logDataEntryHasLogEntry(logDataEntry)) {
					return; // Skip conversation start entries for conversation mode
				}

				const entryType = logDataEntry.logEntry.entryType;
				const content = logDataEntry.logEntry.content;
				const timestamp = new Date(logDataEntry.timestamp).toLocaleString();

				// Only include user and assistant messages for conversation mode
				if (!['user', 'assistant', 'answer', 'orchestrator'].includes(entryType)) {
					return;
				}

				// Determine header title
				let headerTitle = '';
				switch (entryType) {
					case 'user':
						headerTitle = projectConfig?.myPersonsName || 'User';
						break;
					case 'assistant':
					case 'answer':
						headerTitle = projectConfig?.myAssistantsName || 'Assistant';
						break;
					case 'orchestrator':
						headerTitle = 'Orchestrator';
						break;
					default:
						headerTitle = entryType.charAt(0).toUpperCase() + entryType.slice(1);
				}

				const contentText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

				// Check if we can consolidate with the last entry
				const lastEntry = consolidatedEntries[consolidatedEntries.length - 1];
				if (lastEntry && lastEntry.entryType === entryType) {
					// Consolidate with previous entry
					lastEntry.combinedContent += '\n\n' + contentText;
					lastEntry.lastTimestamp = timestamp; // Use timestamp from last entry
				} else {
					// Create new consolidated entry
					consolidatedEntries.push({
						entryType,
						combinedContent: contentText,
						lastTimestamp: timestamp,
						headerTitle,
					});
				}
			});

			// Generate markdown from consolidated entries
			consolidatedEntries.forEach((entry, index) => {
				markdown += `## ${entry.headerTitle}\n*${entry.lastTimestamp}*\n\n`;
				markdown += entry.combinedContent + '\n\n';

				// Add separator between entries (except for the last one)
				if (index < consolidatedEntries.length - 1) {
					markdown += '---\n\n';
				}
			});

			return markdown.trim();
		}

		// Process each log entry (for 'all' and 'displayed' modes)
		logDataEntries.forEach((logDataEntry, index) => {
			if (!logDataEntryHasLogEntry(logDataEntry)) {
				// Handle conversation start entries
				if ((mode as ExportMode) !== 'conversation') {
					markdown += `---\n\n**Conversation Start**\n\n`;
				}
				return;
			}

			const entryType = logDataEntry.logEntry.entryType;
			const content = logDataEntry.logEntry.content;
			const timestamp = new Date(logDataEntry.timestamp).toLocaleString();
			const isExpanded = isEntryExpanded(logDataEntry, index);
			console.log('ToolBar: logDataEntry', logDataEntry);
			console.log('ToolBar: content', { entryType, content });

			// Filter based on mode
			if ((mode as ExportMode) === 'conversation') {
				// Only include user and assistant messages
				if (!['user', 'assistant', 'answer', 'orchestrator'].includes(entryType)) {
					return;
				}
			} else if (mode === 'displayed' && !isExpanded) {
				// For collapsed entries, use formatted result preview if available, otherwise fallback
				let headerTitle = '';
				let summaryText = '';

				// Fallback to original logic when formatted data not available
				if (typeof content === 'string') {
					summaryText = getContentSummary(content, 100);
				} else {
					// For structured content, create a readable summary
					if (entryType === 'tool_use' && content && typeof content === 'object') {
						const toolData = content as any;
						const keys = Object.keys(toolData).slice(0, 3);
						if (keys.length > 0) {
							const paramSummary = keys.map((key) => {
								const value = toolData[key];
								if (typeof value === 'string') {
									return `${key}: ${value.slice(0, 30)}${value.length > 30 ? '...' : ''}`;
								} else {
									return `${key}: ${typeof value}`;
								}
							}).join(', ');
							summaryText = getContentSummary(paramSummary, 100);
						} else {
							summaryText = 'No parameters';
						}
					} else if (entryType === 'tool_result' && content && typeof content === 'object') {
						const resultData = content as any;
						if (resultData.success !== undefined) {
							const status = resultData.success ? 'Success' : 'Failed';
							const message = resultData.message || resultData.error || '';
							summaryText = getContentSummary(`${status}: ${message}`, 100);
						} else if (resultData.content || resultData.result) {
							const resultContent = String(resultData.content || resultData.result);
							summaryText = getContentSummary(resultContent, 100);
						} else {
							const keys = Object.keys(resultData).slice(0, 3);
							summaryText = keys.length > 0 ? `Contains: ${keys.join(', ')}` : 'Empty result';
						}
					} else if (entryType === 'auxiliary' && content && typeof content === 'object') {
						summaryText = (content as AuxiliaryChatContent).message;
					} else {
						const jsonString = JSON.stringify(content, null, 2);
						summaryText = getContentSummary(jsonString, 100);
					}
				}
				// Set header title for fallback
				headerTitle = entryType === 'tool_use'
					? `Tool Input: ${logDataEntry.logEntry.toolName || 'Unknown Tool'}`
					: entryType === 'tool_result'
					? `Tool Output: ${logDataEntry.logEntry.toolName || 'Unknown Tool'}`
					: entryType.charAt(0).toUpperCase() + entryType.slice(1);

				// Add entry header with improved formatting
				markdown += `### ${headerTitle} (collapsed)\n*${timestamp}*\n\n`;
				markdown += `*${summaryText}*\n\n`;

				// Add separator
				if (index < logDataEntries.length - 1) {
					markdown += '---\n\n';
				}
				return;
			}

			// Add entry header based on type
			switch (entryType) {
				case 'user':
					markdown += `## ${projectConfig?.myPersonsName || 'User'}\n*${timestamp}*\n\n`;
					break;
				case 'assistant':
				case 'answer':
					markdown += `## ${projectConfig?.myAssistantsName || 'Assistant'}\n*${timestamp}*\n\n`;
					break;
				case 'orchestrator':
					markdown += `## Orchestrator\n*${timestamp}*\n\n`;
					break;
				case 'tool_use':
					markdown += `### Tool Input: ${
						logDataEntry.logEntry.toolName || 'Unknown Tool'
					}\n*${timestamp}*\n\n`;
					break;
				case 'tool_result':
					markdown += `### Tool Output: ${
						logDataEntry.logEntry.toolName || 'Unknown Tool'
					}\n*${timestamp}*\n\n`;
					break;
				default:
					markdown += `### ${entryType.charAt(0).toUpperCase() + entryType.slice(1)}\n*${timestamp}*\n\n`;
			}

			// Add content
			if (typeof content === 'string') {
				markdown += content + '\n\n';
			} else {
				if (entryType === 'auxiliary' && content && typeof content === 'object') {
					markdown += (content as AuxiliaryChatContent).message + '\n\n';
				} else { // For non-string content (like tool input/output), format as code block
					markdown += '```json\n' + JSON.stringify(content, null, 2) + '\n```\n\n';
				}
			}

			// Add separator between entries (except for the last one)
			if (index < logDataEntries.length - 1) {
				markdown += '---\n\n';
			}
		});

		return markdown.trim();
	};

	const handleAddFilesTemplate = () => {
		if (!chatInputRef.current) return;

		const { textarea, adjustHeight } = chatInputRef.current;

		const template = '- `path/to/file`';
		const placeholder = 'path/to/file';

		// Get current content and cursor position
		const currentContent = textarea.value;
		const currentPosition = textarea.selectionStart;

		// If empty or at start, add the initial prompt text
		if (!currentContent) {
			const initialText = 'Add these files to the conversation:\n' + template;
			textarea.value = initialText;
			// Adjust height after setting initial value
			adjustHeight();
			// Find and select the placeholder
			const placeholderStart = initialText.indexOf(placeholder);
			textarea.setSelectionRange(placeholderStart, placeholderStart + placeholder.length);
			textarea.focus();
			// Adjust height after modifying content
			adjustHeight();
			return;
		}

		// Add a new template line
		let newContent: string;
		if (currentContent.endsWith('\n')) {
			newContent = currentContent + template;
		} else {
			newContent = currentContent + '\n' + template;
		}
		textarea.value = newContent;
		// Adjust height after adding new content
		adjustHeight();

		// Find the first unmodified placeholder
		const lines = newContent.split('\n');
		let placeholderLineIndex = -1;
		let accumulatedLength = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.includes('`' + placeholder + '`')) {
				placeholderLineIndex = i;
				break;
			}
			// +1 for the newline character
			accumulatedLength += line.length + 1;
		}

		if (placeholderLineIndex !== -1) {
			const placeholderStart = accumulatedLength + lines[placeholderLineIndex].indexOf(placeholder);
			textarea.setSelectionRange(placeholderStart, placeholderStart + placeholder.length);
		} else {
			// If no placeholder found, move cursor to end of newly added line
			textarea.setSelectionRange(newContent.length, newContent.length);
		}
		textarea.focus();
	};

	// Handle '?' keyboard shortcut
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only trigger if '?' is pressed and chat input is not focused
			if (
				e.key === '?' &&
				document.activeElement !== chatInputRef.current?.textarea &&
				!showHelp
			) {
				e.preventDefault();
				setShowHelp(true);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [showHelp, chatInputRef]);

	// Handle click outside dropdown
	useEffect(() => {
		if (!showExportDropdown) return;

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('.export-dropdown-container')) {
				setShowExportDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showExportDropdown]);

	return (
		<>
			<div className='flex items-center space-x-2'>
				{/* Template Button */}
				<button
					onClick={handleAddFilesTemplate}
					disabled={disabled}
					title={`Insert template for adding files`}
					className='p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200'
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={1.5}
						stroke='currentColor'
						className='w-5 h-5'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
						/>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M12 10.5v6m3-3H9'
						/>
					</svg>
				</button>

				{/* Export Dropdown */}
				<div className='relative export-dropdown-container'>
					<button
						onClick={() => setShowExportDropdown(!showExportDropdown)}
						disabled={disabled || !logDataEntries || logDataEntries.length === 0}
						title='Export conversation'
						className='p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.5}
							stroke='currentColor'
							className='w-5 h-5'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184'
							/>
						</svg>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.5}
							stroke='currentColor'
							className='w-3 h-3 ml-1'
						>
							<path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
						</svg>
					</button>

					{/* Dropdown Menu */}
					{showExportDropdown && (
						<div className='absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50'>
							<div className='py-1'>
								<button
									onClick={handlePreviewClick}
									className='w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
								>
									<div className='font-medium'>Preview & Export</div>
									<div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
										Preview conversation with copy and print options
									</div>
								</button>
								<div className='border-t border-gray-200 dark:border-gray-600 my-1'></div>
								<button
									onClick={() => handleExportClick('all')}
									className='w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
								>
									<div className='font-medium'>Copy All Content</div>
									<div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
										Export all messages including collapsed content
									</div>
								</button>
								<button
									onClick={() => handleExportClick('displayed')}
									className='w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
								>
									<div className='font-medium'>Copy Displayed Content</div>
									<div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
										Export visible content with summaries for collapsed items
									</div>
								</button>
								<button
									onClick={() => handleExportClick('conversation')}
									className='w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
								>
									<div className='font-medium'>Copy Conversation Only</div>
									<div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
										Export only user and assistant messages
									</div>
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Divider */}
				<div className='h-6 w-px bg-gray-200' />

				{/* Metrics Button */}
				<button
					onClick={handleMetricsClick}
					disabled={disabled}
					title='Show conversation metrics'
					className='p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={1.5}
						stroke='currentColor'
						className='w-5 h-5'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z'
						/>
					</svg>
				</button>

				{/* Summary Button */}
				<button
					onClick={handleSummaryClick}
					disabled={disabled}
					title='Summarize and truncate conversation'
					className='p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={1.5}
						stroke='currentColor'
						className='w-5 h-5'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25'
						/>
					</svg>
				</button>

				{/* Help Button */}
				<HelpButton
					onClick={() => setShowHelp(true)}
					disabled={disabled}
				/>
			</div>

			{/* Help Dialog */}
			<HelpDialog
				visible={showHelp}
				onClose={() => setShowHelp(false)}
				apiClient={apiClient}
			/>

			{/* Preview Overlay */}
			{showPreviewOverlay && (
				<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
					<div className='bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col'>
						{/* Header */}
						<div className='p-6 border-b border-gray-200 dark:border-gray-700'>
							<div className='flex items-center justify-between mb-4'>
								<h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
									{collaborationTitle ? `Preview: ${collaborationTitle}` : 'Conversation Preview'}
								</h2>
								<button
									onClick={() => setShowPreviewOverlay(false)}
									className='p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md'
									title='Close preview'
								>
									<svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								</button>
							</div>
							{/* Content Type Toggles */}
							<div className='flex items-center space-x-1 text-sm mb-4'>
								<span className='text-gray-600 dark:text-gray-400 mr-3'>Content:</span>
								<button
									onClick={() => setPreviewMode('all')}
									className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
										previewMode === 'all'
											? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
											: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
									}`}
								>
									All Content
								</button>
								<button
									onClick={() => setPreviewMode('displayed')}
									className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
										previewMode === 'displayed'
											? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
											: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
									}`}
								>
									Displayed Content
								</button>
								<button
									onClick={() => setPreviewMode('conversation')}
									className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
										previewMode === 'conversation'
											? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
											: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
									}`}
								>
									Conversation Content
								</button>
							</div>
							<div className='flex items-center space-x-2'>
								{/* Copy Button */}
								<button
									onClick={handleCopyFromPreview}
									className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors flex items-center space-x-2'
									title='Copy conversation content'
								>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3'
										/>
									</svg>
									<span>Copy</span>
								</button>
								{/* Print Button */}
								<button
									onClick={handlePrintFromPreview}
									className='px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center space-x-2'
									title='Print conversation'
								>
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z'
										/>
									</svg>
									<span>Print</span>
								</button>
							</div>
						</div>

						{/* Content */}
						<div className='flex-1 overflow-auto p-6'>
							<div
								id='conversation-preview-content'
								className='prose prose-sm max-w-none dark:prose-invert'
								dangerouslySetInnerHTML={{ __html: generateHtmlContent() }}
							/>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
