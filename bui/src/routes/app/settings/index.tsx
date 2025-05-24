import { PageProps } from '$fresh/server.ts';
import { signal } from '@preact/signals';
import { AppSettingsMetadata } from '../../../islands/metadata/index.ts';
import AppSettings from '../../../islands/AppSettings.tsx';

interface AppSettingsPageProps {
	category?: string;
}

// Create signals for settings state
const categoryState = signal<string>('General');
const descriptionState = signal<string>('Manage your preferences and customize BB');

export default function AppSettingsPage(_props: PageProps<AppSettingsPageProps>) {
	return (
		<div class='flex flex-col flex-1'>
			{/* Metadata Bar */}
			<div class='border-b border-gray-200 dark:border-gray-700 px-4 py-2'>
				<AppSettingsMetadata
					category={categoryState.value}
					description={descriptionState.value}
				/>
			</div>

			{/* Main content */}
			<div class='flex-1 flex flex-col overflow-hidden'>
				<AppSettings />
			</div>
		</div>
	);
}
