import type { ApiClient } from '../utils/apiClient.utils.ts';
import { WebSocketManager } from '../utils/websocketManager.utils.ts';
import { ApiStatus, CollaborationLogDataEntry, InteractionMetadata } from 'shared/types.ts';
import type { LLMAttachedFiles, LLMRequestParams } from '../types/llm.types.ts';
import type {
	ClientProjectData,
	//ProjectStats,
} from 'shared/types/project.ts';
import type { StatementParams } from 'shared/types/collaboration.ts';
import type { WebSocketStatus } from './websocket.types.ts';
//import type { DataSource } from 'api/resources/dataSource.ts';

export type CacheStatus = 'active' | 'expiring' | 'inactive';

export function isProcessing(status: ChatStatus): boolean {
	return status.apiStatus === ApiStatus.LLM_PROCESSING ||
		status.apiStatus === ApiStatus.TOOL_HANDLING ||
		status.apiStatus === ApiStatus.API_BUSY;
}

export interface ChatStatus extends WebSocketStatus {
	cacheStatus: CacheStatus;
	lastApiCallTime: number | null; // Timestamp of last API call
	apiStatus: ApiStatus; // Current API status (idle, busy, llm_processing, tool_handling)
	toolName?: string; // Current tool being used (when status is tool_handling)
}

// export interface ProjectData {
// 	projectId: string;
// 	name: string;
// 	//type: string;
// 	primaryDataSourceRoot?: string;
// 	dataSources: DataSource[];
// 	stats?: ProjectStats;
// }

export interface ChatState {
	conversationId: string | null;
	projectData: ClientProjectData | null;
	apiClient: ApiClient | null;
	wsManager: WebSocketManager | null;
	logDataEntries: CollaborationLogDataEntry[];
	conversations: InteractionMetadata[];
	status: ChatStatus;
}

export interface ChatConfig {
	apiUrl: string;
	wsUrl: string;
	//projectId: string;

	onMessage?: (message: any) => void;
	onError?: (error: Error) => void;
	onClose?: () => void;
	onOpen?: () => void;
}

export interface ChatHandlers {
	clearError: () => void;
	sendConverse: (
		message: string,
		statementParams?: StatementParams,
		attachedFiles?: LLMAttachedFiles,
	) => Promise<void>;
	selectConversation: (id: string) => Promise<void>;
	clearConversation: () => void;
	cancelProcessing: () => Promise<void>;
	updateScrollVisibility: (isAtBottom: boolean) => void; // Update scroll indicator visibility and state
}

export interface ConversationListState {
	conversations: InteractionMetadata[];
	selectedId: string | null;
	isLoading: boolean;
}
