import { JSX } from 'preact';

interface ProjectManagerEmptyProps {
	onCreateNew: () => void;
}

export function ProjectManagerEmpty({ onCreateNew }: ProjectManagerEmptyProps): JSX.Element {
	// Project type examples with descriptions
	interface ProjectTypeExample {
		title: string;
		description: string;
		icon: JSX.Element;
		color: string;
		examples: string[];
	}

	const projectTypes: ProjectTypeExample[] = [
		{
			title: 'Code Projects',
			description: 'Create projects for software development repositories',
			icon: (
				<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'
					/>
				</svg>
			),
			color: 'blue',
			examples: [
				'Web application projects',
				'Mobile app development',
				'Backend services',
				'Libraries and frameworks',
			],
		},
		{
			title: 'Content Projects',
			description: 'Organize writing and documentation projects',
			icon: (
				<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
					/>
				</svg>
			),
			color: 'emerald',
			examples: [
				'Technical documentation',
				'Blog articles and content',
				'Knowledge bases',
				'Research papers',
			],
		},
		{
			title: 'Data Analysis',
			description: 'Set up projects for data analysis workflows',
			icon: (
				<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
					/>
				</svg>
			),
			color: 'amber',
			examples: [
				'Data science projects',
				'Analytics dashboards',
				'Visualization projects',
				'Research datasets',
			],
		},
		{
			title: 'Multi-Source Projects',
			description: 'Connect to multiple data sources in a single project',
			icon: (
				<svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
					/>
				</svg>
			),
			color: 'indigo',
			examples: [
				'Local and cloud sources',
				'Database and filesystem',
				'API integrations',
				'Remote repositories',
			],
		},
	];

	const renderProjectType = (projectType: ProjectTypeExample) => {
		return (
			<div
				className={`space-y-3 p-4 rounded-lg bg-${projectType.color}-50 dark:bg-${projectType.color}-900/20 border border-${projectType.color}-100 dark:border-${projectType.color}-800/30`}
			>
				<h3
					className={`text-md font-medium text-${projectType.color}-700 dark:text-${projectType.color}-300 flex items-center`}
				>
					{projectType.icon}
					{projectType.title}
				</h3>
				<p className={`text-xs text-${projectType.color}-600 dark:text-${projectType.color}-400`}>
					{projectType.description}
				</p>
				<ul
					className={`text-sm text-${projectType.color}-700 dark:text-${projectType.color}-300 space-y-1 ml-6 list-disc`}
				>
					{projectType.examples.map((example, i) => <li key={i}>{example}</li>)}
				</ul>
			</div>
		);
	};

	return (
		<div className='flex flex-col items-center justify-center py-8'>
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
						d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
					/>
				</svg>
				<h2 className='text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2'>
					Ready to create your first project?
				</h2>
				<p className='text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto'>
					Create a project to connect BB to your files, repositories, or other data sources. Each project can
					be configured with one or more data sources.
				</p>
			</div>

			{/* Project Type Cards */}
			<div className='w-full max-w-4xl mb-6'>
				<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
					{projectTypes.map(renderProjectType)}
				</div>
			</div>

			{/* Create New Project Button */}
			<button
				type='button'
				onClick={onCreateNew}
				className='mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 flex items-center'
			>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					className='h-5 w-5 mr-2'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
				</svg>
				Create New Project
			</button>
		</div>
	);
}
