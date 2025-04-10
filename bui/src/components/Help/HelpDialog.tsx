import { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { StatusDialog } from '../Status/StatusDialog.tsx';
import { CertificateStatusIndicator } from '../CertificateStatusIndicator.tsx';
import { VersionInfo } from '../Version/VersionInfo.tsx';
import { VersionWarning } from '../Version/VersionWarning.tsx';
import { useVersion } from '../../hooks/useVersion.ts';
import type { ApiClient } from '../../utils/apiClient.utils.ts';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';
import { useFadeTransition, useTransition } from '../../hooks/useTransition.ts';

interface HelpDialogProps {
	visible: boolean;
	onClose: () => void;
	apiClient: ApiClient;
}

interface HelpSection {
	title: string;
	content: JSX.Element;
}

export function HelpDialog({ visible, onClose, apiClient }: HelpDialogProps) {
	const [showStatus, setShowStatus] = useState(false);
	const { versionInfo, versionCompatibility } = useVersion();

	const focusTrapRef = useFocusTrap({
		enabled: visible,
		onEscape: onClose,
	});

	// Prevent body scroll when dialog is open
	useEffect(() => {
		if (visible) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [visible]);

	const dialogTransition = useTransition(visible, {
		duration: 200,
		delay: 50,
	});

	const overlayTransition = useFadeTransition(visible, {
		duration: 200,
	});

	const HELP_SECTIONS: HelpSection[] = [
		{
			title: 'Keyboard Shortcuts',
			content: (
				<div className='space-y-2'>
					<div className='flex justify-between items-center text-gray-600 dark:text-gray-300'>
						<span className='text-gray-600 dark:text-gray-300'>Show help dialog</span>
						<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm'>
							?
						</kbd>
					</div>
					<div className='flex justify-between items-center text-gray-600 dark:text-gray-300'>
						<span className='text-gray-600 dark:text-gray-300'>Send message</span>
						<div className='flex items-center space-x-1 text-gray-600 dark:text-gray-300'>
							<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm'>
								Cmd/Ctrl
							</kbd>
							<span aria-hidden='true' className='text-gray-600 dark:text-gray-400'>+</span>
							<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm text-gray-700 dark:text-gray-300'>
								Enter
							</kbd>
						</div>
					</div>
					<div className='flex justify-between items-center'>
						<span className='text-gray-600 dark:text-gray-300'>New line in message box</span>
						<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm text-gray-700 dark:text-gray-300'>
							Enter
						</kbd>
					</div>
					<div className='flex justify-between items-center'>
						<span className='text-gray-600 dark:text-gray-300'>Expand/collapse message in history</span>
						<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm text-gray-700 dark:text-gray-300'>
							Space
						</kbd>
					</div>
					<div className='flex justify-between items-center'>
						<span className='text-gray-600 dark:text-gray-300'>Navigate messages</span>
						<div className='flex items-center space-x-1 text-gray-600 dark:text-gray-300'>
							<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm text-gray-700 dark:text-gray-300'>
								↑
							</kbd>
							<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm text-gray-700 dark:text-gray-300'>
								↓
							</kbd>
						</div>
					</div>
					<div className='flex justify-between items-center'>
						<span className='text-gray-600 dark:text-gray-300'>Clear message box</span>
						<kbd className='px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm shadow-sm text-gray-700 dark:text-gray-300'>
							Esc
						</kbd>
					</div>
				</div>
			),
		},
		{
			title: 'Auto-Complete - File Suggestions',
			content: (
				<div className='space-y-3'>
					<p className='text-gray-600 dark:text-gray-300'>
						BB provides intelligent file suggestions to help you quickly reference project files. There are
						two ways to trigger suggestions:
					</p>
					<div className='space-y-2'>
						<h4 className='font-medium text-gray-700 dark:text-gray-200'>Trigger Methods:</h4>
						<ul className='list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300'>
							<li>
								<span className='font-medium text-gray-900 dark:text-gray-100'>Slash Trigger (/)</span>
								{' '}
								- Type a forward slash to show suggestions. Continue typing to refine the list in
								real-time.
							</li>
							<li>
								<span className='font-medium text-gray-700 dark:text-gray-200'>Tab Trigger</span>{' '}
								- Press Tab at any point to show suggestions. Works with empty input or after typing a
								partial path. Continue typing to refine suggestions.
							</li>
						</ul>

						<h4 className='font-medium text-gray-700 dark:text-gray-200 mt-3'>Advanced Features:</h4>
						<ul className='list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300'>
							<li>
								<span className='font-medium text-gray-700 dark:text-gray-200'>Wildcards</span>{' '}
								- Use * to match any characters:
								<ul className='list-inside ml-6 mt-1 text-gray-600 dark:text-gray-300'>
									<li>"*.ts" - All TypeScript files</li>
									<li>"test/*" - All files in test directory</li>
									<li>"src/**/*.tsx" - All TSX files in src and subdirectories</li>
								</ul>
							</li>
							<li>
								<span className='font-medium text-gray-700 dark:text-gray-200'>
									Directory Navigation
								</span>{' '}
								- Both files and directories can be selected. Directories are indicated with a trailing
								slash (/).
							</li>
						</ul>

						<h4 className='font-medium text-gray-700 dark:text-gray-200 mt-3'>Navigation & Selection:</h4>
						<ul className='list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300'>
							<li>
								<span className='font-medium'>Keyboard Navigation</span>:
								<ul className='list-inside ml-6 mt-1 text-gray-600 dark:text-gray-300'>
									<li>↑/↓ Arrow keys to move through suggestions</li>
									<li>Enter to select highlighted suggestion</li>
									<li>Escape to close suggestions</li>
								</ul>
							</li>
							<li>
								<span className='font-medium'>Suggestion Details</span> - Each suggestion shows:
								<ul className='list-inside ml-6 mt-1 text-gray-600 dark:text-gray-300'>
									<li>File/directory name</li>
									<li>Parent directory path in parentheses</li>
									<li>Trailing slash (/) for directories</li>
								</ul>
							</li>
						</ul>

						<h4 className='font-medium text-gray-700 dark:text-gray-200 mt-3'>Best Practices:</h4>
						<ul className='list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300'>
							<li>
								When referencing multiple files, list each one on a new line for better readability and
								LLM processing
							</li>
							<li>Use Tab completion to quickly navigate deep directory structures</li>
							<li>Combine wildcards with partial paths to find specific file types in subdirectories</li>
							<li>Press Escape to close the suggestions list without making a selection</li>
						</ul>
					</div>
				</div>
			),
		},
		{
			title: 'Navigation & Messages',
			content: (
				<div className='space-y-3'>
					<p className='text-gray-600 dark:text-gray-300'>
						Messages can be expanded or collapsed using the spacebar or by clicking the message header. Use
						Tab to move between interactive elements in messages. Each message shows a timestamp and can be
						copied using the copy button.
					</p>
					<div className='text-gray-600 dark:text-gray-300'>
						Messages are color-coded by role:
						<ul className='space-y-1 mt-2 ml-4'>
							<li className='bg-blue-50 dark:bg-blue-950/50 p-2 rounded'>
								<span className='text-blue-700 dark:text-blue-300'>Blue</span> - User messages
							</li>
							<li className='bg-green-50 dark:bg-green-950/50 p-2 rounded'>
								<span className='text-green-700 dark:text-green-300'>Green</span>{' '}
								- Assistant (Claude) responses
							</li>
							<li className='bg-yellow-50 dark:bg-yellow-950/50 p-2 rounded'>
								<span className='text-yellow-700 dark:text-yellow-300'>Yellow</span>{' '}
								- Tool operations and results
							</li>
							<li className='bg-purple-50 dark:bg-purple-950/50 p-2 rounded'>
								<span className='text-purple-700 dark:text-purple-300'>Purple</span>{' '}
								- Auxiliary operations
							</li>
						</ul>
					</div>
				</div>
			),
		},
		{
			title: 'Conversations',
			content: (
				<div className='space-y-3'>
					<p className='text-gray-600 dark:text-gray-300'>
						Conversations maintain context but get more expensive as they grow longer. Each message adds to
						the token count, which affects both response time and cost. Consider starting new conversations
						for different tasks or using the conversation summary button to reduce token usage.
					</p>
					<div className='space-y-2'>
						<h4 className='font-medium text-gray-700 dark:text-gray-200'>Toolbar Actions:</h4>
						<ul className='list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300'>
							<li>Add Files Template - Insert template for adding files to conversation</li>
							<li>Show Metrics - Display conversation statistics and token usage</li>
							<li>Summarize - Create a summary and truncate the conversation to reduce token usage</li>
						</ul>
						<h4 className='font-medium text-gray-700 dark:text-gray-200 mt-3'>Best Practices:</h4>
						<ul className='list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300'>
							<li>Start new conversations for unrelated tasks</li>
							<li>Use conversation summary when context grows too large</li>
							<li>Remove unused files from the conversation</li>
						</ul>
					</div>
				</div>
			),
		},
		{
			title: 'Project Management',
			content: (
				<div className='space-y-3'>
					<p className='text-gray-600 dark:text-gray-300'>
						BB can work with multiple projects simultaneously. The current project directory is shown in the
						header and can be changed using the project selector to switch between projects.
					</p>
					<div className='text-gray-600 dark:text-gray-300'>
						All file paths are relative to the current project directory. When referencing files:
						<ul className='list-disc list-inside mt-2 ml-4 text-gray-600 dark:text-gray-300'>
							<li>{`Use forward slashes (/) for paths`}</li>
							<li>Paths start from the project root</li>
							<li>Example: "src/components/Button.tsx"</li>
						</ul>
						BB will automatically handle path conversions for your operating system.
					</div>
				</div>
			),
		},
		{
			title: 'Status & Information',
			content: (
				<div className='space-y-3'>
					<div className='space-y-3'>
						<p className='text-gray-600 dark:text-gray-300'>
							The header shows API connection status, current project, and total token usage. The
							connection indicator turns red if there are API issues. A banner appears when Claude is
							processing your request.
						</p>

						<div className='bg-gray-50 dark:bg-gray-800 p-4 rounded-lg'>
							<h4 className='font-medium text-gray-700 dark:text-gray-200 mb-2'>API Security</h4>
							<p className='text-gray-600 dark:text-gray-300 mb-3'>
								BB uses TLS (HTTPS) to secure communication between the browser and API. This ensures
								your data remains private and protected.
							</p>
							<button
								onClick={() => setShowStatus(true)}
								className='inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-md transition-colors'
							>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									strokeWidth={2}
									stroke='currentColor'
									className='w-5 h-5'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z'
									/>
								</svg>
								<span className='text-sm font-medium text-gray-700 dark:text-gray-200'>
									View Security Status
								</span>
							</button>
						</div>
					</div>
					<p className='text-gray-600 dark:text-gray-300'>
						Token usage is tracked per conversation and shown in the conversation list.
					</p>
					<div className='text-gray-600 dark:text-gray-300'>
						The colored indicator shows the status of Anthropic's prompt cache. When active (green), Claude
						can reuse context from recent interactions at a 90% discount in token costs. The cache
						automatically expires after 5 minutes of inactivity, at which point Claude will need to
						reprocess the full context at standard token rates. This is handled automatically by the BB
						server and requires no user action.
						<ul className='list-disc list-inside mt-2 ml-4 text-gray-600 dark:text-gray-300'>
							<li>Green - Cache active (90% token discount)</li>
							<li>Yellow - Cache expiring soon</li>
							<li>Gray - No active cache</li>
						</ul>
					</div>
				</div>
			),
		},
		{
			title: 'Terms & Definitions',
			content: (
				<div className='space-y-3'>
					<dl className='space-y-3 text-gray-600 dark:text-gray-300'>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Project</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								<div>
									The root directory and all files BB is working with. Projects can be local folder,
									Notion or Google Drive with:
									<ul className='list-disc list-inside mt-2 ml-4 text-gray-600 dark:text-gray-300'>
										<li>Source code and related files</li>
										<li>Project configuration files</li>
										<li>Documentation and resources</li>
									</ul>
								</div>
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Conversation</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								A complete interaction session with BB, containing multiple statements.
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Statement</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								<div>
									A complete interaction including:
									<ul className='list-disc list-inside mt-2 ml-4'>
										<li>Your initial query</li>
										<li>Claude's response and any tool usage</li>
										<li>Final results or answers</li>
									</ul>
								</div>
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Turn</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								Each individual message within a statement.
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Tool Input/Output</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								<div>
									Actions BB can perform, such as:
									<ul className='list-disc list-inside mt-2 ml-4'>
										<li>Reading and modifying files</li>
										<li>Running commands</li>
										<li>Fetching web content</li>
									</ul>
								</div>
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Auxiliary</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								Additional chat messages for conversation management (titles, commits) and objectives.
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Objectives</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								The focus given to Claude. Each statement has a new objective, plus an overall
								conversation objective. Helps maintain context and purpose throughout the conversation.
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Tools</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								<div>
									BB's core capabilities including:
									<ul className='list-disc list-inside mt-2 ml-4'>
										<li>File operations (read, write, move)</li>
										<li>Code analysis and modification</li>
										<li>Project management</li>
										<li>Web content retrieval</li>
										<li>System command execution</li>
										<li>Conversation management</li>
									</ul>
								</div>
							</dd>
						</div>
						<div>
							<dt className='font-medium text-gray-700 dark:text-gray-200'>Tokens</dt>
							<dd className='text-gray-600 dark:text-gray-300'>
								The "cost unit" for working with Claude. Longer conversations use more tokens.
							</dd>
						</div>
					</dl>
				</div>
			),
		},
		{
			title: 'Version Information',
			content: (
				<div className='space-y-4'>
					{versionInfo && <VersionInfo versionInfo={versionInfo} />}
					{versionCompatibility && !versionCompatibility.compatible && (
						<VersionWarning apiClient={apiClient} />
					)}
				</div>
			),
		},
	];

	if (!dialogTransition.mounted) return null;

	return (
		<>
			<div
				className='fixed inset-0 flex items-center justify-center z-50'
				style={{
					...overlayTransition.style,
					backgroundColor: `rgba(0, 0, 0, ${visible ? '0.5' : '0'})`,
				}}
				role='dialog'
				aria-modal='true'
				aria-label='Help'
				onClick={onClose}
			>
				<div
					ref={focusTrapRef}
					className='bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full shadow-xl transform max-h-[90vh] overflow-y-auto'
					style={{
						transform: `scale(${visible ? '1' : '0.95'})`,
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div className='flex justify-between items-center mb-4 sticky top-0 bg-white dark:bg-gray-900 pt-1 pb-3 border-b border-gray-200 dark:border-gray-700'>
						<h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100' id='dialog-title'>
							Help
						</h2>
						<button
							onClick={onClose}
							className='text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1'
							aria-label='Close help dialog'
						>
							<svg
								className='w-6 h-6'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
								aria-hidden='true'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M6 18L18 6M6 6l12 12'
								/>
							</svg>
						</button>
					</div>

					<div className='space-y-6'>
						{HELP_SECTIONS.map((section, index) => (
							<section key={index} className='border-b border-gray-200 last:border-0 pb-6 last:pb-0'>
								<h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-3'>
									{section.title}
								</h3>
								{section.content}
							</section>
						))}
					</div>
				</div>
			</div>

			{/* Status Dialog */}
			<StatusDialog
				visible={showStatus}
				onClose={() => setShowStatus(false)}
				apiClient={apiClient}
			/>
		</>
	);
}
