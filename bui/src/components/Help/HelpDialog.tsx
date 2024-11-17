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
					<span className='text-gray-600'>New line in message</span>
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
					<span className='text-gray-600'>Expand/collapse message</span>
					<kbd className='px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm shadow-sm'>Space</kbd>
				</div>
			</div>
		),
	},
	{
		title: 'Navigation & Messages',
		content: (
			<div className='space-y-3'>
				<p className='text-gray-600'>
					Messages can be expanded or collapsed using the spacebar or by clicking. Use Tab to move between
					interactive elements in messages.
				</p>
				<p className='text-gray-600'>
					Each message shows its role (user, assistant, tool) and content. Tool messages show the specific
					action being taken.
				</p>
			</div>
		),
	},
	{
		title: 'Conversations',
		content: (
			<div className='space-y-3'>
				<p className='text-gray-600'>
					Conversations get more expensive as they grow longer. Consider starting new conversations or using
					the conversation summary button to reduce token usage.
				</p>
				<div className='space-y-2'>
					<h4 className='font-medium text-gray-700'>Toolbar Actions:</h4>
					<ul className='list-disc list-inside space-y-1 text-gray-600'>
						<li>Add Files Template - Insert template for adding files to conversation</li>
						<li>Show Metrics - Display conversation statistics and token usage</li>
						<li>Summarize - Create a summary and truncate the conversation</li>
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
					BB can work with multiple projects. The current project directory is shown in the header and can be
					changed to switch between projects.
				</p>
				<p className='text-gray-600'>
					All file paths are relative to the current project directory.
				</p>
			</div>
		),
	},
	{
		title: 'Status & Information',
		content: (
			<div className='space-y-3'>
				<p className='text-gray-600'>
					The header shows API connection status and total token usage. A banner appears when Claude is
					processing your request.
				</p>
				<p className='text-gray-600'>
					Token usage is tracked per conversation and shown in the conversation list.
				</p>
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
							The root directory and all files BB is working with. BB can work with multiple projects.
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
							All messages from a user query through the assistant's answer, including tool messages.
						</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Turn</dt>
						<dd className='text-gray-600'>Each individual message within a statement.</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Tool Input/Output</dt>
						<dd className='text-gray-600'>
							Requests from Claude for BB to take action (input) and the results of those actions
							(output).
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
							objective.
						</dd>
					</div>
					<div>
						<dt className='font-medium text-gray-700'>Tools</dt>
						<dd className='text-gray-600'>
							The core functionality that enables BB to take action - the code that performs tasks.
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
