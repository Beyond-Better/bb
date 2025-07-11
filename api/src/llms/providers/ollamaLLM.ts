import { Ollama } from 'ollama';
import type { ChatRequest, ChatResponse, Message, Tool, ToolCall } from 'ollama';
import { LLMCallbackType, LLMProvider, OllamaModel } from 'api/types.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';
import type {
	LLMCallbacks,
	LLMMessageStop,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMRequestParams,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from 'api/types/llms.ts';
import { DEFAULT_TOKEN_USAGE } from 'shared/types.ts';
import LLM from './baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
//import { extractTextFromContent } from 'api/utils/llms.ts';

// // Define Ollama-specific types
// interface OllamaTokenUsage {
// 	prompt_tokens: number;
// 	completion_tokens: number;
// }
//
// interface OllamaToolCall {
// 	id: string;
// 	function: {
// 		name: string;
// 		arguments: string;
// 	};
// }

interface OllamaMessage {
	role: string;
	content: string;
	tool_calls?: ToolCall[];
}

type OllamaChatRequest = ChatRequest & { stream?: false | undefined };

//interface OllamaChatResponse {
//    model: string;
//    message: OllamaMessage;
//    usage: OllamaTokenUsage;
//}

class OllamaLLM extends LLM {
	private ollama!: Ollama;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.OLLAMA;

		this.initializeOllamaClient();
	}

	// deno-lint-ignore require-await
	private async initializeOllamaClient() {
		const ollamaHost = this.projectConfig.api?.llmProviders?.ollama?.baseUrl ||
			'http://127.0.0.1:11434';
		if (!ollamaHost) {
			throw createError(
				ErrorType.LLM,
				'Ollama API endpoint is not configured',
				{ provider: this.llmProviderName } as LLMErrorOptions,
			);
		}

		this.ollama = new Ollama({
			host: ollamaHost,
		});
	}

	private asProviderMessageType(messages: LLMMessage[]): Message[] {
		//logger.info(`LlmProvider[${this.llmProviderName}]: asProviderMessageType-messages`, messages);
		const providerMessages: { role: string; content: string }[] = [];

		messages.forEach((message) => {
			if (message.role === 'assistant') {
				let content = '';
				message.content.forEach((part) => {
					if (part.type === 'text') {
						content += part.text;
					}
				});
				providerMessages.push({
					role: 'assistant',
					content,
				});
			} else if (message.role === 'user') {
				let content = '';
				message.content.forEach((part) => {
					if (part.type === 'text') {
						content += part.text;
					} else if (part.type === 'tool_result') {
						providerMessages.push({
							role: 'tool',
							content: part.content?.map((p) => p.type === 'text' ? p.text : '').join('') || '',
						});
					}
				});
				if (content) {
					providerMessages.push({
						role: 'user',
						content,
					});
				}
			}
		});

		//logger.info(`LlmProvider[${this.llmProviderName}]: asProviderMessageType-providerMessages`, providerMessages);
		return providerMessages;
	}

	private asProviderToolType(tools: LLMTool[]): Tool[] {
		return tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: {
					type: 'object',
					required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : [],
					properties: Object.entries(tool.inputSchema.properties || {}).reduce((acc, [key, prop]) => ({
						...acc,
						[key]: {
							type: typeof prop.type === 'string' ? prop.type : 'string',
							description: prop.description || '',
							...(Array.isArray(prop.enum) ? { enum: prop.enum } : {}),
						},
					}), {}),
				},
			},
		}));
	}

	private asApiMessageContentPartsType(message: OllamaMessage): LLMMessageContentPart[] {
		const contentParts: LLMMessageContentParts = [];

		if (message.content) {
			contentParts.push({
				type: 'text',
				text: message.content,
			} as LLMMessageContentPartTextBlock);
		}

		if (message.tool_calls) {
			message.tool_calls.forEach((tool) => {
				contentParts.push({
					//id: tool.id,
					type: 'tool_use',
					name: tool.function.name,
					input: tool.function.arguments, // Don't parse, use directly
				} as LLMMessageContentPartToolUseBlock);
			});
		}

		return contentParts;
	}

	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<OllamaChatRequest> {
		const messages = this.asProviderMessageType(messageRequest.messages);
		const tools = this.asProviderToolType(messageRequest.tools);
		const system = messageRequest.system;
		const model: string = messageRequest.model || OllamaModel.SMOLLM2_1_7B;

		// Resolve parameters using model capabilities
		let temperature: number;

		if (interaction) {
			// Use interaction to resolve parameters with proper priority
			const resolved = await interaction.resolveModelParameters(
				model,
				{
					//maxTokens: messageRequest.maxTokens,  // Ollama doesn't use maxTokens
					temperature: messageRequest.temperature,
				},
				LLMProvider.OLLAMA,
			);
			temperature = resolved.temperature;
		} else {
			// Fallback if interaction is not provided
			const projectEditor = await this.invoke(LLMCallbackType.PROJECT_EDITOR);
			const registryService = await ModelRegistryService.getInstance(projectEditor.projectConfig);

			temperature = registryService.resolveTemperature(
				model,
				messageRequest.temperature,
			);
		}

		return {
			model,
			messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
			...(tools.length > 0 && { tools }),
			options: {
				temperature,
			},
			stream: false,
		};
	}

	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			//logger.debug(`LlmProvider[${this.llmProviderName}]: speakWith-messageRequest`, JSON.stringify(messageRequest, null, 2));

			const providerMessageRequest: OllamaChatRequest = await this.asProviderMessageRequest(
				messageRequest,
				interaction,
			);

			const response: ChatResponse = await this.ollama.chat(providerMessageRequest);
			//logger.debug(`LlmProvider[${this.llmProviderName}]: response`, response);

			const messageResponse: LLMProviderMessageResponse = {
				id: crypto.randomUUID(), // Ollama doesn't provide message IDs
				type: 'message',
				role: response.message.role as 'assistant',
				model: response.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: this.asApiMessageContentPartsType(response.message),
				answer: response.message.content,
				isTool: 'tool_calls' in response.message,
				messageStop: {
					stopReason: response.done_reason as LLMMessageStop['stopReason'], //response.message.tool_calls ? 'tool_calls' : 'stop',
					stopSequence: null,
				},
				usage: DEFAULT_TOKEN_USAGE(),
				// {
				// 	inputTokens: 0, //response.usage?.prompt_tokens ?? 0,
				// 	outputTokens: 0, //response.usage?.completion_tokens ?? 0,
				// 	totalTokens: 0, //(response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
				// 	cacheCreationInputTokens: 0, // Ollama doesn't support caching
				// },
				rateLimit: {
					requestsRemaining: 0,
					requestsLimit: 0,
					requestsResetDate: new Date(),
					tokensRemaining: 0,
					tokensLimit: 0,
					tokensResetDate: new Date(),
				},
				providerMessageResponseMeta: {
					statusCode: 200,
					statusText: 'OK',
				},
			};

			const llmRequestParams: LLMRequestParams = {
				modelConfig: {
					model: messageRequest.model,
					maxTokens: 0, //providerMessageRequest.max_tokens!,
					temperature: providerMessageRequest.options!.temperature!,
					extendedThinking: messageRequest.extendedThinking,
					usePromptCaching: this.projectConfig.api?.usePromptCaching ?? true,
				},
			};

			//logger.debug(`LlmProvider[${this.llmProviderName}]: messageResponse`, messageResponse);
			return { messageResponse, messageMeta: { system: messageRequest.system, llmRequestParams } };
		} catch (err) {
			logger.error('Error calling Ollama API', err);
			throw createError(
				ErrorType.LLM,
				`Could not get response from Ollama API: ${(err as Error).message}`,
				{
					model: messageRequest.model,
					provider: this.llmProviderName,
				} as LLMErrorOptions,
			);
		}
	}

	protected override modifySpeakWithInteractionOptions(
		interaction: LLMInteraction,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		if (validationFailedReason.startsWith('Tool input validation failed')) {
			const prevMessage = interaction.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				interaction.addMessageForToolResult(
					prevMessage.providerResponse.toolsUsed![0].toolUseId,
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema. Ensure you are using arrays and objects instead of JSON strings.",
					true,
				);
			} else {
				logger.warn(
					`LlmProvider[${this.llmProviderName}]: modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
				);
			}
		} else if (validationFailedReason === 'Empty answer') {
			speakOptions.temperature = speakOptions.temperature ? Math.min(speakOptions.temperature + 0.1, 1) : 0.5;
		}
	}

	protected override checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		if (llmProviderMessageResponse.messageStop.stopReason) {
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'tool_calls':
					logger.warn(`LlmProvider[${this.llmProviderName}]: Response is using a tool`);
					break;
				case 'stop':
					logger.warn(`LlmProvider[${this.llmProviderName}]: Response reached its natural end`);
					break;
				default:
					logger.info(
						`LlmProvider[${this.llmProviderName}]: Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default OllamaLLM;
