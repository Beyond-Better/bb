import { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';
import { useFadeTransition, useTransition } from '../../hooks/useTransition.ts';

interface HelpDialogProps {
	visible: boolean;
	onClose: () => void;
}

interface HelpSection {
	title: string;
	content: JSX.Element;
}

const HELP_SECTIONS: HelpSection[] = [
	{
		title: 'Keyboard Shortcuts',
		content: (
			<div className='space-y-2'>
				<div className='flex justify-between items-center'>
					<span className='text-gray-600'>Show help dialog</span>
					<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>?</kbd>
				</div>
				<div className='flex justify-between items-center'>
					<span className='text-gray-600'>Send message</span>
					<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>Enter</kbd>
				</div>
				<div className='flex justify-between items-center'>
					<span className='text-gray-600'>New line in message box</span>
					<div className='flex items-center space-x-1'>
						<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>
							Ctrl
						</kbd>
						<span aria-hidden='true'>+</span>
						<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>
							Enter
						</kbd>
					</div>
				</div>
				<div className='flex justify-between items-center'>
					<span className='text-gray-600'>Alternative new line</span>
					<div className='flex items-center space-x-1'>
						<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>
							Shift
						</kbd>
						<span aria-hidden='true'>+</span>
						<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>
							Enter
						</kbd>
					</div>
				</div>
				<div className='flex justify-between items-center'>
					<span className='text-gray-600'>Expand/collapse message in history</span>
					<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>Space</kbd>
				</div>
				<div className='flex justify-between items-center'>
					<span className='text-gray-600'>Navigate messages</span>
					<div className='flex items-center space-x-1'>
						<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>↑</kbd>
						<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>↓</kbd>
					</div>
				</div>
				<div className='flex justify-between items-center'>
					<span className='text-gray-600'>Clear message box</span>
					<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>Esc</kbd>
				</div>
			</div>
		),
	},
	{
		title: 'Navigation & Messages',
		content: (
			<div className='space-y-3'>
				<p className='text-gray-600'>
					Messages can be expanded or collapsed using the spacebar or by clicking the message header. Use Tab
					to move between interactive elements in messages. Each message shows a timestamp and can be copied
					using the copy button.
				</p>
				<div className='text-gray-600'>
					Messages are color-coded by role:
					<ul className='list-disc list-inside mt-2 ml-4'>
						<li>Blue - User messages</li>
						<li>Green - Assistant (Claude) responses</li>
						<li>Yellow - Tool operations and results</li>
						<li>Purple - Auxillary operations</li>
					</ul>
				</div>
			</div>
		),
	},
	{
		title: 'Conversations',
		content: (
			<div className='space-y-3'>
				<p className='text-gray-600'>
					Conversations maintain context but get more expensive as they grow longer. Each message adds to the
					token count, which affects both response time and cost. Consider starting new conversations for
					different tasks or using the conversation summary button to reduce token usage.
				</p>
				<div className='space-y-2'>
					<h4 className='font-medium text-gray-700'>Toolbar Actions:</h4>
					<ul className='list-disc list-inside space-y-1 text-gray-600'>
						<li>Add Files Template - Insert template for adding files to conversation</li>
						<li>Show Metrics - Display conversation statistics and token usage</li>
						<li>Summarize - Create a summary and truncate the conversation to reduce token usage</li>
					</ul>
					<h4 className='font-medium text-gray-700 mt-3'>Best Practices:</h4>
					<ul className='list-disc list-inside space-y-1 text-gray-600'>
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
				<p className='text-gray-600'>
					BB can work with multiple projects simultaneously. The current project directory is shown in the
					header and can be changed using the project selector to switch between projects.
				</p>
				<div className='text-gray-600'>
					All file paths are relative to the current project directory. When referencing files:
					<ul className='list-disc list-inside mt-2 ml-4'>
						<li>Use forward slashes (/) for paths</li>
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
				<p className='text-gray-600'>
					The header shows API connection status, current project, and total token usage. The connection
					indicator turns red if there are API issues. A banner appears when Claude is processing your
					request.
				</p>
				<p className='text-gray-600'>
					Token usage is tracked per conversation and shown in the conversation list.
				</p>
				<div className='text-gray-600'>
					The colored indicator shows the status of Anthropic's prompt cache. When active (green), Claude can
					reuse context from recent interactions at a 90% discount in token costs. The cache automatically
					expires after 5 minutes of inactivity, at which point Claude will need to reprocess the full context
					at standard token rates. This is handled automatically by the API and requires no user action.
					<ul className='list-disc list-inside mt-2 ml-4'>
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
				<dl className='space-y-3'>
					<div>
						<dt className='font-medium text-gray-700'>Project</dt>
						<dd className='text-gray-600'>
							<div>
								The root directory and all files BB is working with. Projects can be Git repositories
								with:
								<ul className='list-disc list-inside mt-2 ml-4'>
									<li>Source code and related files</li>
									<li>Project configuration files</li>
									<li>Documentation and resources</li>
								</ul>
							</div>
						</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Conversation</dt>
						<dd className='text-gray-600'>
							A complete interaction session with BB, containing multiple statements.
						</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Statement</dt>
						<dd className='text-gray-600'>
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
						<dt className='font-medium text-gray-700'>Turn</dt>
						<dd className='text-gray-600'>Each individual message within a statement.</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Tool Input/Output</dt>
						<dd className='text-gray-600'>
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
						<dt className='font-medium text-gray-700'>Auxiliary</dt>
						<dd className='text-gray-600'>
							Additional chat messages for conversation management (titles, commits) and objectives.
						</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Objectives</dt>
						<dd className='text-gray-600'>
							The focus given to Claude. Each statement has a new objective, plus an overall conversation
							objective. Helps maintain context and purpose throughout the conversation.
						</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Tools</dt>
						<dd className='text-gray-600'>
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
						<dt className='font-medium text-gray-700'>Tokens</dt>
						<dd className='text-gray-600'>
							The "cost unit" for working with Claude. Longer conversations use more tokens.
						</dd>
					</div>
				</dl>
			</div>
		),
	},
];

export function HelpDialog({ visible, onClose }: HelpDialogProps) {
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

	if (!dialogTransition.mounted) return null;

	return (
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
				className='bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl transform max-h-[90vh] overflow-y-auto'
				style={{
					transform: `scale(${visible ? '1' : '0.95'})`,
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div className='flex justify-between items-center mb-4 sticky top-0 bg-white pt-1 pb-3 border-b border-gray-200'>
					<h2 className='text-xl font-semibold' id='dialog-title'>Help</h2>
					<button
						onClick={onClose}
						className='text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1'
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
							<h3 className='text-lg font-medium text-gray-900 mb-3'>{section.title}</h3>
							{section.content}
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
