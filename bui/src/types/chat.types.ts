import type { ApiClient } from '../utils/apiClient.utils.ts';
import { WebSocketManager } from '../utils/websocketManager.utils.ts';
import { ApiStatus, Conversation, ConversationEntry, ConversationMetadata } from 'shared/types.ts';
import type { Project, ProjectStats } from '../hooks/useProjectState.ts';

export type CacheStatus = 'active' | 'expiring' | 'inactive';

export function isProcessing(status: ChatStatus): boolean {
    return status.apiStatus === ApiStatus.LLM_PROCESSING ||
        status.apiStatus === ApiStatus.TOOL_HANDLING ||
        status.apiStatus === ApiStatus.API_BUSY;
}

export interface ChatStatus {
    cacheStatus: CacheStatus;
    lastApiCallTime: number | null; // Timestamp of last API call
    isConnecting: boolean; // WebSocket connection in progress
    isLoading: boolean; // Conversation loading/switching
    apiStatus: ApiStatus; // Current API status (idle, busy, llm_processing, tool_handling)
    toolName?: string; // Current tool being used (when status is tool_handling)
    isReady: boolean; // System is initialized and ready
}

export interface ProjectData {
    projectId: string;
    name: string;
    type: string;
    path: string;
    stats?: ProjectStats;
}

export interface ChatState {
    conversationId: string | null;
    projectData: ProjectData | null;
    apiClient: ApiClient | null;
    wsManager: WebSocketManager | null;
    logEntries: ConversationEntry[];
    conversations: ConversationMetadata[];
    status: ChatStatus;
    error: string | null;
}

export interface ChatConfig {
    apiUrl: string;
    wsUrl: string;
    projectId: string;

    onMessage?: (message: any) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
    onOpen?: () => void;
}

export interface ChatHandlers {
    clearError: () => void;
    sendConverse: (message: string) => Promise<void>;
    selectConversation: (id: string) => Promise<void>;
    clearConversation: () => Promise<void>;
    cancelProcessing: () => Promise<void>;
    updateScrollVisibility: (isAtBottom: boolean) => void; // Update scroll indicator visibility and state
}

export interface ConversationListState {
    conversations: ConversationMetadata[];
    selectedId: string | null;
    isLoading: boolean;
}