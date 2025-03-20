import { JSX } from 'preact';

interface ConversationStateEmptyProps {
	setInputWithTracking: (value: string) => void;
	chatInputRef: React.RefObject<{
		textarea: HTMLTextAreaElement;
		adjustHeight: () => void;
	}>;
}

export function ConversationStateEmpty({
	setInputWithTracking,
	chatInputRef,
}: ConversationStateEmptyProps): JSX.Element {
	// Function to create template buttons
	const renderTemplateButtons = (templates: string[]) => {
		return templates.map((template, i) => (
			<button
				key={i}
				onClick={() => {
					setInputWithTracking(template);
					if (chatInputRef.current?.textarea) {
						chatInputRef.current.textarea.focus();
					}
				}}
				className='w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700 transition-colors'
			>
				<p className='text-sm text-gray-700 dark:text-gray-300'>{template}</p>
			</button>
		));
	};

	const researchTemplates = [
		'I want to analyze these papers to identify key research trends in [topic]',
		'I need to create a literature review comparing different approaches to [topic]',
		'Help me develop a research methodology for studying [phenomenon]',
		'I want to visualize the relationships between variables in my dataset',
	];

	const contentTemplates = [
		'I need to create a content strategy for [topic] that works across multiple channels',
		'Help me develop a detailed outline for an article about [topic]',
		'I want to adapt this content for different audiences while maintaining consistent messaging',
		'Help me research [topic] to create authoritative content',
	];

	const analysisTemplates = [
		'I want to integrate data from these sources to understand [business question]',
		'Help me create visualizations that show the relationship between [variables]',
		'I need to segment our customers based on their behavior and preferences',
		'I want to analyze these metrics to identify opportunities for improvement',
	];

	const developmentTemplates = [
		'I need to design a system that handles [functionality] for [use case]',
		'Help me implement [feature] that integrates with our existing [component]',
		'I want to refactor this code to improve [aspect] while maintaining functionality',
		'I need to create tests for [component] to ensure it works as expected',
	];

	return (
		<div className='flex flex-col items-center justify-center min-h-[400px] px-6 py-8'>
			<div className='text-center mb-8'>
				<svg
					className='w-12 h-12 mb-4 mx-auto text-blue-500 dark:text-blue-400'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
					/>
				</svg>
				<h2 className='text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2'>
					What would you like to achieve today?
				</h2>
				<p className='text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto'>
					Focus on your objectives, not implementation details. BB works best when you describe what you want
					to accomplish.
				</p>
			</div>

			{/* Domain Tabs */}
			<div className='w-full max-w-4xl mb-6'>
				<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
					{/* Research Templates */}
					<div className='space-y-3 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30'>
						<h3 className='text-md font-medium text-indigo-700 dark:text-indigo-300 flex items-center'>
							<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
								/>
							</svg>
							Research Tasks
						</h3>
						<div className='space-y-2'>
							{renderTemplateButtons(researchTemplates)}
						</div>
					</div>

					{/* Content Templates */}
					<div className='space-y-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30'>
						<h3 className='text-md font-medium text-emerald-700 dark:text-emerald-300 flex items-center'>
							<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
								/>
							</svg>
							Content Tasks
						</h3>
						<div className='space-y-2'>
							{renderTemplateButtons(contentTemplates)}
						</div>
					</div>

					{/* Analysis Templates */}
					<div className='space-y-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30'>
						<h3 className='text-md font-medium text-amber-700 dark:text-amber-300 flex items-center'>
							<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
								/>
							</svg>
							Analysis Tasks
						</h3>
						<div className='space-y-2'>
							{renderTemplateButtons(analysisTemplates)}
						</div>
					</div>

					{/* Development Templates */}
					<div className='space-y-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30'>
						<h3 className='text-md font-medium text-blue-700 dark:text-blue-300 flex items-center'>
							<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'
								/>
							</svg>
							Development Tasks
						</h3>
						<div className='space-y-2'>
							{renderTemplateButtons(developmentTemplates)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
