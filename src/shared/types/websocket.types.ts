import type {
	ConversationContinue,
	ConversationDeleted,
	ConversationId,
	CollaborationLogEntry,
	ConversationNew,
	ConversationResponse,
	ConversationStart,
	ConversationStats,
	TokenUsage,
} from '../types.ts';

export interface WebSocketMessage {
	conversationId: string;
	projectId: string;
	task: 'greeting' | 'converse' | 'cancel';
	statement?: string;
}

export interface WebSocketResponseBase {
	type: string;
	data: Record<string, unknown>;
}

export interface ConversationReadyResponse extends WebSocketResponseBase {
	type: 'conversationReady';
	data: ConversationStart;
}

export interface ConversationNewResponse extends WebSocketResponseBase {
	type: 'conversationNew';
	data: ConversationNew;
}

export interface ConversationDeletedResponse extends WebSocketResponseBase {
	type: 'conversationDeleted';
	data: ConversationDeleted;
}

export interface ConversationContinueResponse extends WebSocketResponseBase {
	type: 'conversationContinue';
	data: ConversationContinue;
}

export interface ConversationAnswerResponse extends WebSocketResponseBase {
	type: 'conversationAnswer';
	data: ConversationResponse;
}

export interface ConversationErrorResponse extends WebSocketResponseBase {
	type: 'conversationError';
	data: {
		error: string;
		code?: string;
	};
}

export interface ConversationCancelledResponse extends WebSocketResponseBase {
	type: 'conversationCancelled';
	data: {
		message: string;
	};
}

export interface ProgressStatusResponse extends WebSocketResponseBase {
	type: 'progressStatus';
	data: {
		status: string;
		timestamp: number;
		statementCount: number;
		sequence: number;
		metadata?: {
			toolName?: string;
			error?: string;
		};
	};
}

export interface PromptCacheTimerResponse extends WebSocketResponseBase {
	type: 'promptCacheTimer';
	data: {
		startTimestamp: number;
		duration: number;
	};
}

export type WebSocketResponse =
	| ConversationReadyResponse
	| ConversationNewResponse
	| ConversationDeletedResponse
	| ConversationContinueResponse
	| ConversationAnswerResponse
	| ConversationErrorResponse
	| ConversationCancelledResponse
	| ProgressStatusResponse
	| PromptCacheTimerResponse;
