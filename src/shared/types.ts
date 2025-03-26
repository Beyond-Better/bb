import type { LLMProviderMessageMeta, LLMProviderMessageResponse, LLMRequestParams } from 'api/types/llms.ts';
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
	//tokenUsageConversation?: TokenUsage;
	//tokenUsageStats: Omit<TokenUsageStats, 'tokenUsageTurn' | 'tokenUsageStatement'>;
	tokenUsageStats: TokenUsageStats;
	requestParams?: LLMRequestParams;

	llmProviderName: string;

	model: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Detailed metadata for a conversation.
 * Note: Token usage values in metadata are derived from TokenUsagePersistence analysis
 * and should not be considered the source of truth. Always use TokenUsagePersistence.analyzeUsage()
 * for accurate token counts.
 *
 * @property tokenAnalysis - Analyzed token usage from TokenUsagePersistence
 * @property tokenUsageTurn - Turn-level token usage (for backward compatibility)
 * @property tokenUsageStatement - Statement-level token usage (for backward compatibility)
 * @property tokenUsageConversation - Conversation-level token usage derived from analysis
 */
export interface ConversationDetailedMetadata extends ConversationMetadata {
	tokenAnalysis?: {
		conversation: TokenUsageAnalysis;
		chat: TokenUsageAnalysis;
	};
	//system: string;
	temperature: number;
	maxTokens: number;

	totalProviderRequests: number;

	tokenUsageStats: TokenUsageStats;
	// 	tokenUsageTurn: TokenUsage;
	// 	tokenUsageStatement: TokenUsage;
	// 	tokenUsageConversation: TokenUsage;

	conversationMetrics: ConversationMetrics;

	parentId?: ConversationId;

	//tools?: Array<{ name: string; description: string }>;
}

export interface Conversation {
	version?: number; // defaults to 1 for existing conversations, 2 for new token usage format
	id: ConversationId;
	title: string;

	logEntries: ConversationLogEntry[];

	conversationStats: ConversationStats;
	conversationMetrics?: ConversationMetrics;
	tokenUsageStats: TokenUsageStats;
	// 	tokenUsageTurn: TokenUsage;
	// 	tokenUsageStatement: TokenUsage;
	// 	tokenUsageConversation: TokenUsage;

	//tools?: Array<{ name: string; description: string }>;
	model: string;
	createdAt: string;
	updatedAt: string;
}

export interface FileForConversation {
	fileName: string;
	metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>;
}

export type FilesForConversation = Array<FileForConversation>;

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

export interface ConversationStatementMetadata {
	system: {
		timestamp: string;
		os: string;
		bb_version?: string;
		// Add: git_branch, git_commit
	};
	task?: {
		title: string;
		type: string;
	};
	conversation: {
		goal?: string;
		current_objective?: string;
		counts: {
			statements: number;
			statement_turns: number;
			conversation_turns: number;
			max_turns_per_statement?: number;
		};
		turn?: {
			number: number;
			max: number;
		};
	};
	resources?: {
		files_active: number;
	};
	tools?: { // see formatToolObjectivesAndStats for example of toolStats
		recent: Array<
			{ name: string; success: boolean; count: number }
		>;
	};
}

export type ConversationFilesMetadata = Record<string, FileMetadata>;
// export interface ConversationFilesMetadata {
// 	files: Map<string, FileMetadata>;
// }

/*
 * Token usage for an individual turn
 * totalTokens is the legacy value for input+output
 * totalAllTokens is the value for all token used in the turn, including cache tokens
 * TotalTokenTotal is a deprecated value that was used for sum of tokens for multiple turns
 */
export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number; // inputTokens + outputTokens
	totalTokensTotal?: number; // [TODO] this is a deprecated key - we want to remove it eventually
	cacheCreationInputTokens?: number;
	cacheReadInputTokens?: number;
	totalAllTokens?: number; // totalTokens + cacheCreationInputTokens + cacheReadInputTokens
}

export interface TokenUsageDifferential {
	inputTokens: number; // Current - Previous for user messages
	outputTokens: number; // Direct from LLM for assistant messages
	totalTokens: number; // Combined differential
}

export interface CacheImpact {
	potentialCost: number; // Cost without cache
	actualCost: number; // Cost with cache
	savingsTotal: number; // Calculated savings total
	savingsPercentage: number; // Calculated savings percentage
}

export interface LLMRequestRecord {
	messageId: string; // Links to message in messages.jsonl
	requestBody: unknown;
	requestHeaders: unknown;
	responseMessage: unknown;
	response: unknown;
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
	// same structure as TokenUsage but with simplified names
	totalUsage: {
		input: number;
		output: number;
		total: number;
		cacheCreationInput: number;
		cacheReadInput: number;
		totalAll: number;
	};
	// where totalUsage.input is count of all input tokens for all turns (messages) in history
	// the differentialUsage.input is count of tokens for a single turn
	// since cached tokens are only relevant (cached) for previous turns they aren't counted in differential
	differentialUsage: {
		input: number;
		output: number;
		total: number;
	};
	// potentialCost vs actualCost if caching wasn't used
	cacheImpact: {
		potentialCost: number;
		actualCost: number;
		savingsTotal: number;
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
export interface TokenUsageStats {
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageConversation: TokenUsage;
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
	// 	tokenUsageStats: Omit<TokenUsageStats, 'tokenUsageTurn' | 'tokenUsageStatement'> & {
	// 		tokenUsageStatement?: TokenUsage;
	// 	};
	tokenUsageStats: TokenUsageStats;
	conversationStats: ConversationStats; // for resuming a conversation
	conversationHistory: ConversationEntry[];
	formattedContent?: string;
	versionInfo: VersionInfo;
	logEntry?: ConversationLogEntry;
}

export interface ConversationContinue {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	logEntry: ConversationLogEntry;
	requestParams?: LLMRequestParams;
	tokenUsageStats: TokenUsageStats;
	conversationStats: ConversationStats;
	formattedContent?: string;
}

export interface ConversationNew {
	conversationId: ConversationId;
	conversationTitle: string;
	timestamp: string;
	//tokenUsageConversation: TokenUsage;
	tokenUsageStats: TokenUsageStats;
	conversationStats: ConversationStats;
	requestParams?: LLMRequestParams;
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
	requestParams?: LLMRequestParams;
	tokenUsageStats: TokenUsageStats;
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
