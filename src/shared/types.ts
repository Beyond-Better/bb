import type { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntry } from 'api/storage/conversationLogger.ts';
import type { VersionInfo } from './types/version.types.ts';

export type {
	ConversationLogEntry,
	ConversationLogEntryContent,
	ConversationLogEntryContentToolResult,
	ConversationLogEntryType,
} from 'api/storage/conversationLogger.ts';

export type ConversationId = string;

export type VectorId = string;

export interface ConversationMetadata {
	//projectId: string;
	version?: number; // defaults to 1 for existing conversations, 2 for new token usage format
	id: ConversationId;
	title: string;

	conversationStats: ConversationStats;
	conversationMetrics?: ConversationMetrics;
	tokenUsageConversation?: TokenUsage;

	llmProviderName: string;

	model: string;
	createdAt: string;
	updatedAt: string;
}

export interface ConversationDetailedMetadata extends ConversationMetadata {
	tokenAnalysis?: {
		conversation: TokenUsageAnalysis;
		chat: TokenUsageAnalysis;
	};
	//system: string;
	temperature: number;
	maxTokens: number;

	totalProviderRequests: number;

	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: TokenUsage;

	conversationMetrics: ConversationMetrics;

	//tools?: Array<{ name: string; description: string }>;
}

export interface Conversation {
	version?: number; // defaults to 1 for existing conversations, 2 for new token usage format
	id: ConversationId;
	title: string;

	logEntries: ConversationLogEntry[];

	conversationStats: ConversationStats;
	conversationMetrics?: ConversationMetrics;
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: TokenUsage;

	//tools?: Array<{ name: string; description: string }>;
	model: string;
	createdAt: string;
	updatedAt: string;
}

export interface FileMetadata {
	type: 'text' | 'image';
	mimeType?: LLMMessageContentPartImageBlockSourceMediaType;
	path: string;
	size: number;
	lastModified: Date;
	inSystemPrompt: boolean;
	messageId?: string; // also used as revisionId
	toolUseId?: string;
	lastCommit?: string;
	error?: string | null;
}

export type ConversationFilesMetadata = Record<string, FileMetadata>;
// export interface ConversationFilesMetadata {
// 	files: Map<string, FileMetadata>;
// }

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	totalTokensTotal?: number; // [TODO] this is a deprecated key - we want to remove it eventually
	cacheCreationInputTokens?: number;
	cacheReadInputTokens?: number;
}

export interface TokenUsageDifferential {
	inputTokens: number; // Current - Previous for user messages
	outputTokens: number; // Direct from LLM for assistant messages
	totalTokens: number; // Combined differential
}

export interface CacheImpact {
	potentialCost: number; // Cost without cache
	actualCost: number; // Cost with cache
	savings: number; // Calculated savings
}

export interface TokenUsageRecord {
	messageId: string; // Links to message in messages.jsonl
	statementCount: number; // Links to log entry
	statementTurnCount: number; // Links to log entry
	timestamp: string; // ISO timestamp
	role: 'user' | 'assistant' | 'tool' | 'system'; // Message role
	type: 'conversation' | 'chat' | 'base'; // Interaction type
	model: string;

	// Raw usage from LLM
	rawUsage: TokenUsage;

	// Calculated Differential Costs
	differentialUsage: TokenUsageDifferential;

	// Cache Impact Analysis
	cacheImpact: CacheImpact;
}

export interface TokenUsageAnalysis {
	totalUsage: {
		input: number;
		output: number;
		total: number;
	};
	differentialUsage: {
		input: number;
		output: number;
		total: number;
	};
	cacheImpact: {
		potentialCost: number;
		actualCost: number;
		totalSavings: number;
		savingsPercentage: number;
	};
	byRole: {
		user: number;
		assistant: number;
		system: number;
		tool: number;
	};
}

// export interface ConversationTokenUsage {
// 	inputTokens: number;export interface ObjectivesData {
// 	outputTokens: number;	conversation?: string; // Overall conversation goal
// 	totalTokens: number;	statement: string[]; // Array of statement goals, one per statement
// 	//usageHistory?: Array<TokenUsage>	timestamp: string; // When the objective was set
// }}

export interface ObjectivesData {
	conversation?: string; // Overall conversation goal
	statement: string[]; // Array of statement goals, one per statement
	timestamp: string; // When the objective was set
}

export interface ResourceMetrics {
	accessed: Set<string>; // All resources accessed
	modified: Set<string>; // Resources modified
	active: Set<string>; // Currently relevant resources
}

export interface ToolStats {
	count: number;
	success: number;
	failure: number;
	lastUse: {
		success: boolean;
		timestamp: string;
	};
}

export interface ConversationStats {
	statementCount: number;
	statementTurnCount: number;
	conversationTurnCount: number;
	providerRequestCount?: number;
}

export interface ConversationMetrics extends ConversationStats {
	// New task-oriented metrics
	objectives?: ObjectivesData;
	resources?: ResourceMetrics;
	toolUsage?: {
		currentToolSet?: string;
		toolStats: Map<string, ToolStats>;
	};
}

export type ConversationEntry = ConversationStart | ConversationContinue | ConversationResponse;

export interface ConversationStart {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	tokenUsageStatement?: TokenUsage;
	tokenUsageConversation: TokenUsage;
	conversationStats: ConversationStats; // for resuming a conversation
	conversationHistory: ConversationEntry[];
	formattedContent?: string;
	versionInfo: VersionInfo;
}

export interface ConversationContinue {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	logEntry: ConversationLogEntry;
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: TokenUsage;
	conversationStats: ConversationStats;
	formattedContent?: string;
}

export interface ConversationNew {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	tokenUsageConversation: TokenUsage;
	conversationStats: ConversationStats;
}

export interface ConversationDeleted {
	conversationId: ConversationId;
	timestamp: string;
}

export interface ConversationResponse {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	logEntry: ConversationLogEntry;
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: TokenUsage;
	conversationStats: ConversationStats;
	formattedContent?: string;
}

export interface VectorEmbedding {
	id: VectorId;
	vector: number[];
	metadata: Record<string, unknown>;
}

export enum ApiStatus {
	IDLE = 'idle',
	API_BUSY = 'api_busy',
	LLM_PROCESSING = 'llm_processing',
	TOOL_HANDLING = 'tool_handling',
	ERROR = 'error',
}

export interface PromptCacheTimerMessage {
	type: 'prompt_cache_timer';
	startTimestamp: number;
	duration: number;
}

export interface ProgressStatusMessage {
	type: 'progress_status';
	status: ApiStatus;
	timestamp: number;
	statementCount: number;
	sequence: number;
	metadata?: {
		toolName?: string;
		error?: string;
	};
}
