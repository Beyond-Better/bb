import { PageProps } from '$fresh/server.ts';
import { Signal, signal } from '@preact/signals';
import { ProjectMetadata } from '../../../islands/metadata/index.ts';
import Chat from '../../../islands/Chat.tsx';
import type { ChatState } from '../../../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';

interface ChatPageProps {
	projectId?: string;
	collaborationId?: string;
}

const initialState: ChatState = {
	collaborationId: null,
	projectData: null,
	apiClient: null,
	wsManager: null,
	collaborations: [],
	selectedCollaboration: null,
	logDataEntries: [],
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

export default function ChatPage(props: PageProps) {
	return (
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
	);
}
