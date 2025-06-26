import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type { TokenUsage } from 'shared/types.ts';

import type LLMTool from 'api/llms/llmTool.ts';
export type { LLMToolInputSchema } from 'api/llms/llmTool.ts';

import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
export type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

// Re-export model capabilities types
export type { InteractionPreferences, ModelCapabilities, UserModelPreferences } from 'api/types/modelCapabilities.ts';

// Model registry service will be used instead of enums
// Import the service for runtime access
//import type { ModelRegistryService } from 'api/llms/modelRegistryService.ts';

/**
 * Well-known model IDs as constants for easy reference
 * These replace the old enum values and are used as string literals
 */
export const MODELS = {
	// Anthropic models
	CLAUDE_4_0_OPUS: 'claude-opus-4-20250514',
	CLAUDE_4_0_SONNET: 'claude-sonnet-4-20250514',
	CLAUDE_3_7_SONNET: 'claude-3-7-sonnet-20250219',
	CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
	CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022',
	CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
	CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
	CLAUDE_3_OPUS: 'claude-3-opus-20240229',

	// OpenAI models
	GPT_4O: 'gpt-4o',
	GPT_4_TURBO: 'gpt-4-turbo',
	GPT_4: 'gpt-4',
	GPT_35_TURBO: 'gpt-3.5-turbo',

	// DeepSeek models
	DEEPSEEK_CHAT: 'deepseek-chat',
	DEEPSEEK_REASONER: 'deepseek-reasoner',

	// Google models
	GOOGLE_GEMINI_1_5_FLASH: 'gemini-1.5-flash',
	GOOGLE_GEMINI_2_0_FLASH: 'gemini-2.0-flash',
	GOOGLE_GEMINI_2_5_FLASH: 'gemini-2.5-flash-preview-05-20',
	GOOGLE_GEMINI_2_5_PRO: 'gemini-2.5-pro-preview-05-06',

	// Groq models
	GROQ_LLAMA3_8B: 'llama3-8b-8192',
	GROQ_LLAMA3_70B: 'llama3-70b-8192',
	GROQ_MIXTRAL_8X7B: 'mixtral-8x7b-32768',
	GROQ_GEMMA_7B: 'gemma-7b-it',

	// Common Ollama models (these may be overridden by dynamic discovery)
	OLLAMA_MISTRAL_NEMO: 'mistral-nemo',
	OLLAMA_MISTRAL: 'mistral',
	OLLAMA_DEEPSEEK_R1_14B: 'deepseek-r1:14b',
	OLLAMA_LLAMA3_3: 'llama3.3',
	OLLAMA_LLAMA3_GROQ_TOOL_USE_70B: 'llama3-groq-tool-use:70b',
	OLLAMA_QWEN2_5_CODER_14B: 'qwen2.5-coder:14b',
	OLLAMA_QWEN2_5_CODER_32B: 'qwen2.5-coder:32b',
	OLLAMA_COMMAND_R: 'command-r',
	OLLAMA_COMMAND_R_PLUS: 'command-r-plus',
	OLLAMA_FIREFUNCTION_V2: 'firefunction-v2',
	OLLAMA_SMOLLM2_1_7B: 'smollm2:1.7b',
} as const;

/**
 * Backwards compatibility: Create "enum-like" objects from MODELS
 * These provide the same interface as the old enums but use the new constant values
 */
export const AnthropicModel = {
	CLAUDE_4_0_OPUS: MODELS.CLAUDE_4_0_OPUS,
	CLAUDE_4_0_SONNET: MODELS.CLAUDE_4_0_SONNET,
	CLAUDE_3_7_SONNET: MODELS.CLAUDE_3_7_SONNET,
	CLAUDE_3_5_SONNET: MODELS.CLAUDE_3_5_SONNET,
	CLAUDE_3_5_HAIKU: MODELS.CLAUDE_3_5_HAIKU,
	CLAUDE_3_HAIKU: MODELS.CLAUDE_3_HAIKU,
	CLAUDE_3_SONNET: MODELS.CLAUDE_3_SONNET,
	CLAUDE_3_OPUS: MODELS.CLAUDE_3_OPUS,
} as const;

export const OpenAIModel = {
	GPT_4o: MODELS.GPT_4O,
	GPT_4_TURBO: MODELS.GPT_4_TURBO,
	GPT_4: MODELS.GPT_4,
	GPT_35_TURBO: MODELS.GPT_35_TURBO,
} as const;

