import OpenAI from 'openai';
import ms from 'ms';
import type { PerformanceMonitor } from '../_shared/performanceMonitor.ts';
import {
	type BBLLMContentBlockParam,
	type BBLLMRequest,
	type BBLLMRequestMessage,
	type BBLLMResponse,
	type BBLLMTokenUsage,
	type BBLLMToolUseBlock,
	LLMError,
	type LLMHandlerConfig,
	ProxyError,
	ProxyErrorType,
} from '../_shared/types.ts';
import type { LLMProviderHandler } from './providerInterface.ts';

export interface OpenAICompatConfig extends LLMHandlerConfig {
	model: string;
	baseURL?: string;
}

// Base handler for OpenAI-compatible APIs
export class OpenAICompatHandler<TUsage = OpenAI.CompletionUsage> implements LLMProviderHandler {
	protected config: OpenAICompatConfig;
	protected client: OpenAI;
	protected monitor: PerformanceMonitor;

	constructor(config: OpenAICompatConfig, monitor: PerformanceMonitor) {
		this.config = config;
		this.client = new OpenAI({
			apiKey: this.config.apiKey,
			baseURL: this.config.baseURL,
		});
		this.monitor = monitor;
	}

	async handleRequest(bbRequest: BBLLMRequest): Promise<BBLLMResponse> {
		console.debug(`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] Starting request handling`);
		try {
			console.debug(
				`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] Transforming BB request to OpenAI format`,
			);
			const openaiRequest: OpenAI.Chat.ChatCompletionCreateParams = {
				model: bbRequest.model,
				max_tokens: bbRequest.options.maxTokens,
				temperature: bbRequest.options.temperature,
				stream: false,
				messages: this.transformMessages(bbRequest),
				...(bbRequest.tools && bbRequest.tools.length > 0 && {
					tools: this.transformTools(bbRequest.tools),
				}),
			};
			// console.debug(
			// 	`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] openaiRequest`,
			// 	JSON.stringify(openaiRequest, null, 2),
			// );

			console.debug(`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] Sending request to provider`);
			this.monitor.startTimer('provider_request');
			const { data: openaiMessage, response: openaiResponse } = await this.client.chat.completions.create(
				openaiRequest,
			).withResponse();
			this.monitor.stopTimer('provider_request');
			console.debug(
				`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] openaiMessage`,
				JSON.stringify(openaiMessage, null, 2),
			);
			console.debug(
				`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] openaiResponse`,
				JSON.stringify(openaiResponse, null, 2),
			);

			//const openaiMessage = openaiMessage as OpenAI.Chat.ChatCompletion;
			const headers = openaiResponse.headers;

			// Extract rate limit information
			const requestsRemaining = Number(headers.get('x-ratelimit-remaining-requests'));
			const requestsLimit = Number(headers.get('x-ratelimit-limit-requests'));
			const requestsResetMs = ms(headers.get('x-ratelimit-reset-requests') || '0') as number;
			const requestsResetDate = new Date(Date.now() + requestsResetMs);

			const tokensRemaining = Number(headers.get('x-ratelimit-remaining-tokens'));
			const tokensLimit = Number(headers.get('x-ratelimit-limit-tokens'));
			const tokensResetMs = ms(headers.get('x-ratelimit-reset-tokens') || '0') as number;
			const tokensResetDate = new Date(Date.now() + tokensResetMs);

			return {
				content: this.transformResponse(openaiMessage),
				usage: this.transformUsage(openaiMessage.usage as TUsage),
				metadata: {
					model: openaiMessage.model,
					provider: this.getProviderName(),
					requestId: openaiMessage.id,
					type: openaiMessage.object === 'chat.completion' ? 'message' : 'error',
					role: openaiMessage.choices[0].message.role,
					stopReason: openaiMessage.choices[0].finish_reason,
					stopSequence: '',
					systemFingerprint: openaiMessage.system_fingerprint,
				},
				rateLimit: {
					requestsRemaining,
					requestsLimit,
					requestsResetDate,
					tokensRemaining,
					tokensLimit,
					tokensResetDate,
				},
				responseStatus: {
					statusCode: openaiResponse.status,
					statusText: openaiResponse.statusText,
				},
			};
		} catch (error) {
			this.monitor.metrics.provider_errors++;
			if (error instanceof LLMError) {
				throw error;
			} else {
				throw this.transformError(error as Error);
			}
		}
	}

