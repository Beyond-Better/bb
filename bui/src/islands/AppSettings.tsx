import { JSX } from 'preact';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { signal } from '@preact/signals';

import { PageContainer } from '../components/PageContainer.tsx';
import { TabPanel, Tabs } from '../components/Tabs.tsx';
import { NotificationSettings } from './AppSettings/NotificationSettings.tsx';
import PlansAndCreditsTab from './AppSettings/PlansAndCreditsTab.tsx';
import UsageAndHistoryTab from './AppSettings/UsageAndHistoryTab.tsx';
import DefaultProjectSettings from './AppSettings/DefaultProjectSettings.tsx';
import MCPServersSection from './AppSettings/MCPServersSection.tsx';
import { AppearanceSettings } from './AppSettings/AppearanceSettings.tsx';

interface AppSettingsTab {
	id: string;
	label: string;
	description: string;
	icon: string;
	component: () => JSX.Element;
}

const SETTINGS_TABS: AppSettingsTab[] = [
	{
		id: 'plans-credits',
		label: 'Plans & Credits',
		description: 'Manage your subscription plan, credits, and payment methods',
		icon:
			'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
		component: () => <PlansAndCreditsTab />,
	},
	{
		id: 'usage-history',
		label: 'Usage & History',
		description: 'View usage analytics and purchase history',
		icon:
			'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
		component: () => <UsageAndHistoryTab />,
	},
	{
		id: 'projects',
		label: 'Project Defaults',
		description: 'Configure project defaults',
		icon:
			'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
		component: () => <DefaultProjectSettings />,
	},
	{
		id: 'mcpservers',
		label: 'MCP Servers',
		description: 'Configure Model Context Protocol servers',
		icon:
			'M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 010-9h15a4.5 4.5 0 010 9m0 0h-15',
		component: () => <MCPServersSection />,
	},
	{
		id: 'appearance',
		label: 'Appearance',
		description: 'Customize the look and feel',
		icon:
			'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z',
		component: () => (
			<div class='p-6'>
				<AppearanceSettings />
			</div>
		),
	},
	{
		id: 'notifications',
		label: 'Notifications',
		description: 'Configure notification preferences',
		icon:
			'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
		component: () => (
			<div class='p-6'>
				<NotificationSettings />
			</div>
		),
	},
];

export const activeTab = signal('plans-credits'); // Default to new primary tab
export default function AppSettings(): JSX.Element {
	// Set active tab from URL on initial load and navigation
	if (IS_BROWSER) {
		const currentTab = new URL(globalThis.location.href).searchParams.get('tab');
		console.log('AppSettings: currentTab', currentTab);
		console.log('AppSettings: activeTab', activeTab.value);
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