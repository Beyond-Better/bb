import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type { TokenUsage } from 'shared/types.ts';

import type LLMTool from 'api/llms/llmTool.ts';
export type { LLMToolInputSchema } from 'api/llms/llmTool.ts';

import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
export type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';

export enum AnthropicModel {
	CLAUDE_3_5_HAIKU = 'claude-3-5-haiku-20241022',
	CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022', //'claude-3-5-sonnet-20240620',
	CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
	CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
	CLAUDE_3_OPUS = 'claude-3-opus-20240229',
}
export const AnthropicModels = [
	AnthropicModel.CLAUDE_3_5_HAIKU,
	AnthropicModel.CLAUDE_3_5_SONNET,
	AnthropicModel.CLAUDE_3_HAIKU,
	//AnthropicModel.CLAUDE_3_SONNET,
	AnthropicModel.CLAUDE_3_OPUS,
];

export enum OpenAIModel {
	GPT_4o = 'gpt-4o',
	GPT_4_TURBO = 'gpt-4-turbo',
	GPT_4 = 'gpt-4',
	GPT_35_TURBO = 'gpt-3.5-turbo',
}
export const OpenAIModels = [
	OpenAIModel.GPT_4o,
	OpenAIModel.GPT_4_TURBO,
	OpenAIModel.GPT_4,
	OpenAIModel.GPT_35_TURBO,
];

export enum DeepSeekModel {
	DEEPSEEK_CHAT = 'deepseek-chat',
	DEEPSEEK_REASONER = 'deepseek-reasoner',
}
export const DeepSeekModels = [
	DeepSeekModel.DEEPSEEK_CHAT,
	DeepSeekModel.DEEPSEEK_REASONER,
];

export enum GroqModel {
	GROQ_LLAMA3_8B = 'llama3-8b-8192',
	GROQ_LLAMA3_70B = 'llama3-70b-8192',
	GROQ_MIXTRAL_8X7B = 'mixtral-8x7b-32768',
	GROQ_GEMMA_7B = 'gemma-7b-it',
}
export const GroqModels = [
	GroqModel.GROQ_LLAMA3_8B,
	GroqModel.GROQ_LLAMA3_70B,
	GroqModel.GROQ_MIXTRAL_8X7B,
	GroqModel.GROQ_GEMMA_7B,
];

export const BbModels = [
	// 	AnthropicModel.CLAUDE_3_HAIKU,
	// 	AnthropicModel.CLAUDE_3_SONNET,
	// 	AnthropicModel.CLAUDE_3_5_SONNET,
	// 	AnthropicModel.CLAUDE_3_OPUS,
	// 	OpenAIModel.GPT_4o,
	// 	OpenAIModel.GPT_4_TURBO,
	// 	OpenAIModel.GPT_4,
	// 	OpenAIModel.GPT_35_TURBO,
	// 	GroqModel.GROQ_LLAMA3_8B,
	// 	GroqModel.GROQ_LLAMA3_70B,
	// 	GroqModel.GROQ_MIXTRAL_8X7B,
	// 	GroqModel.GROQ_GEMMA_7B,
];

export enum LLMProvider {
	BB = 'beyond-better',
	ANTHROPIC = 'anthropic',
	OPENAI = 'openai',
	DEEPSEEK = 'deepseek',
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
	LLMProvider.GROQ,
	LLMProvider.UNKNOWN,
];

export enum OllamaModel {
	MISTRAL_NEMO = 'mistral-nemo',
	MISTRAL = 'mistral',
	DEEPSEEK_R1_14B = 'deepseek-r1:14b',
	LLAMA3_3 = 'llama3.3',
	LLAMA3_GROQ_TOOL_USE_70B = 'llama3-groq-tool-use:70b',
	QWEN2_5_CODER_14B = 'qwen2.5-coder:14b',
	QWEN2_5_CODER_32B = 'qwen2.5-coder:32b',
	COMMAND_R = 'command-r',
	COMMAND_R_PLUS = 'command-r-plus',
	FIREFUNCTION_V2 = 'firefunction-v2',
	SMOLLM2_1_7B = 'smollm2:1.7b',
}

export const OllamaModels = [
	OllamaModel.MISTRAL_NEMO,
	OllamaModel.MISTRAL,
	OllamaModel.DEEPSEEK_R1_14B,
	OllamaModel.LLAMA3_3,
	OllamaModel.LLAMA3_GROQ_TOOL_USE_70B,
	OllamaModel.QWEN2_5_CODER_14B,
	OllamaModel.QWEN2_5_CODER_32B,
	OllamaModel.COMMAND_R,
	OllamaModel.COMMAND_R_PLUS,
	OllamaModel.FIREFUNCTION_V2,
	OllamaModel.SMOLLM2_1_7B,
];

export const LLMProviderLabel = {
	[LLMProvider.BB]: 'Beyond Better',
	[LLMProvider.ANTHROPIC]: 'Anthropic',
	[LLMProvider.OPENAI]: 'OpenAI',
	[LLMProvider.OLLAMA]: 'Ollama',
	[LLMProvider.DEEPSEEK]: 'DeepSeek',
	[LLMProvider.GROQ]: 'Groq',
	[LLMProvider.UNKNOWN]: 'Unknown',
};

