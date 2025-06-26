import type { ApiClient } from '../utils/apiClient.utils.ts';
import { WebSocketManager } from '../utils/websocketManager.utils.ts';
import { ApiStatus, CollaborationLogDataEntry, CollaborationValues, ProjectId } from 'shared/types.ts';
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
// 	projectId: ProjectId;
// 	name: string;
// 	//type: string;
// 	primaryDataSourceRoot?: string;
// 	dataSources: DataSource[];
// 	stats?: ProjectStats;
// }

export interface ChatState {
	collaborationId: string | null;
	//interactionId: string | null; // the same as collaboration.lastInterationId, so use that instead
	projectData: ClientProjectData | null;
	apiClient: ApiClient | null;
	wsManager: WebSocketManager | null;
	logDataEntries: CollaborationLogDataEntry[];
	collaborations: CollaborationValues[];
	status: ChatStatus;
}

export interface ChatConfig {
	apiUrl: string;
	wsUrl: string;
	//projectId: ProjectId;

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
	selectCollaboration: (id: string) => Promise<void>;
	clearCollaboration: () => void;
	cancelProcessing: () => Promise<void>;
	updateScrollVisibility: (isAtBottom: boolean) => void; // Update scroll indicator visibility and state
}

export interface CollaborationListState {
	collaborations: CollaborationValues[];
	selectedId: string | null;
	isLoading: boolean;
}
