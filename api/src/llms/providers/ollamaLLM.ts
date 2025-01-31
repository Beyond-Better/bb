import { Ollama } from 'ollama';
import type { ChatRequest, ChatResponse, Message, Tool, ToolCall } from 'ollama';
import { LLMProvider, OllamaModel } from 'api/types.ts';
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
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from 'api/types/llms.ts';
import LLM from './baseLLM.ts';
import { logger } from 'shared/logger.ts';
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

	private async initializeOllamaClient() {
		//const ollamaHost = 'http://127.0.0.1:11434'; //this.projectConfig.settings.api?.llmEndpoints?.ollama;
		const ollamaHost = 'http://192.168.1.12:11434'; //this.projectConfig.settings.api?.llmEndpoints?.ollama;
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
		logger.info('llms-ollama-asProviderMessageType-messages', messages);
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

		logger.info('llms-ollama-asProviderMessageType-providerMessages', providerMessages);
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
		_interaction?: LLMInteraction,
	): Promise<OllamaChatRequest> {
		const messages = this.asProviderMessageType(messageRequest.messages);
		const tools = this.asProviderToolType(messageRequest.tools);
		const system = messageRequest.system;
		const model: string = messageRequest.model || OllamaModel.SMOLLM2_1_7B;
		const temperature: number = messageRequest.temperature;

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
			logger.debug('llms-ollama-speakWith-messageRequest', JSON.stringify(messageRequest, null, 2));

			const providerMessageRequest: OllamaChatRequest = await this.asProviderMessageRequest(
				messageRequest,
				interaction,
			);

			const response: ChatResponse = await this.ollama.chat(providerMessageRequest);
			logger.debug('llms-ollama-response', response);

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
				usage: {
					inputTokens: 0, //response.usage?.prompt_tokens ?? 0,
					outputTokens: 0, //response.usage?.completion_tokens ?? 0,
					totalTokens: 0, //(response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
					cacheCreationInputTokens: 0, // Ollama doesn't support caching
					cacheReadInputTokens: 0,
				},
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

			logger.debug('llms-ollama-messageResponse', messageResponse);
			return { messageResponse, messageMeta: { system: messageRequest.system } };
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
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
					true,
				);
			} else {
				logger.warn(
					`provider[${this.llmProviderName}] modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
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
					logger.warn(`provider[${this.llmProviderName}] Response is using a tool`);
					break;
				case 'stop':
					logger.warn(`provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				default:
					logger.info(
						`provider[${this.llmProviderName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default OllamaLLM;