export const DeepSeekModel = {
	DEEPSEEK_CHAT: MODELS.DEEPSEEK_CHAT,
	DEEPSEEK_REASONER: MODELS.DEEPSEEK_REASONER,
} as const;

export const GoogleModel = {
	GOOGLE_GEMINI_1_5_FLASH: MODELS.GOOGLE_GEMINI_1_5_FLASH,
	GOOGLE_GEMINI_2_0_FLASH: MODELS.GOOGLE_GEMINI_2_0_FLASH,
	GOOGLE_GEMINI_2_5_FLASH: MODELS.GOOGLE_GEMINI_2_5_FLASH,
	GOOGLE_GEMINI_2_5_PRO: MODELS.GOOGLE_GEMINI_2_5_PRO,
} as const;

export const GroqModel = {
	GROQ_LLAMA3_8B: MODELS.GROQ_LLAMA3_8B,
	GROQ_LLAMA3_70B: MODELS.GROQ_LLAMA3_70B,
	GROQ_MIXTRAL_8X7B: MODELS.GROQ_MIXTRAL_8X7B,
	GROQ_GEMMA_7B: MODELS.GROQ_GEMMA_7B,
} as const;

export const OllamaModel = {
	MISTRAL_NEMO: MODELS.OLLAMA_MISTRAL_NEMO,
	MISTRAL: MODELS.OLLAMA_MISTRAL,
	DEEPSEEK_R1_14B: MODELS.OLLAMA_DEEPSEEK_R1_14B,
	LLAMA3_3: MODELS.OLLAMA_LLAMA3_3,
	LLAMA3_GROQ_TOOL_USE_70B: MODELS.OLLAMA_LLAMA3_GROQ_TOOL_USE_70B,
	QWEN2_5_CODER_14B: MODELS.OLLAMA_QWEN2_5_CODER_14B,
	QWEN2_5_CODER_32B: MODELS.OLLAMA_QWEN2_5_CODER_32B,
	COMMAND_R: MODELS.OLLAMA_COMMAND_R,
	COMMAND_R_PLUS: MODELS.OLLAMA_COMMAND_R_PLUS,
	FIREFUNCTION_V2: MODELS.OLLAMA_FIREFUNCTION_V2,
	SMOLLM2_1_7B: MODELS.OLLAMA_SMOLLM2_1_7B,
} as const;

// Currently empty - BB models are handled differently
export const BbModels: string[] = [];

export enum LLMProvider {
	BB = 'beyondbetter',
	ANTHROPIC = 'anthropic',
	OPENAI = 'openai',
	DEEPSEEK = 'deepseek',
	GOOGLE = 'google',
	GROQ = 'groq',
	OLLAMA = 'ollama',
	UNKNOWN = '',
}

export const LLMProviders = [
	LLMProvider.BB,
	LLMProvider.ANTHROPIC,
	LLMProvider.OPENAI,
	LLMProvider.OLLAMA,
	LLMProvider.DEEPSEEK,
	LLMProvider.GOOGLE,
	LLMProvider.GROQ,
	LLMProvider.UNKNOWN,
];

export const LLMProviderLabel = {
	[LLMProvider.BB]: 'Beyond Better',
	[LLMProvider.ANTHROPIC]: 'Anthropic',
	[LLMProvider.OPENAI]: 'OpenAI',
	[LLMProvider.OLLAMA]: 'Ollama',
	[LLMProvider.DEEPSEEK]: 'DeepSeek',
	[LLMProvider.GOOGLE]: 'Google',
	[LLMProvider.GROQ]: 'Groq',
	[LLMProvider.UNKNOWN]: 'Unknown',
};

/**
 * Legacy model arrays for backwards compatibility
 * These will be populated dynamically from the model registry service
 */
export const AnthropicModels = Object.values(AnthropicModel);
export const OpenAIModels = Object.values(OpenAIModel);
export const DeepSeekModels = Object.values(DeepSeekModel);
export const GoogleModels = Object.values(GoogleModel);
export const GroqModels = Object.values(GroqModel);
export const OllamaModels = Object.values(OllamaModel);

