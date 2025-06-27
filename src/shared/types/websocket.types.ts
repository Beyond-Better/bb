import type {
	CollaborationContinue,
	CollaborationDeleted,
	CollaborationLogEntry,
	CollaborationNew,
	CollaborationResponse,
	CollaborationStart,
	InteractionId,
	InteractionStats,
	ProjectId,
	TokenUsage,
} from '../types.ts';

export interface WebSocketMessage {
	collaborationId: string;
	projectId: ProjectId;
	task: 'greeting' | 'converse' | 'cancel';
	statement?: string;
}

export interface WebSocketResponseBase {
	type: string;
	data: Record<string, unknown>;
}

export interface CollaborationReadyResponse extends WebSocketResponseBase {
	type: 'collaborationReady';
	data: CollaborationStart;
}

export interface CollaborationNewResponse extends WebSocketResponseBase {
	type: 'collaborationNew';
	data: CollaborationNew;
}

export interface CollaborationDeletedResponse extends WebSocketResponseBase {
	type: 'collaborationDeleted';
	data: CollaborationDeleted;
}

export interface CollaborationContinueResponse extends WebSocketResponseBase {
	type: 'collaborationContinue';
	data: CollaborationContinue;
}

export interface CollaborationAnswerResponse extends WebSocketResponseBase {
	type: 'collaborationAnswer';
	data: CollaborationResponse;
}

export interface CollaborationErrorResponse extends WebSocketResponseBase {
	type: 'collaborationError';
	data: {
		error: string;
		code?: string;
	};
}

export interface CollaborationCancelledResponse extends WebSocketResponseBase {
	type: 'collaborationCancelled';
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
	| CollaborationReadyResponse
	| CollaborationNewResponse
	| CollaborationDeletedResponse
	| CollaborationContinueResponse
	| CollaborationAnswerResponse
	| CollaborationErrorResponse
	| CollaborationCancelledResponse
	| ProgressStatusResponse
	| PromptCacheTimerResponse;
