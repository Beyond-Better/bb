import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { RefObject } from 'preact/compat';
type MouseEvent = JSX.TargetedMouseEvent<HTMLButtonElement>;

import { HelpButton } from './Help/HelpButton.tsx';
import { HelpDialog } from './Help/HelpDialog.tsx';

import type { ApiClient } from '../utils/apiClient.utils.ts';

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
}

export function ToolBar({ onSendMessage, chatInputRef, disabled, projectId, apiClient }: ToolBarProps): JSX.Element {
	const [showHelp, setShowHelp] = useState(false);

	const handleMetricsClick = () => {
		onSendMessage('Provide conversation metrics');
	};

	const handleSummaryClick = () => {
		onSendMessage("Create a 'long' conversation summary keeping max of 20,000 tokens");
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
		</>
	);
}