export const LLMModelsByProvider = {
	[LLMProvider.BB]: BbModels,
	[LLMProvider.ANTHROPIC]: AnthropicModels,
	[LLMProvider.OPENAI]: OpenAIModels,
	[LLMProvider.OLLAMA]: OllamaModels,
	[LLMProvider.DEEPSEEK]: DeepSeekModels,
	[LLMProvider.GROQ]: GroqModels,
	[LLMProvider.UNKNOWN]: [],
};

export const LLMModelToProvider = Object.fromEntries(
	LLMProviders
		.filter((provider) => provider !== LLMProvider.UNKNOWN && provider !== LLMProvider.BB)
		.flatMap((provider) => {
			const modelsArray = LLMModelsByProvider[provider];
			return modelsArray ? modelsArray.map((model) => [model, provider]) : [];
		}),
);

/*
export const LLMProviderModels = Object.fromEntries(
	LLMProviders
		.filter((provider) => provider !== LLMProvider.UNKNOWN)
		.flatMap((provider) => {
			const providerLabel = LLMProviderLabel[provider];
            const modelsArray = (globalThis as any)[`${providerLabel}Models`];
			return modelsArray ? modelsArray.map((model:string) => [model, provider]) : [];
		}),
);
 */

export interface LLMProvderClientConfig {
	apiKey?: string;
	defaultModel?: string;
	baseURL?: string;
}

export type LLMTokenUsage = TokenUsage;
/*
export interface LLMTokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}
 */
export interface LLMRateLimit {
	requestsRemaining: number;
	requestsLimit: number;
	//requestsResetMs: number;
	requestsResetDate: Date;
	tokensRemaining: number;
	tokensLimit: number;
	//tokensResetMs: number;
	tokensResetDate: Date;
}
export interface LLMMessageStop {
	stopReason:
		// anthropic stop reasons
		| 'tool_use'
		| 'stop_sequence'
		| 'end_turn'
		| 'max_tokens'
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

export interface LLMProviderMessageRequest {
	id?: string;
	messages: LLMMessage[];
	tools: LLMTool[]; // Map<string, LLMTool>; // CNG - I think this type was wrong, from reading code, so changed it from map to array (PREPARE_TOOLS callback converts to array), but watch for breakage
	system: string; // | LLMMessageContentPartTextBlock;
	//prompt: string; // CNG - I think this is a deprecated attribute
	model: string;
	maxTokens: number;
	//max_tokens?: number; // artefact of formatting request for LLM provider - gets removed in conversation
	temperature: number;
	usePromptCaching?: boolean;
}

export type LLMProviderMessageResponseType = 'message' | 'error';
export type LLMProviderMessageResponseRole = 'assistant' | 'user';

export interface LLMProviderMessageResponse {
	id: string;
	type: LLMProviderMessageResponseType;
	role: LLMProviderMessageResponseRole;
	model: string; //LLMModel; (AnthropicModel)
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
export interface LLMProviderMessageMeta {
	system: LLMProviderSystem;
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
}

export interface Task {
	title: string;
	instructions: string;
	resources: Resource[];
	capabilities: string[];
	requirements: string | InputSchema;
}

export interface CompletedTask {
	//type: string;
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

export interface Resource {
	type: 'url' | 'file' | 'memory' | 'api' | 'database' | 'vector_search';
	location: string;
}

export type InputSchema = Record<string, unknown>;

export interface LLMSpeakWithResponse {
	messageResponse: LLMProviderMessageResponse;
	messageMeta: LLMProviderMessageMeta;
}

export enum LLMCallbackType {
	PROJECT_EDITOR = 'PROJECT_EDITOR',
	PROJECT_ID = 'PROJECT_ID',
	PROJECT_ROOT = 'PROJECT_ROOT',
	PROJECT_INFO = 'PROJECT_INFO',
	PROJECT_CONFIG = 'PROJECT_CONFIG',
	PROJECT_FILE_CONTENT = 'PROJECT_FILE_CONTENT',
	LOG_ENTRY_HANDLER = 'LOG_ENTRY_HANDLER',
	PREPARE_SYSTEM_PROMPT = 'PREPARE_SYSTEM_PROMPT',
	PREPARE_MESSAGES = 'PREPARE_MESSAGES',
	PREPARE_TOOLS = 'PREPARE_TOOLS',
}
export type LLMCallbackResult<T> = T extends (...args: unknown[]) => Promise<infer R> ? R : T;
export type LLMCallbacks = {
	// @ts-ignore any
	[K in LLMCallbackType]: (...args: any[]) => Promise<any> | any;
};

export interface BBLLMResponseMetadata {
	model: string;
	provider: string; //'anthropic',
	requestId: string;
	type: 'message' | 'error';
	role: 'assistant' | 'user';
	stopReason: LLMMessageStop['stopReason'];
	stopSequence: string | null;
}

// also in api/types/llms.ts
export interface BBLLMResponseRateLimit {
	requestsRemaining: number;
	requestsLimit: number;
	requestsResetDate: Date;
	tokensRemaining: number;
	tokensLimit: number;
	tokensResetDate: Date;
}

// also in api/types/llms.ts (as LLMProviderMessageResponseMeta)
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
