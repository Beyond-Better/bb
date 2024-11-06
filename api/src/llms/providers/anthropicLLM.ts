import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';

import { AnthropicModel, LLMCallbackType, LLMProvider } from 'api/types.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from '../interactions/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from '../../types.ts';

type AnthropicBlockParam =
	| string
	| Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam
	| Anthropic.Beta.PromptCaching.PromptCachingBetaImageBlockParam
	| Anthropic.Beta.PromptCaching.PromptCachingBetaToolUseBlockParam
	| Anthropic.Beta.PromptCaching.PromptCachingBetaToolResultBlockParam
	| Array<
		| Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam
		| Anthropic.Beta.PromptCaching.PromptCachingBetaImageBlockParam
		| Anthropic.Beta.PromptCaching.PromptCachingBetaToolUseBlockParam
		| Anthropic.Beta.PromptCaching.PromptCachingBetaToolResultBlockParam
	>;
class AnthropicLLM extends LLM {
	private anthropic!: Anthropic;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.ANTHROPIC;

		this.initializeAnthropicClient();
	}

	private initializeAnthropicClient() {
		const clientOptions: ClientOptions = {
			apiKey: this.fullConfig.api?.anthropicApiKey,
		};
		this.anthropic = new Anthropic(clientOptions);
	}

	// Helper function to check for bbFile tags
	private hasBBFileTags(text: string): boolean {
		try {
			const matches = text.match(/<bbFile path=.+?>/gs);
			return matches !== null && matches.length > 0;
		} catch (e) {
			return false;
		}
	}

	private logMessageDetails(messages: Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam[]): void {
		logger.info('Message Details for LLM Request:');

		const messagesWithCache: number[] = [];
		const messagesWithFiles: number[] = [];

		messages.forEach((message, index) => {
			const contentParts = Array.isArray(message.content) ? message.content : [message.content];
			const summary: string[] = [];

			const processContent = (part: any, depth: number = 0): void => {
				const indent = '  '.repeat(depth);

				if (typeof part === 'string') {
					summary.push(`${indent}Content: plain text (no bbFile or cache_control possible)`);
					return;
				}

				// Log the type of this part
				summary.push(`${indent}Type: ${part.type}`);

				// For tool_result, process its nested content
				if (part.type === 'tool_result' && Array.isArray(part.content)) {
					summary.push(`${indent}Tool Use ID: ${part.tool_use_id || 'none'}`);
					summary.push(`${indent}Is Error: ${part.is_error || false}`);

					// Check if any nested content has file content
					const fileContentParts = part.content.filter((nestedPart: LLMMessageContentPartTextBlock) =>
						nestedPart.type === 'text' &&
						typeof nestedPart.text === 'string' &&
						(this.hasBBFileTags(nestedPart.text) ||
							(nestedPart.text.startsWith('Note: File') &&
								nestedPart.text.includes('is up-to-date')))
					);
					if (fileContentParts.length > 0) {
						summary.push(`${indent}Files in this tool_result:`);
						fileContentParts.forEach((p: LLMMessageContentPartTextBlock) => {
							if (p.text.startsWith('Note: File')) {
								const match = p.text.match(
									/Note: File (.*?) \(this revision: (\w+)\) is up-to-date at turn (\d+) with revision (\w+)/,
								);
								if (match) {
									summary.push(
										`${indent}  - ${match[1]} [this revision ${match[2]}] (current from turn ${
											match[3]
										} with revision ${match[4]})`,
									);
								}
							} else {
								const bbFileMatch = p.text.match(
									/<bbFile[^>]*path="([^"]*)"[^>]*revision="([^"]*)"[^>]*>/,
								);
								if (bbFileMatch && bbFileMatch.length >= 3) {
									summary.push(`${indent}  - ${bbFileMatch[1]} (revision: ${bbFileMatch[2]})`);
								}
							}
						});
						messagesWithFiles.push(index + 1);
					}

					summary.push(`${indent}Nested Content:`);
					part.content.forEach((nestedPart: any, nestedIndex: number) => {
						summary.push(`${indent}  Content Part ${nestedIndex + 1}:`);
						processContent(nestedPart, depth + 2);
					});
					return;
				}

				// Process text content
				if ('text' in part && typeof part.text === 'string') {
					const hasFileContent = this.hasBBFileTags(part.text);
					const hasFileNote = part.text.startsWith('Note: File') &&
						part.text.includes('content is up-to-date');
					summary.push(`${indent}Has file content: ${hasFileContent || hasFileNote}`);

					if (hasFileNote) {
						const match = part.text.match(
							/Note: File (.*?) \(this revision: (\w+)\) is up-to-date at turn (\d+) with revision (\w+)/,
						);
						if (match) {
							summary.push(
								`${indent}File: ${match[1]} [this revision ${match[2]}] (current from turn ${
									match[3]
								} with revision ${match[4]})`,
							);
						}
					}

					// Extract file path and revision from bbFile tags if present
					try {
						const bbFileMatch = part.text.match(/<bbFile[^>]*path="([^"]*)"[^>]*revision="([^"]*)"[^>]*>/);
						if (bbFileMatch && bbFileMatch.length >= 3) {
							summary.push(`${indent}bbFile Path: ${bbFileMatch[1]}`);
							summary.push(`${indent}bbFile Revision: ${bbFileMatch[2]}`);
						}
					} catch (e) {}

					// Check for bbFile tags
					const hasTags = this.hasBBFileTags(part.text);
					if (hasTags) {
						const bbFileMatch = part.text.match(
							/<bbFile path="([^"]*)" type="([^"]*)"[^>]*?revision="([^"]*)"[^>]*?>/,
						);
						if (bbFileMatch) {
							const [, path, type, revision] = bbFileMatch;
							summary.push(`${indent}bbFile: ${path} (${type}) [revision: ${revision}]`);
						}
					} else {
						summary.push(`${indent}No bbFile tags found`);
					}
				}

				// Check for cache_control
				if (part && typeof part === 'object' && 'cache_control' in part) {
					const cacheControl = (part as any).cache_control;
					summary.push(`${indent}Has cache_control: yes (${cacheControl.type})`);
					if (!messagesWithCache.includes(index + 1)) {
						messagesWithCache.push(index + 1);
					}
				} else {
					summary.push(`${indent}Has cache_control: no`);
				}
			};

			summary.push(`\nMessage ${index + 1}:`);
			summary.push(`Role: ${message.role}`);
			summary.push(`Content Parts: ${contentParts.length}`);

			contentParts.forEach((part, partIndex) => {
				summary.push(`\n  Content Part ${partIndex + 1}:`);
				processContent(part, 1);
			});

			logger.info(summary.join('\n'));
		});

		logger.info(`\nMessages with files: ${messagesWithFiles.join(', ')}`);
		logger.info(`Messages with cache_control: ${messagesWithCache.join(', ')}`);
	}

	//private asProviderMessageType(messages: LLMMessage[]): Anthropic.MessageParam[] {
	private asProviderMessageType(
		messages: LLMMessage[],
	): Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam[] {
		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;

		// Find all messages that contain file additions with non-empty bbFile tags
		const fileAddedMessages = messages
			.map((m, index) => ({ message: m, index }))
			.filter(({ message }) =>
				message.role === 'user' &&
				Array.isArray(message.content) &&
				message.content.some((block) => {
					if (block.type === 'tool_result' && Array.isArray(block.content)) {
						// Look for bbFile tags (for text or image) or file update notes in the nested content
						// we only need to check type === 'text' - images will have a corresponding text part with <bbFile> tags
						// return block.content.some((nestedPart) => (nestedPart.type === 'text' &&
						// 	(this.hasBBFileTags(nestedPart.text) ||
						// 		nestedPart.text.startsWith('Note: File') &&
						// 			nestedPart.text.includes('is up-to-date')))
						// );
						return block.content.some((nestedPart) => (nestedPart.type === 'text' &&
							this.hasBBFileTags(nestedPart.text))
						);
					}
					return false;
				})
			);

		// Get the last three such messages
		const lastThreeFileAddedMessages = fileAddedMessages.slice(-3);
		const lastThreeIndices = new Set(lastThreeFileAddedMessages.map((m) => m.index));

		return messages.map((m, index) => {
			const prevContent: AnthropicBlockParam = m.content as AnthropicBlockParam;
			let content: AnthropicBlockParam;

			// Add cache_control to the last content part of the last three file-added messages
			if (m.role === 'user' && usePromptCaching && lastThreeIndices.has(index)) {
				// Verify this message actually has a tool_result with file content
				// const hasFileContent = Array.isArray(m.content) &&
				// 	m.content.some((block) =>
				// 		block.type === 'tool_result' &&
				// 		Array.isArray(block.content) &&
				// 		block.content.some((part) =>
				// 			(part.type === 'text' &&
				// 				typeof part.text === 'string' &&
				// 				(this.hasBBFileTags(part.text) ||
				// 					(part.text.startsWith('Note: File') &&
				// 						part.text.includes('is up-to-date')))) ||
				// 			part.type === 'image'
				// 		)
				// 	);
				const hasFileContent = Array.isArray(m.content) &&
					m.content.some((block) =>
						block.type === 'tool_result' &&
						Array.isArray(block.content) &&
						// we only need to check type === 'text' - images will have a corresponding text part with <bbFile> tags
						block.content.some((part) => (part.type === 'text' &&
							this.hasBBFileTags(part.text))
						)
					);

				if (hasFileContent) {
					if (Array.isArray(prevContent)) {
						content = [...prevContent];
						const lastBlock = content[content.length - 1];
						content[content.length - 1] = { ...lastBlock, cache_control: { type: 'ephemeral' } };
					} else if (typeof prevContent === 'string') {
						content = [{ type: 'text', text: prevContent, cache_control: { type: 'ephemeral' } }];
					} else {
						content = [{ ...prevContent, cache_control: { type: 'ephemeral' } }];
					}
				} else {
					content = (Array.isArray(prevContent)
						? prevContent
						: [prevContent]) as Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam[];
				}
			} else {
				content = (Array.isArray(prevContent)
					? prevContent
					: [prevContent]) as Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam[];
			}
			return {
				role: m.role,
				content: content,
			} as Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam;
		});
	}

	private asProviderToolType(tools: LLMTool[]): Anthropic.Beta.PromptCaching.PromptCachingBetaTool[] {
		//logger.debug('llms-anthropic-asProviderToolType', tools);
		return tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: tool.inputSchema,
		} as Anthropic.Tool));
	}

	async prepareMessageParams(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<Anthropic.MessageCreateParams> {
		//logger.debug('llms-anthropic-prepareMessageParams-systemPrompt', interaction.baseSystem);
		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;
		const systemPrompt = await this.invoke(
			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
			speakOptions?.system || interaction.baseSystem,
			interaction.id,
		);
		const system = systemPrompt
			? [
				{
					type: 'text',
					text: systemPrompt,
					...(usePromptCaching ? { cache_control: { type: 'ephemeral' } } : {}),
				} as Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam,
			]
			: '';

		//logger.debug('llms-anthropic-prepareMessageParams-tools', interaction.allTools());
		const tools = this.asProviderToolType(
			await this.invoke(
				LLMCallbackType.PREPARE_TOOLS,
				speakOptions?.tools || interaction.allTools(),
				interaction.id,
			),
		);
		// system cache_control also includes tools
		//if (tools.length > 0 && usePromptCaching) {
		//	tools[tools.length - 1].cache_control = { type: 'ephemeral' };
		//}

		const messages = this.asProviderMessageType(
			await this.invoke(
				LLMCallbackType.PREPARE_MESSAGES,
				speakOptions?.messages || interaction.getMessages(),
				interaction.id,
			),
		);
		// Log detailed message information
		if (this.fullConfig.api.logFileHydration) this.logMessageDetails(messages);

		if (!speakOptions?.maxTokens && !interaction.maxTokens) {
			logger.error('maxTokens missing from both speakOptions and interaction');
		}
		if (!speakOptions?.temperature && !interaction.temperature) {
			logger.error('temperature missing from both speakOptions and interaction');
		}

		const model: string = speakOptions?.model || interaction.model || AnthropicModel.CLAUDE_3_5_SONNET;
		const maxTokens: number = speakOptions?.maxTokens || interaction.maxTokens || 8192;
		const temperature: number = speakOptions?.temperature || interaction.temperature || 0.2;

		const messageParams: Anthropic.Beta.PromptCaching.MessageCreateParams = {
			messages,
			system,
			tools,
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};
		//logger.debug('llms-anthropic-prepareMessageParams', messageParams);
		//logger.dir(messageParams);

		return messageParams;
	}

	/**
	 * Run Anthropic service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from Anthropic or an error
	 */
	public async speakWith(
		messageParams: LLMProviderMessageRequest,
	): Promise<LLMSpeakWithResponse> {
		try {
			logger.dir(messageParams);

			// https://github.com/anthropics/anthropic-sdk-typescript/blob/6886b29e0a550d28aa082670381a4bb92101099c/src/resources/beta/prompt-caching/prompt-caching.ts
			//const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(
			const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.beta
				.promptCaching.messages.create(
					messageParams as Anthropic.MessageCreateParams,
					{
						headers: { 'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15' },
					},
				).withResponse();

			const anthropicMessage = anthropicMessageStream as Anthropic.Beta.PromptCaching.PromptCachingBetaMessage;
			//logger.info('llms-anthropic-anthropicMessage', anthropicMessage);
			//logger.info('llms-anthropic-anthropicResponse', anthropicResponse);

			const headers = anthropicResponse?.headers;

			//const requestId = headers.get('request-id');

			const requestsRemaining = Number(headers.get('anthropic-ratelimit-requests-remaining'));
			const requestsLimit = Number(headers.get('anthropic-ratelimit-requests-limit'));
			const requestsResetDate = new Date(headers.get('anthropic-ratelimit-requests-reset') || '');

			const tokensRemaining = Number(headers.get('anthropic-ratelimit-tokens-remaining'));
			const tokensLimit = Number(headers.get('anthropic-ratelimit-tokens-limit'));
			const tokensResetDate = new Date(headers.get('anthropic-ratelimit-tokens-reset') || '');

			const messageResponse: LLMProviderMessageResponse = {
				id: anthropicMessage.id,
				type: anthropicMessage.type,
				role: anthropicMessage.role,
				model: anthropicMessage.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: anthropicMessage.content as LLMMessageContentParts,
				isTool: anthropicMessage.stop_reason === 'tool_use',
				messageStop: {
					stopReason: anthropicMessage.stop_reason,
					stopSequence: anthropicMessage.stop_sequence,
				},
				usage: {
					inputTokens: anthropicMessage.usage.input_tokens,
					outputTokens: anthropicMessage.usage.output_tokens,
					totalTokens: (anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens),
					cacheCreationInputTokens: anthropicMessage.usage.cache_creation_input_tokens || 0,
					cacheReadInputTokens: anthropicMessage.usage.cache_read_input_tokens || 0,
				},
				rateLimit: {
					requestsRemaining,
					requestsLimit,
					requestsResetDate,
					tokensRemaining,
					tokensLimit,
					tokensResetDate,
				},
				providerMessageResponseMeta: {
					status: anthropicResponse.status,
					statusText: anthropicResponse.statusText,
				},
			};
			//logger.debug("llms-anthropic-messageResponse", messageResponse);

			return { messageResponse, messageMeta: { system: messageParams.system } };
		} catch (err) {
			logger.error('Error calling Anthropic API', err);
			throw createError(
				ErrorType.LLM,
				'Could not get response from Anthropic API.',
				{
					model: messageParams.model,
					provider: this.llmProviderName,
				} as LLMErrorOptions,
			);
		}
	}

	protected modifySpeakWithInteractionOptions(
		interaction: LLMInteraction,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		// // [TODO] impelement keep speaking
		// // check stop reason, if it was max_tokens, then keep speaking
		// this.checkStopReason(prevMessage.providerResponse);

		if (validationFailedReason.startsWith('Tool input validation failed')) {
			// Prompt the model to provide a valid tool input
			const prevMessage = interaction.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				//[TODO] we're assuming a single tool is provided, and we're assuming only a single tool is used by LLM
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
		} else if (validationFailedReason === 'Tool exceeded max tokens') {
			// Prompt the model to provide a smaller tool input
			interaction.addMessageForUserRole({
				'type': 'text',
				'text':
					'The previous tool input was too large. Please provide a smaller answer, and I will keep asking for more until I have all of it',
			} as LLMMessageContentPartTextBlock);
		} else if (validationFailedReason === 'Empty answer') {
			// Increase temperature or adjust other parameters to encourage more diverse responses
			speakOptions.temperature = speakOptions.temperature ? Math.min(speakOptions.temperature + 0.1, 1) : 0.5;
		}
	}

	protected checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		// Check if the response has a stop reason
		if (llmProviderMessageResponse.messageStop.stopReason) {
			// Perform special handling based on the stop reason
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'max_tokens':
					logger.warn(`provider[${this.llmProviderName}] Response reached the maximum token limit`);

					break;
				case 'end_turn':
					logger.warn(`provider[${this.llmProviderName}] Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`provider[${this.llmProviderName}] Response is using a tool`);
					break;
				default:
					logger.info(
						`provider[${this.llmProviderName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default AnthropicLLM;