export const LLMModelsByProvider = {
	[LLMProvider.BB]: BbModels,
	[LLMProvider.ANTHROPIC]: AnthropicModels,
	[LLMProvider.OPENAI]: OpenAIModels,
	[LLMProvider.OLLAMA]: OllamaModels,
	[LLMProvider.DEEPSEEK]: DeepSeekModels,
	[LLMProvider.GOOGLE]: GoogleModels,
	[LLMProvider.GROQ]: GroqModels,
	[LLMProvider.UNKNOWN]: [],
};

/**
 * Legacy model-to-provider mapping for backwards compatibility
 * This will be populated dynamically by the ModelRegistryService
 * For now, provide static mapping for known models
 */
const staticModelToProvider: Record<string, LLMProvider> = {};

// Populate static mappings
Object.values(AnthropicModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.ANTHROPIC;
});
Object.values(OpenAIModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.OPENAI;
});
Object.values(DeepSeekModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.DEEPSEEK;
});
Object.values(GoogleModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.GOOGLE;
});
Object.values(GroqModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.GROQ;
});
Object.values(OllamaModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.OLLAMA;
});

// Export the static mapping (will be enhanced by ModelRegistryService)
export const LLMModelToProvider: Record<string, LLMProvider> = staticModelToProvider;

/**
 * Function to get updated model-to-provider mapping from ModelRegistryService
 * This should be used instead of the static LLMModelToProvider when possible
 */
export async function getLLMModelToProvider(): Promise<Record<string, LLMProvider>> {
	try {
		// Dynamic import to avoid circular dependencies
		const { ModelRegistryService } = await import('api/llms/modelRegistryService.ts');
		const registryService = await ModelRegistryService.getInstance();
		return registryService.getModelToProviderMapping();
	} catch (_error) {
		// Fallback to static mapping if service isn't available
		return staticModelToProvider;
	}
}

export type LLMTokenUsage = TokenUsage;

export interface LLMRateLimit {
	requestsRemaining: number;
	requestsLimit: number;
	requestsResetDate: Date;
	tokensRemaining: number;
	tokensLimit: number;
	tokensResetDate: Date;
}

export interface LLMMessageStop {
	stopReason:
		// anthropic stop reasons
		| 'tool_use'
		| 'stop_sequence'
		| 'end_turn'
		| 'max_tokens'
		| 'refusal'
		// openai stop reasons
		| 'stop'
		| 'length'
		| 'tool_calls'
		| 'content_filter'
		| 'function_call'
		| null;
	stopSequence: string | null;
}

export interface LLMProviderMessageResponseMeta {
	statusCode: number;
	statusText: string;
}

/**
 * Options for extended thinking capability in Claude 3.7 Sonnet
 */
export interface LLMExtendedThinkingOptions {
	enabled: boolean;
	budgetTokens: number;
}

export interface LLMProviderMessageRequest {
	id?: string;
	messages: LLMMessage[];
	tools: LLMTool[];
	system: string;
	model: string;
	maxTokens: number;
	temperature: number;
	usePromptCaching?: boolean;
	extendedThinking?: LLMExtendedThinkingOptions;
}

export type LLMProviderMessageResponseType = 'message' | 'error';
export type LLMProviderMessageResponseRole = 'assistant' | 'user';

export interface LLMProviderMessageResponse {
	id: string;
	type: LLMProviderMessageResponseType;
	role: LLMProviderMessageResponseRole;
	model: string;
	messageStop: LLMMessageStop;
	timestamp: string;
	usage: LLMTokenUsage;
	rateLimit: LLMRateLimit;
	providerMessageResponseMeta: LLMProviderMessageResponseMeta;
	answerContent: LLMMessageContentParts;
	fromCache: boolean;
	answer: string;
	isTool: boolean;
	toolsUsed?: Array<LLMAnswerToolUse>;
	toolThinking?: string;
	extra?: object;
	createdAt?: Date;
	updatedAt?: Date;
}

export type LLMProviderSystem = string | LLMMessageContentPart;

/**
 * Configuration for a specific role's model and parameters
 */
export interface LLMModelConfig {
	model: string;
	temperature: number;
	maxTokens: number;
	extendedThinking?: LLMExtendedThinkingOptions;
	usePromptCaching?: boolean;
}

/**
 * Model configurations for all three BB roles
 */
