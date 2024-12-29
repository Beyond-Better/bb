import { Signal, signal } from '@preact/signals';
import { RouteConfig } from '$fresh/server.ts';
import { Partial } from '$fresh/runtime.ts';
import { ProjectMetadata } from '../../../islands/metadata/index.ts';
import Chat from '../../../islands/Chat.tsx';
import type { ChatState } from '../../../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';

// Skip the app wrapper since we're rendering inside a Partial
export const config: RouteConfig = {
	skipAppWrapper: true,
	skipInheritedLayouts: true,
};

const initialState: ChatState = {
	conversationId: null,
	projectData: null,
	apiClient: null,
	wsManager: null,
	conversations: [],
	logEntries: [],
	status: {
		isConnecting: false,
		isLoading: false,
		isReady: false,
		cacheStatus: 'inactive',
		lastApiCallTime: null,
		apiStatus: ApiStatus.IDLE,
		toolName: undefined,
		error: null,
	},
};

const chatState = signal<ChatState>(initialState);

export default function ChatPartial() {
	return (
		<Partial name='page-content'>
			<div class='h-screen flex flex-col flex-1 overflow-hidden'>
				{/* Metadata Bar */}
				<div class='border-b border-gray-200 dark:border-gray-700 px-4 py-2'>
					<ProjectMetadata chatState={chatState} />
				</div>

				{/* Chat takes full height of the main content area */}
				<div class='flex-1 flex flex-col overflow-hidden'>
					<Chat chatState={chatState} />
				</div>
			</div>
		</Partial>
	);
}
