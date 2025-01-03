import { JSX } from 'preact';
import { Signal } from '@preact/signals';

interface Tab {
	id: string;
	label: string;
	icon: string;
	href: string;
}

interface TabsProps {
	tabs: Tab[];
	activeTab: Signal;
	children: JSX.Element | JSX.Element[];
}

interface TabPanelProps {
	id: string;
	activeTab: Signal;
	children: JSX.Element | JSX.Element[];
}

export function Tabs({ tabs, activeTab, children }: TabsProps) {
	return (
		<div class="w-full flex flex-col min-w-0">
			{/* Tab Navigation */}
			<div class='w-full border-b border-gray-200 dark:border-gray-700 overflow-x-auto'>
				<nav class='-mb-px flex space-x-8 whitespace-nowrap px-4' aria-label='Settings navigation'>
					{tabs.map((tab) => (
						<a
							key={tab.id}
							href={tab.href}
							onClick={(e) => {
								e.preventDefault();
								activeTab.value = tab.id;
								history.pushState(null, '', tab.href);
							}}
							class={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${
								activeTab.value === tab.id
									? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
									: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
							}
              `}
							aria-current={activeTab.value === tab.id ? 'page' : undefined}
						>
							<svg
								class={`-ml-0.5 mr-2 h-5 w-5 ${
									activeTab.value === tab.id
										? 'text-blue-500 dark:text-blue-400'
										: 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
								}`}
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								stroke-width='1.5'
								stroke='currentColor'
								aria-hidden='true'
							>
								<path
									stroke-linecap='round'
									stroke-linejoin='round'
									d={tab.icon}
								/>
							</svg>
							{tab.label}
						</a>
					))}
				</nav>
			</div>

			{/* Tab Panels Container */}
			<div class='mt-6 w-full min-w-0 overflow-x-auto'>
				<div class="w-full min-w-[640px] px-4">
					{children}
				</div>
			</div>
		</div>
	);
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
	if (activeTab.value !== id) return null;
	
	return (
		<div
			role='tabpanel'
			id={`${id}-panel`}
			aria-labelledby={`${id}-tab`}
			class='rounded-lg bg-white dark:bg-gray-800 shadow-sm'
		>
			{children}
		</div>
	);
}