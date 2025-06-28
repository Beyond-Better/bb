import type {
	LLMModelConfig,
	LLMProviderMessageMeta,
	LLMProviderMessageResponse,
	LLMRequestParams,
	LLMRolesModelConfig,
} from 'api/types/llms.ts';
import type { LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';
import type { VersionInfo } from './types/version.types.ts';
import type { CollaborationLogEntry } from 'api/storage/collaborationLogger.ts';
import type { CollaborationInterface, CollaborationParams, CollaborationValues } from './types/collaboration.types.ts';

export type {
	CollaborationLogEntry,
	CollaborationLogEntryContent,
	CollaborationLogEntryContentToolResult,
	CollaborationLogEntryType,
} from 'api/storage/collaborationLogger.ts';
export type { CollaborationInterface, CollaborationParams, CollaborationValues };
export type { LLMModelConfig, LLMRolesModelConfig };

export type ProjectId = string;
export type InteractionId = string;
export type CollaborationId = string;

export type CollaborationType = 'project' | 'workflow' | 'research';
export type InteractionType = 'base' | 'chat' | 'conversation';

export type VectorId = string;

export interface CollaborationMetadata {
	id: CollaborationId;
	version: number; // Version 4 for collaboration format
	projectId: ProjectId;
	title: string | null;
	type: CollaborationType;
	collaborationParams: CollaborationParams;
	totalInteractions: number;
	interactionIds: InteractionId[];
	tokenUsageCollaboration: TokenUsage;
	//tokenUsageStatsForCollaboration: TokenUsageStatsForCollaboration; // [TODO] should this be part of lastInteractionMetadata
	lastInteractionId?: InteractionId;
	lastInteractionMetadata?: InteractionMetadata;
	//lastInteractionMetadata?: Pick<InteractionMetadata, 'llmProviderName' | 'model' | 'updatedAt'>;
	// User preferences
	starred?: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CollaborationDetailedMetadata extends CollaborationMetadata {
	// Additional detailed fields for internal use
}

export interface InteractionMetadata {
	//projectId: ProjectId;
	version?: number;
	id: InteractionId;
	parentInteractionId?: InteractionId;
	interactionType: InteractionType;
	title: string | null;

	interactionStats: InteractionStats;
	interactionMetrics?: InteractionMetrics;
	//tokenUsageStatsForInteraction: Omit<TokenUsageStatsForInteraction, 'tokenUsageTurn' | 'tokenUsageStatement'>;
	tokenUsageStatsForInteraction: TokenUsageStatsForInteraction;

	// for interaction storage
	//collaborationParams?: CollaborationParams;
	// for collaboration storage
	modelConfig?: LLMModelConfig;

	llmProviderName: string;

	model: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Detailed metadata for a interaction.
 * Note: Token usage values in metadata are derived from TokenUsagePersistence analysis
 * and should not be considered the source of truth. Always use TokenUsagePersistence.analyzeUsage()
 * for accurate token counts.
 *
 * @property tokenAnalysis - Analyzed token usage from TokenUsagePersistence
 * @property tokenUsageTurn - Turn-level token usage (for backward compatibility)
 * @property tokenUsageStatement - Statement-level token usage (for backward compatibility)
 * @property tokenUsageInteraction - Conversation-level token usage derived from analysis
 */
export interface InteractionDetailedMetadata extends InteractionMetadata {
	tokenAnalysis?: {
		conversation: TokenUsageAnalysis;
		chat: TokenUsageAnalysis;
	};
	//system: string;
	temperature: number;
	maxTokens: number;

	totalProviderRequests: number;

	tokenUsageStatsForInteraction: TokenUsageStatsForInteraction;
	// 	tokenUsageTurn: TokenUsage;
	// 	tokenUsageStatement: TokenUsage;
	// 	tokenUsageInteraction: TokenUsage;

	interactionMetrics: InteractionMetrics;

	//tools?: Array<{ name: string; description: string }>;
}

//export interface Conversation {
//	version?: number; // defaults to 1 for existing conversations, 2 for new token usage format
//	id: InteractionId;
//	title: string;
//
//	logDataEntries: CollaborationLogDataEntry[];
//
//	interactionStats: InteractionStats;
//	interactionMetrics?: InteractionMetrics;
//	tokenUsageStatsForInteraction: TokenUsageStatsForInteraction;
//	// 	tokenUsageTurn: TokenUsage;
//	// 	tokenUsageStatement: TokenUsage;
//	// 	tokenUsageInteraction: TokenUsage;
//
//	//tools?: Array<{ name: string; description: string }>;
//	model: string;
//	createdAt: string;
//	updatedAt: string;
//}

export interface FileMetadata {
	type: 'text' | 'image';
	mimeType?: LLMMessageContentPartImageBlockSourceMediaType;
	path: string;
	size: number;
	lastModified: Date;
	messageId?: string; // also used as revisionId
	toolUseId?: string;
	lastCommit?: string;
	error?: string | null;
}

export interface InteractionStatementMetadata {
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
	interaction: {
		goal?: string;
		current_objective?: string;
		counts: {
			statements: number;
			statement_turns: number;
			interaction_turns: number;
			max_turns_per_statement?: number;
		};
		turn?: {
			number: number;
			max: number;
		};
	};
	resources?: {
		resources_active: number;
	};
	tools?: { // see formatToolObjectivesAndStats for example of toolStats
		recent: Array<
			{ name: string; success: boolean; count: number }
		>;
	};
}

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
	//totalTokensTotal?: number; // [TODO] this is a deprecated key - we want to remove it eventually
	cacheCreationInputTokens?: number;
	cacheReadInputTokens?: number;
	thoughtTokens?: number;
	totalAllTokens?: number; // totalTokens + cacheCreationInputTokens + cacheReadInputTokens + thoughtTokens
}

export const _DEFAULT_TOKEN_USAGE_REQUIRED = Object.freeze(
	{
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	} as const,
);
export const _DEFAULT_TOKEN_USAGE_EMPTY = Object.freeze(
	{
		..._DEFAULT_TOKEN_USAGE_REQUIRED,
		cacheCreationInputTokens: undefined,
		cacheReadInputTokens: undefined,
		thoughtTokens: undefined,
		totalAllTokens: undefined,
	} as const,
);
export const _DEFAULT_TOKEN_USAGE = Object.freeze(
	{
		..._DEFAULT_TOKEN_USAGE_REQUIRED,
		cacheCreationInputTokens: 0,
		cacheReadInputTokens: 0,
		thoughtTokens: 0,
		totalAllTokens: 0,
	} as const,
);

export const DEFAULT_TOKEN_USAGE_REQUIRED = (): TokenUsage => ({ ..._DEFAULT_TOKEN_USAGE_REQUIRED });
export const DEFAULT_TOKEN_USAGE_EMPTY = (): TokenUsage => ({ ..._DEFAULT_TOKEN_USAGE_EMPTY });
export const DEFAULT_TOKEN_USAGE = (): TokenUsage => ({ ..._DEFAULT_TOKEN_USAGE });

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
	interactionId: string; // Links to interactions in interactions.jsonl (for collaboration level token usage)
	messageId: string; // Links to message in messages.jsonl in the relevant interaction
	statementCount: number; // Links to log entry
	statementTurnCount: number; // Links to log entry
	timestamp: string; // ISO timestamp
	role: 'user' | 'assistant' | 'tool' | 'system'; // Message role
	type: InteractionType; // Interaction type
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
		thoughtTokens: number;
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
// 	outputTokens: number;	collaboration?: string; // Overall collaboration goal
// 	totalTokens: number;	statement: string[]; // Array of statement goals, one per statement
// 	//usageHistory?: Array<TokenUsage>	timestamp: string; // When the objective was set
// }}

export interface ObjectivesData {
	collaboration?: string; // Overall collaboration goal
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

export interface InteractionStats {
	statementCount: number;
	statementTurnCount: number;
	interactionTurnCount: number;
	providerRequestCount?: number;
}
export interface TokenUsageStatsForInteraction {
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageInteraction: TokenUsage;
	tokenUsageCollaboration?: TokenUsage;
}
export interface TokenUsageStatsForCollaboration {
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageInteraction: TokenUsage;
	tokenUsageCollaboration: TokenUsage;
}

export interface InteractionMetrics extends InteractionStats {
	// New task-oriented metrics
	objectives?: ObjectivesData;
	resources?: ResourceMetrics;
	toolUsage?: {
		currentToolSet?: string;
		toolStats: Map<string, ToolStats>;
	};
}

export type CollaborationLogDataEntry = CollaborationStart | CollaborationContinue | CollaborationResponse;

export interface CollaborationStart {
	collaborationId: CollaborationId;
	interactionId?: InteractionId;
	projectId: ProjectId;
	collaborationTitle: string;
	//version: number;
	collaborationType: CollaborationType;
	collaborationParams: CollaborationParams;
	createdAt: string;
	updatedAt: string;
	// totalInteractions: number;
	// interactionIds: InteractionId[];
	// lastInteractionId?: InteractionId;
	// lastInteractionMetadata?: InteractionMetadata;

	messageId?: string;
	parentMessageId?: string | null;
	agentInteractionId?: string | null;
	timestamp: string;
	modelConfig?: LLMModelConfig;
	tokenUsageStatsForCollaboration: TokenUsageStatsForCollaboration;
	interactionStats: InteractionStats; // for resuming a collaboration
	collaborationHistory: CollaborationLogDataEntry[];
	formattedContent?: string;
	versionInfo: VersionInfo;
	logEntry?: CollaborationLogEntry;
	children?: {
		[agentInteractionId: string]: CollaborationLogDataEntry[];
	};
}

export interface CollaborationContinue {
	collaborationId: CollaborationId;
	interactionId?: InteractionId;
	projectId: ProjectId;
	collaborationTitle: string;
	collaborationType: CollaborationType;
	messageId?: string;
	parentMessageId: string | null;
	agentInteractionId: string | null;
	collaborationParams: CollaborationParams;
	createdAt: string;
	updatedAt: string;
	timestamp: string;
	logEntry: CollaborationLogEntry;
	children?: {
		[agentInteractionId: string]: CollaborationLogDataEntry[];
	};
	// totalInteractions: number;
	// interactionIds: InteractionId[];
	// lastInteractionId?: InteractionId;
	// lastInteractionMetadata?: InteractionMetadata;
	modelConfig?: LLMModelConfig;
	tokenUsageStatsForCollaboration: TokenUsageStatsForCollaboration;
	interactionStats: InteractionStats;
	formattedContent?: string;
}

export interface CollaborationNew {
	collaborationId: CollaborationId;
	interactionId?: InteractionId;
	projectId: ProjectId;
	collaborationTitle: string;
	version: number;
	collaborationType: CollaborationType;
	collaborationParams: CollaborationParams;
	createdAt: string;
	updatedAt: string;
	// totalInteractions: number;
	// interactionIds: InteractionId[];
	// lastInteractionId?: InteractionId;
	// lastInteractionMetadata?: InteractionMetadata;

	messageId?: string;
	parentMessageId?: string | null;
	agentInteractionId?: string | null;
	timestamp: string;
	tokenUsageStatsForCollaboration: TokenUsageStatsForCollaboration;
	interactionStats: InteractionStats;
	modelConfig?: LLMModelConfig;
}

export interface CollaborationDeleted {
	collaborationId: CollaborationId;
	interactionId?: InteractionId;
	timestamp: string;
}

export interface CollaborationResponse {
	collaborationId: CollaborationId;
	interactionId: InteractionId;
	projectId: ProjectId;
	collaborationTitle: string;
	collaborationType: CollaborationType;
	messageId?: string;
	parentMessageId: string | null;
	agentInteractionId: string | null;
	collaborationParams: CollaborationParams;
	createdAt: string;
	updatedAt: string;
	timestamp: string;
	logEntry: CollaborationLogEntry;
	children?: {
		[agentInteractionId: string]: CollaborationLogDataEntry[];
	};
	// totalInteractions: number;
	// interactionIds: InteractionId[];
	// lastInteractionId?: InteractionId;
	// lastInteractionMetadata?: InteractionMetadata;
	modelConfig?: LLMModelConfig;
	tokenUsageStatsForCollaboration: TokenUsageStatsForCollaboration;
	interactionStats: InteractionStats;
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
