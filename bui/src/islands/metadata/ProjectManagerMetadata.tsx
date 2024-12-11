import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

interface ProjectManagerMetadataProps {
	view?: 'grid' | 'list';
	onViewChange?: (view: 'grid' | 'list') => void;
}

interface ProjectStats {
	total: number;
	active: number;
	recent: number;
}

// Initialize stats signal with default values
const stats = signal<ProjectStats>({
	total: 0,
	active: 0,
	recent: 0,
});

export function ProjectManagerMetadata({ view = 'grid', onViewChange }: ProjectManagerMetadataProps) {
	// TODO: Fetch actual stats from API
	useEffect(() => {
		// Placeholder for API call
		console.log('Fetch project stats');
	}, []);

	return (
		<div class='flex items-center space-x-6 pl-4'>
			{/* Project Stats */}
			<div class='flex items-center space-x-4'>
				{/* Total Projects */}
				<div class='flex items-center space-x-1'>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-4 h-4 text-gray-400'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d='M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
						/>
					</svg>
					<span class='text-sm text-gray-500'>
						{stats.value.total} projects
					</span>
				</div>

				{/* Active Projects */}
				<div class='flex items-center space-x-1'>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-4 h-4 text-gray-400'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d='M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z'
						/>
					</svg>
					<span class='text-sm text-gray-500'>
						{stats.value.active} active
					</span>
				</div>

				{/* Recent Projects */}
				<div class='flex items-center space-x-1'>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-4 h-4 text-gray-400'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d='M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
						/>
					</svg>
					<span class='text-sm text-gray-500'>
						{stats.value.recent} recent
					</span>
				</div>
			</div>

			{/* Divider */}
			<div class='h-4 w-px bg-gray-200' />

			{/* View Toggle */}
			<div class='flex items-center space-x-2'>
				<button
					onClick={() => onViewChange?.('grid')}
					class={`p-1.5 rounded-md ${
						view === 'grid'
							? 'bg-gray-100 text-gray-900'
							: 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
					}`}
					aria-label='Grid view'
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-5 h-5'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d='M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'
						/>
					</svg>
				</button>
				<button
					onClick={() => onViewChange?.('list')}
					class={`p-1.5 rounded-md ${
						view === 'list'
							? 'bg-gray-100 text-gray-900'
							: 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
					}`}
					aria-label='List view'
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-5 h-5'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d='M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
						/>
					</svg>
				</button>
			</div>
		</div>
	);
}
