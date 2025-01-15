import { JSX } from 'preact';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { signal } from '@preact/signals';

import { PageContainer } from '../components/PageContainer.tsx';
import { TabPanel, Tabs } from '../components/Tabs.tsx';
import SubscriptionSettings from './Settings/SubscriptionSettings.tsx';
import ProjectSettings from './Settings/ProjectSettings.tsx';

interface SettingsTab {
	id: string;
	label: string;
	description: string;
	icon: string;
	component: () => JSX.Element;
}

const SETTINGS_TABS: SettingsTab[] = [
	{
		id: 'subscription',
		label: 'Plans and Billing',
		description: 'Manage your subscription plan and billing',
		icon:
			'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
		component: () => <SubscriptionSettings />,
	},
	{
		id: 'projects',
		label: 'Projects',
		description: 'Configure project defaults',
		icon:
			'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
		component: () => <ProjectSettings />,
	},
	{
		id: 'appearance',
		label: 'Appearance',
		description: 'Customize the look and feel',
		icon:
			'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z',
		component: () => (
			<div class='p-6'>
				<div class='flex items-center space-x-3 mb-6'>
					<div>
						<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Appearance Settings</h3>
						<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
							Customize the look and feel of BB
						</p>
					</div>
				</div>
				<span class='mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'>
					Coming Soon
				</span>
			</div>
		),
	},
// 	{
// 		id: 'notifications',
// 		label: 'Notifications',
// 		description: 'Configure notification preferences',
// 		icon:
// 			'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
// 		component: () => (
// 			<div class='p-6'>
// 				<div class='flex items-center space-x-3 mb-6'>
// 					<div>
// 						<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Notification Settings</h3>
// 						<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
// 							Configure notification preferences
// 						</p>
// 					</div>
// 				</div>
// 				<span class='mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'>
// 					Coming Soon
// 				</span>
// 			</div>
// 		),
// 	},
// 	{
// 		id: 'shortcuts',
// 		label: 'Shortcuts',
// 		description: 'Customize keyboard shortcuts',
// 		icon:
// 			'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
// 		component: () => (
// 			<div class='p-6'>
// 				<div class='flex items-center space-x-3 mb-6'>
// 					<div>
// 						<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Keyboard Shortcuts</h3>
// 						<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
// 							Customize keyboard shortcuts
// 						</p>
// 					</div>
// 				</div>
// 				<span class='mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'>
// 					Coming Soon
// 				</span>
// 			</div>
// 		),
// 	},
];

export const activeTab = signal('subscription');
export default function Settings(): JSX.Element {
	// Set active tab from URL on initial load and navigation
	if (IS_BROWSER) {
		const currentTab = new URL(globalThis.location.href).searchParams.get('tab');
		console.log('Settings: currentTab', currentTab);
		console.log('Settings: activeTab', activeTab.value);
		if (currentTab && SETTINGS_TABS.some((tab) => tab.id === currentTab) && activeTab.value !== currentTab) {
			activeTab.value = currentTab;
		}
	}

	return (
		<div class='container mx-auto pb-10 h-screen overflow-y-auto'>
			<div class='flex flex-col flex-1'>
				<PageContainer>
					<div class='flex flex-col w-full'>
						<div class='border-b border-gray-200 dark:border-gray-700 pb-5'>
							<h1 class='text-2xl font-bold text-gray-900 dark:text-gray-100'>Settings</h1>
							<p class='mt-2 text-sm text-gray-500 dark:text-gray-400'>
								Manage your account settings and preferences
							</p>
						</div>
						<div class='mt-6 min-w-0 w-full'>
							<Tabs
								tabs={SETTINGS_TABS.map((tab) => ({
									id: tab.id,
									label: tab.label,
									icon: tab.icon,
									href: `/app/settings?tab=${tab.id}`,
								}))}
								activeTab={activeTab}
							>
								{SETTINGS_TABS.map((tab) => (
									<TabPanel key={tab.id} id={tab.id} activeTab={activeTab}>
										{tab.component()}
									</TabPanel>
								))}
							</Tabs>
						</div>
					</div>
				</PageContainer>
			</div>
		</div>
	);
}
