import { signal } from '@preact/signals';
import { RouteConfig } from '$fresh/server.ts';
import { Partial } from '$fresh/runtime.ts';
import { SettingsMetadata } from '../../islands/metadata/index.ts';
import Settings from '../../islands/Settings.tsx';

// Skip the app wrapper since we're rendering inside a Partial
export const config: RouteConfig = {
	skipAppWrapper: true,
	skipInheritedLayouts: true,
};

// Create signals for settings state
const categoryState = signal<string>('General');
const descriptionState = signal<string>('Manage your preferences and customize BB');

export default function SettingsPartial() {
	return (
		<Partial name='page-content'>
			<div class='flex flex-col flex-1'>
				{/* Metadata Bar */}
				<div class='border-b border-gray-200 dark:border-gray-700 px-4 py-2'>
					<SettingsMetadata
						category={categoryState.value}
						description={descriptionState.value}
					/>
				</div>

				{/* Main content */}
				<div class='flex-1 flex flex-col overflow-hidden'>
					<Settings />
				</div>
			</div>
		</Partial>
	);
}