export interface LLMRolesModelConfig {
	orchestrator: LLMModelConfig | null;
	agent: LLMModelConfig | null;
	chat: LLMModelConfig | null;
}

/**
 * Request parameters used when calling the LLM provider
 */
export interface LLMRequestParams {
	modelConfig: LLMModelConfig;

	// // Legacy fields for migration - will be removed
	// model?: string;
	// temperature?: number;
	// maxTokens?: number;
	// extendedThinking?: LLMExtendedThinkingOptions;
	// usePromptCaching?: boolean;
}

export interface LLMProviderMessageMeta {
	system: LLMProviderSystem;
	llmRequestParams: LLMRequestParams;
}

export type LLMValidateResponseCallback = (
	llmProviderMessageResponse: LLMProviderMessageResponse,
	conversation: LLMInteraction,
) => string | null;

export interface LLMSpeakWithOptions {
	messages?: LLMMessage[];
	tools?: Map<string, LLMTool>;
	system?: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	validateResponseCallback?: LLMValidateResponseCallback;
	extendedThinking?: LLMExtendedThinkingOptions;
	usePromptCaching?: boolean;
}

export interface Task {
	title: string;
	background: string;
	dataSources?: string[];
	instructions: string;
	resources?: Resource[];
	capabilities?: string[];
	requirements?: string | InputSchema;
}

export interface CompletedTask {
	title: string;
	status: 'completed' | 'failed';
	result?: string;
	error?: string;
}

export type ErrorStrategy = 'fail_fast' | 'continue_on_error' | 'retry';

export interface ErrorHandlingConfig {
	strategy: ErrorStrategy;
	maxRetries?: number;
	continueOnErrorThreshold?: number;
}

export type ResourceType =
	| 'url'
	| 'file'
	| 'directory'
	| 'memory'
	| 'api'
	| 'database'
	| 'vector_search'
	| 'mcp'
	| 'workspace'
	| 'page';

export interface Resource {
	type: ResourceType;
	uri: string;
}

export type InputSchema = Record<string, unknown>;

export interface LLMSpeakWithResponse {
	messageResponse: LLMProviderMessageResponse;
	messageMeta: LLMProviderMessageMeta;
}

export enum LLMCallbackType {
	PROJECT_EDITOR = 'PROJECT_EDITOR',
	PROJECT_ID = 'PROJECT_ID',
	PROJECT_DATA_SOURCES = 'PROJECT_DATA_SOURCES',
	PROJECT_MCP_TOOLS = 'PROJECT_MCP_TOOLS',
	PROJECT_INFO = 'PROJECT_INFO',
	PROJECT_CONFIG = 'PROJECT_CONFIG',
	PROJECT_RESOURCE_CONTENT = 'PROJECT_RESOURCE_CONTENT',
	LOG_ENTRY_HANDLER = 'LOG_ENTRY_HANDLER',
	PREPARE_SYSTEM_PROMPT = 'PREPARE_SYSTEM_PROMPT',
	PREPARE_MESSAGES = 'PREPARE_MESSAGES',
	PREPARE_TOOLS = 'PREPARE_TOOLS',
}

export type LLMCallbackResult<T> = T extends (...args: unknown[]) => Promise<infer R> ? R : T;
export type LLMCallbacks = {
	// deno-lint-ignore no-explicit-any
	[K in LLMCallbackType]: (...args: any[]) => Promise<any> | any;
};

export interface BBLLMResponseMetadata {
	model: string;
	provider: string;
	requestId: string;
	type: 'message' | 'error';
	role: 'assistant' | 'user';
	isTool: boolean;
	stopReason: LLMMessageStop['stopReason'];
	stopSequence: string | null;
	llmRequestParams?: LLMRequestParams;
	rawUsage: Record<string, number>;
}

export interface BBLLMResponseRateLimit {
	requestsRemaining: number;
	requestsLimit: number;
	requestsResetDate: Date;
	tokensRemaining: number;
	tokensLimit: number;
	tokensResetDate: Date;
}

export interface BBLLMResponseStatus {
	statusCode: number;
	statusText: string;
}

export interface BBLLMResponse {
	content: Array<LLMMessageContentPart>;
	usage: LLMTokenUsage;
	metadata: BBLLMResponseMetadata;
	rateLimit: BBLLMResponseRateLimit;
	status: BBLLMResponseStatus;
}