	protected transformMessages(bbRequest: BBLLMRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
		console.debug(`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] Transforming messages`);
		this.monitor.startTimer('provider_transform');

		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

		// Add system message if present
		if (bbRequest.system) {
			messages.push({
				role: 'system',
				content: bbRequest.system,
			});
		}

		// Transform conversation messages
		bbRequest.messages.forEach((message: BBLLMRequestMessage) => {
			if (message.role === 'assistant') {
				const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
				const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

				message.content.forEach((part) => {
					if (part.type === 'tool_use') {
						toolCalls.push({
							id: part.id,
							type: 'function',
							function: {
								name: part.name,
								arguments: JSON.stringify(part.input),
							},
						});
					} else if (part.type === 'text') {
						contentParts.push({
							type: 'text',
							text: part.text,
						});
					}
				});

				const assistantMessage = {
					role: 'assistant',
					content: contentParts.length > 0 ? contentParts : null,
				} as OpenAI.Chat.ChatCompletionAssistantMessageParam;

				if (toolCalls.length > 0) {
					assistantMessage.tool_calls = toolCalls;
				}

				messages.push(assistantMessage);
			} else if (message.role === 'user') {
				const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];

				message.content.forEach((part) => {
					if (part.type === 'tool_result') {
						const contentParts = part.content?.map((p) => {
							if (p.type === 'text' && p.text) {
								return {
									type: 'text',
									text: p.text,
								} as OpenAI.Chat.ChatCompletionContentPartText;
							}
							if (p.type === 'image') {
								return {
									type: 'image_url',
									image_url: { url: p.source.data },
								}; //as OpenAI.Chat.ChatCompletionContentPartImage;
							}
							return {
								type: 'text',
								text: '',
							} as OpenAI.Chat.ChatCompletionContentPartText;
						}) ?? [] as OpenAI.Chat.ChatCompletionContentPartText[];

						messages.push({
							role: 'tool',
							content: contentParts, //as OpenAI.Chat.ChatCompletionContentPartText[],
							tool_call_id: part.tool_use_id,
						} as OpenAI.Chat.ChatCompletionToolMessageParam);
					} else if (part.type === 'text') {
						contentParts.push({
							type: 'text',
							text: part.text,
						});
					} else if (part.type === 'image') {
						contentParts.push({
							type: 'image_url',
							image_url: { url: part.source.data },
						});
					}
				});

				if (contentParts.length > 0) {
					messages.push({
						role: 'user',
						content: contentParts,
					} as OpenAI.Chat.ChatCompletionMessageParam);
				}
			}
		});

		this.monitor.stopTimer('provider_transform');
		return messages;
	}

	protected transformTools(tools: BBLLMRequest['tools']): OpenAI.Chat.ChatCompletionTool[] {
		this.monitor.startTimer('provider_transform');
		const toolsTransformed = tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			},
		} as OpenAI.Chat.ChatCompletionTool));
		this.monitor.stopTimer('provider_transform');
		return toolsTransformed;
	}

	protected transformResponse(
		openaiMessage: OpenAI.Chat.ChatCompletion,
	): Array<BBLLMContentBlockParam> {
		console.debug(`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] Transforming provider response`);
		this.monitor.startTimer('provider_transform');

		this.monitor.startTimer('provider_validation');
		if (!openaiMessage || !openaiMessage.choices || openaiMessage.choices.length === 0) {
			console.debug(
				`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] ERROR: Invalid response - missing message or choices:`,
				{
					openaiMessage,
				},
			);
			this.monitor.metrics.provider_errors++;
			throw new LLMError(
				'Invalid response from provider: missing required properties',
				400,
				ProxyErrorType.PROVIDER_BAD_RESPONSE,
			);
		}

		const choice = openaiMessage.choices[0];
		const message = choice.message;

		if (!message) {
			console.debug(
				`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] ERROR: Invalid response - missing message in choice`,
			);
			this.monitor.metrics.provider_errors++;
			throw new LLMError(
				'Invalid response from provider: missing message in choice',
				400,
				ProxyErrorType.PROVIDER_BAD_RESPONSE,
			);
		}

		const contentParts: BBLLMContentBlockParam[] = [];

		// Handle text content
		if (message.content) {
			contentParts.push({
				type: 'text',
				text: message.content,
			});
		}

		// Handle tool calls
		if (message.tool_calls) {
			message.tool_calls.forEach((toolCall) => {
				contentParts.push({
					type: 'tool_use',
					id: toolCall.id,
					name: toolCall.function.name,
					input: JSON.parse(toolCall.function.arguments),
				} as BBLLMToolUseBlock);
			});
		}

		this.monitor.stopTimer('provider_validation');
		this.monitor.stopTimer('provider_transform');

		return contentParts;
	}

	protected transformError(error: Error): ProxyError {
		console.debug(`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] ERROR: Error in provider request:`, {
			errorMessage: error.message,
			errorName: error.name,
			errorStack: error.stack,
		});

		// Handle rate limit errors
		if (error.message.includes('Rate limit')) {
			return new ProxyError(
				'Provider rate limit exceeded',
				429,
				ProxyErrorType.PROVIDER_RATE_LIMITED,
				{},
			);
		}

		// Handle authentication errors
		if (error.message.includes('Incorrect API key') || error.message.includes('Authentication failed')) {
			return new ProxyError(
				'Invalid provider API key',
				401,
				ProxyErrorType.PROVIDER_INVALID_KEY,
				{},
			);
		}

		// Generic error handling
		return new ProxyError(
			error.message || 'Unknown provider API error',
			400,
			ProxyErrorType.PROVIDER_ERROR,
			{},
		);
	}

	protected getProviderName(): string {
		throw new Error('getProviderName must be implemented by child class');
	}

	protected transformUsage(_usage: TUsage | undefined): BBLLMTokenUsage {
		throw new Error('transformUsage must be implemented by child class');
	}
}
