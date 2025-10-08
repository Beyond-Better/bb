import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';
import { decodeBase64 } from '@std/encoding';

import { AnthropicModel, LLMCallbackType, LLMProvider } from 'api/types.ts';
import { BB_RESOURCE_METADATA_DELIMITER } from 'api/llms/conversationInteraction.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { createError, errorMessage } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import type {
	LLMCallbacks,
	//LLMExtendedThinkingOptions,
	LLMMessageStop,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMRequestParams,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from 'api/types.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';

// Define a more specific type for Anthropic content blocks that includes our custom properties
type AnthropicContentBlock = Anthropic.Messages.ContentBlockParam & {
	cache_control?: { type: string };
};
type AnthropicBlockParamOrString =
	| string
	| Anthropic.Messages.ContentBlockParam;
type AnthropicBlockParamOrArray =
	| string
	| Anthropic.Messages.ContentBlockParam
	| Array<
		Anthropic.Messages.ContentBlockParam
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
			apiKey: this.projectConfig.api?.llmProviders?.anthropic?.apiKey,
		};

		this.anthropic = new Anthropic(clientOptions);
	}

	// Helper function to check for file metadata blocks
	private hasFileMetadata(text: string): boolean {
		try {
			return text.includes(BB_RESOURCE_METADATA_DELIMITER);
		} catch (_e) {
			return false;
		}
	}

	private logMessageDetails(messages: Anthropic.Messages.MessageParam[]): void {
		logger.info(`LlmProvider[${this.llmProviderName}]: Message Details for LLM Request:`);

		const messagesWithCache: number[] = [];
		const messagesWithFiles: number[] = [];

		messages.forEach((message, index) => {
			const contentParts: AnthropicBlockParamOrString[] = Array.isArray(message.content)
				? message.content
				: [message.content];
			const summary: string[] = [];

			const processContent = (part: AnthropicBlockParamOrString, depth: number = 0): void => {
				const indent = '  '.repeat(depth);

				if (typeof part === 'string') {
					summary.push(`${indent}Content: plain text (no metadata or cache_control possible)`);
					return;
				}

				// Log the type of this part
				summary.push(`${indent}Type: ${part.type}`);

				// For tool_result, process its nested content
				if (part.type === 'tool_result' && Array.isArray(part.content)) {
					summary.push(`${indent}Tool Use ID: ${part.tool_use_id || 'none'}`);
					summary.push(`${indent}Is Error: ${part.is_error || false}`);

					// Check if any nested content has file content
					// Use a more specific type for the content parts
					const fileContentParts = part.content.filter((nestedPart) => {
						// Check if it's a text block
						if (nestedPart.type !== 'text') return false;

						// Safe access to text property using type guard
						const textBlock = nestedPart as Anthropic.Messages.TextBlockParam;
						if (typeof textBlock.text !== 'string') return false;

						// Check for file metadata or file note
						return this.hasFileMetadata(textBlock.text) ||
							(textBlock.text.startsWith('Note: File') && textBlock.text.includes('is up-to-date'));
					});

					if (fileContentParts.length > 0) {
						summary.push(`${indent}Files in this tool_result:`);
						fileContentParts.forEach((p) => {
							// Use a more specific type for the content part
							const textBlock = p as Anthropic.Messages.TextBlockParam;
							// We've already filtered for text blocks with string text
							if (textBlock.type === 'text' && typeof textBlock.text === 'string') {
								if (textBlock.text.startsWith('Note: File')) {
									const match = textBlock.text.match(
										/Note: File (.*?) \(revision: (\w+)\) content is up-to-date from turn (\d+) \(revision: (\w+)\)/,
									);
									if (match) {
										summary.push(
											`${indent}  - ${match[1]} with revision ${match[2]} (current from turn ${
												match[3]
											} with revision ${match[4]})`,
										);
									}
								} else if (this.hasFileMetadata(textBlock.text)) {
									try {
										const metadataText = textBlock.text.split(BB_RESOURCE_METADATA_DELIMITER)[1]
											.trim();
										const metadata = JSON.parse(metadataText);
										summary.push(
											`${indent}  - ${metadata.path} (${metadata.type}) [revision: ${metadata.revision}]`,
										);
										summary.push(`${indent}    Size: ${metadata.size} bytes`);
										summary.push(`${indent}    Last Modified: ${metadata.last_modified}`);
										if (metadata.mime_type) {
											summary.push(`${indent}    MIME Type: ${metadata.mime_type}`);
										}
									} catch (e) {
										summary.push(
											`${indent}  - Error parsing file metadata: ${errorMessage(e)}`,
										);
									}
								}
							} else {
								logger.error(`content part is not type text: ${p.type}`);
							}
						});
						messagesWithFiles.push(index + 1);
					}

					summary.push(`${indent}Nested Content:`);
					part.content.forEach((nestedPart: AnthropicBlockParamOrString, nestedIndex: number) => {
						summary.push(`${indent}  Content Part ${nestedIndex + 1}:`);
						processContent(nestedPart, depth + 2);
					});
					return;
				}

				// Process text content
				if ('text' in part && typeof part.text === 'string') {
					const hasFileContent = this.hasFileMetadata(part.text);
					const hasFileNote = part.text.startsWith('Note: File') &&
						part.text.includes('content is up-to-date from turn');

					if (hasFileContent) {
						try {
							const metadataText = part.text.split(BB_RESOURCE_METADATA_DELIMITER)[1].trim();
							const metadata = JSON.parse(metadataText);
							summary.push(
								`${indent}File: ${metadata.path} (${metadata.type}) [revision: ${metadata.revision}]`,
							);
							summary.push(`${indent}Size: ${metadata.size} bytes`);
							summary.push(`${indent}Last Modified: ${metadata.last_modified}`);
							if (metadata.mime_type) {
								summary.push(`${indent}MIME Type: ${metadata.mime_type}`);
							}
						} catch (e) {
							summary.push(`${indent}Error parsing file metadata: ${errorMessage(e)}`);
						}
					} else if (hasFileNote) {
						const match = part.text.match(
							/Note: File (.*?) \(revision: (\w+)\) content is up-to-date from turn (\d+) \(revision: (\w+)\)/,
						);
						if (match) {
							summary.push(
								`${indent}File: ${match[1]} with revision ${match[2]} (current from turn ${
									match[3]
								} with revision ${match[4]})`,
							);
						}
					} else {
						summary.push(`${indent}No file metadata found`);
					}
				}

				// Check for cache_control
				// Only certain content types support cache_control (not thinking blocks)
				if (part && typeof part === 'object' && part.type !== 'thinking' && part.type !== 'redacted_thinking') {
					const hasCache = 'cache_control' in part;
					if (hasCache) {
						// Use a more specific type assertion
						const cacheControl = (part as AnthropicContentBlock).cache_control;
						summary.push(`${indent}Has cache_control: yes (${cacheControl?.type})`);
						if (!messagesWithCache.includes(index + 1)) {
							messagesWithCache.push(index + 1);
						}
					} else {
						summary.push(`${indent}Has cache_control: no`);
					}
				} else {
					summary.push(`${indent}Has cache_control: no (not supported for this content type)`);
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

	private asProviderMessageType(
		messages: LLMMessage[],
	): Anthropic.Messages.MessageParam[] {
		const usePromptCaching = this.projectConfig.api?.usePromptCaching ?? true;

		// Find the last three user messages
		const userMessages = messages
			.map((m, index) => ({ message: m, index }))
			.filter(({ message }) => message.role === 'user');

		// Get the last three user messages
		const lastThreeUserMessages = userMessages.slice(-3);
		const lastThreeIndices = new Set(lastThreeUserMessages.map((m) => m.index));

		const messagesTransformed = messages.map((m, index) => {
			const prevContent: AnthropicBlockParamOrArray = m.content as AnthropicBlockParamOrArray;
			let content: AnthropicBlockParamOrArray;

			// Add cache_control to the last content part of the last three user messages
			if (m.role === 'user' && usePromptCaching && lastThreeIndices.has(index)) {
				if (Array.isArray(prevContent)) {
					content = [...prevContent];
					const lastBlock = content[content.length - 1];
					// Only add cache_control to supported content types (not thinking blocks)
					if (lastBlock.type !== 'thinking' && lastBlock.type !== 'redacted_thinking') {
						content[content.length - 1] = { ...lastBlock, cache_control: { type: 'ephemeral' } };
					}
				} else if (typeof prevContent === 'string') {
					// For string content, we don't have existing citations, so use empty array
					content = [{
						type: 'text',
						text: prevContent,
						cache_control: { type: 'ephemeral' },
						citations: [],
					}];
				} else {
					// Only add cache_control to supported content types (not thinking blocks)
					if (prevContent.type !== 'thinking' && prevContent.type !== 'redacted_thinking') {
						content = [{ ...prevContent, cache_control: { type: 'ephemeral' } }];
					} else {
						content = [{ ...prevContent }];
					}
				}
			} else {
				content =
					(Array.isArray(prevContent) ? prevContent : [prevContent]) as Anthropic.Messages.TextBlockParam[];
			}
			return {
				role: m.role,
				content: content,
			} as Anthropic.Messages.MessageParam;
		});

		// Extract PDF content from tool_result blocks and convert to data blocks
		const messagesWithExtractedPdfs = this.extractPdfContentFromMessages(messagesTransformed);

		return messagesWithExtractedPdfs;
	}

	private asProviderToolType(tools: LLMTool[]): Anthropic.Messages.Tool[] {
		//logger.debug(`LlmProvider[${this.llmProviderName}]: llms-anthropic-asProviderToolType`, tools);
		return tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: tool.inputSchema,
		} as Anthropic.Tool));
	}

	/**
	 * Extract PDF content from tool_result blocks and convert to 'document' type blocks
	 * Anthropic tool_result types don't support PDF, but 'document' types do
	 */
	private extractPdfContentFromMessages(
		messages: Array<Anthropic.MessageParam>,
	): Array<Anthropic.MessageParam> {
		return messages.map((message, msgIndex) => {
			if (!Array.isArray(message.content)) {
				return message;
			}

			const transformedContent: Array<Anthropic.Messages.ContentBlockParam> = [];
			const extractedPdfBlocks: Array<Anthropic.Messages.ContentBlockParam> = [];

			message.content.forEach((block, blockIndex) => {
				if (block.type === 'tool_result' && Array.isArray(block.content)) {
					// Process tool_result blocks that might contain PDF
					const cleanedToolContent: Array<
						Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
					> = [];
					let foundPdf = false;

					// Handle paired blocks: metadata block + content block
					for (let toolIndex = 0; toolIndex < block.content.length; toolIndex++) {
						const toolContentBlock = block.content[toolIndex];
						if (toolContentBlock.type === 'text') {
							const pdfCheck = this.isPdfContentType(toolContentBlock.text);
							// If this block has PDF metadata, check next block for PDF content
							if (pdfCheck.isPdf && pdfCheck.metadata) {
								logger.info(
									`LlmProvider[${this.llmProviderName}]: Found PDF metadata! File: ${pdfCheck.metadata.uri}, Size: ${pdfCheck.metadata.size} bytes`,
								);

								// Check if next block contains PDF content
								const nextBlock = block.content[toolIndex + 1];
								if (nextBlock && nextBlock.type === 'text' && this.isPdfContent(nextBlock.text)) {
									// Create cleaned text with metadata + note
									const note =
										`Note: PDF content has been extracted and moved to a separate document block for proper handling by the Anthropic API.`;
									const cleanedText = toolContentBlock.text + '\n' + note;

									// Add metadata context as text block
									extractedPdfBlocks.push({
										type: 'text',
										text: `PDF Document: ${
											pdfCheck.metadata.uri?.split('/').pop() || 'document.pdf'
										} (${pdfCheck.metadata.size} bytes, modified: ${pdfCheck.metadata.last_modified})`,
									});

									// Create a 'document' type block for the PDF
									extractedPdfBlocks.push({
										type: 'document',
										source: {
											type: 'base64',
											media_type: 'application/pdf',
											data: nextBlock.text,
										},
									} as any);

									// Add metadata and note to the tool_result indicating PDF was moved
									cleanedToolContent.push({
										type: 'text',
										text: cleanedText,
									});

									// Skip the next block since we've processed it as PDF content
									toolIndex++; // Skip the content block
									foundPdf = true;
								} else {
									// No paired PDF content found, keep metadata as-is
									logger.info(
										`LlmProvider[${this.llmProviderName}]: PDF metadata found but no paired content block`,
									);
									cleanedToolContent.push(toolContentBlock as Anthropic.Messages.TextBlockParam);
								}
							} else {
								// Keep non-PDF text content as-is
								cleanedToolContent.push(toolContentBlock as Anthropic.Messages.TextBlockParam);
							}
						} else if (toolContentBlock.type === 'image') {
							// Keep image content as-is
							cleanedToolContent.push(toolContentBlock as Anthropic.Messages.ImageBlockParam);
						}
						// Skip other content types that aren't supported in tool_result content
					}

					// Add the cleaned tool_result block
					transformedContent.push({
						...block,
						content: cleanedToolContent,
					});
				} else {
					// Keep non-tool_result blocks as-is
					transformedContent.push(block);
				}
			});

			// Add extracted PDF blocks after the transformed content
			if (extractedPdfBlocks.length > 0) {
				logger.info(
					`LlmProvider[${this.llmProviderName}]: Adding ${extractedPdfBlocks.length} extracted PDF blocks to message ${
						msgIndex + 1
					}`,
				);
			}
			transformedContent.push(...extractedPdfBlocks);

			return {
				...message,
				content: transformedContent,
			};
		});
	}

	/**
	 * Check if text content contains metadata with application/pdf content-type
	 */
	private isPdfContentType(text: string): { isPdf: boolean; metadata?: any } {
		// Look for bb-resource-metadata blocks using the correct delimiter
		// Matches JSON block after metadata marker: captures from opening { to closing },
		// handling one level of nested objects with [^{}]|{[^}]*} pattern
		const metadataMatch = text.match(
			new RegExp(`${BB_RESOURCE_METADATA_DELIMITER}\\s*\\n((?:{(?:[^{}]|{[^}]*})*})+)`),
		);
		if (!metadataMatch) {
			return { isPdf: false };
		}

		try {
			const metadata = JSON.parse(metadataMatch[1]);
			if (metadata.mime_type === 'application/pdf') {
				return { isPdf: true, metadata };
			}
		} catch (error) {
			logger.error(`LlmProvider[${this.llmProviderName}]: Failed to parse metadata:`, error);
		}

		return { isPdf: false };
	}

	/**
	 * Check if text content contains PDF data
	 */
	private isPdfContent(pdfContent: string): boolean {
		// CHECK: Is content base64 encoded?
		const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(pdfContent.slice(0, 100));

		// Verify PDF signature
		if (isBase64) {
			// Verify PDF signature by checking the first 4 bytes match '%PDF' (0x25504446)
			// More reliable than string conversion since we're working with binary data
			// and handles potential encoding issues with base64 decoded content
			const pdfContentDecoded = decodeBase64(pdfContent);
			const pdfSignature = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // '%PDF'

			// Using every() to iterate through our 4-byte signature array and compare each byte
			// against the corresponding position in the decoded content - this only checks the
			// start of the file (bytes 0-3), not scanning the entire array
			const isPdfSignature = pdfContentDecoded.length >= 4 &&
				pdfSignature.every((byte, index) => pdfContentDecoded[index] === byte);

			if (isPdfSignature) {
				logger.info(`LlmProvider[${this.llmProviderName}]: PDF signature verified`);
				return true;
			} else {
				logger.warn(`LlmProvider[${this.llmProviderName}]: No PDF signature found in content block`);
				return false;
			}
		} else {
			logger.warn(`LlmProvider[${this.llmProviderName}]: PDF is not base64 encoded`);
			return false;
		}
	}

	//// deno-lint-ignore require-await
	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<Anthropic.Beta.Messages.MessageCreateParams> {
		//logger.debug(`LlmProvider[${this.llmProviderName}]: llms-anthropic-asProviderMessageRequest-messageRequest.system`, messageRequest.system);
		//logger.debug(`LlmProvider[${this.llmProviderName}]: llms-anthropic-asProviderMessageRequest-messageRequest`, messageRequest);
		const usePromptCaching = this.projectConfig.api?.usePromptCaching ?? true;
		const system = messageRequest.system
			? [
				{
					type: 'text',
					text: messageRequest.system,
					...(usePromptCaching ? { cache_control: { type: 'ephemeral' } } : {}),
				} as Anthropic.Messages.TextBlockParam,
			]
			: '';

		//logger.debug(`LlmProvider[${this.llmProviderName}]: llms-anthropic-asProviderMessageRequest-tools`, interaction.allTools());
		const tools = this.asProviderToolType(messageRequest.tools);
		// system cache_control also includes tools
		//if (tools.length > 0 && usePromptCaching) {
		//	tools[tools.length - 1].cache_control = { type: 'ephemeral' };
		//}

		const messages = this.asProviderMessageType(messageRequest.messages);
		// Log detailed message information
		if (this.projectConfig.api?.logFileHydration ?? false) this.logMessageDetails(messages);

		const model: string = messageRequest.model || AnthropicModel.CLAUDE_4_0_SONNET;

		// Resolve parameters using model capabilities
		let temperature: number;
		let maxTokens: number;
		let extendedThinking: boolean;
		if (interaction) {
			const resolved = await interaction.resolveModelParameters(
				messageRequest.model || AnthropicModel.CLAUDE_4_0_SONNET,
				{
					maxTokens: messageRequest.maxTokens,
					temperature: messageRequest.temperature,
					extendedThinking: messageRequest.extendedThinking?.enabled,
				},
				LLMProvider.ANTHROPIC,
			);

			maxTokens = resolved.maxTokens;
			extendedThinking = resolved.extendedThinking;
			// Resolve temperature, but prioritize explicitly setting to 1 for extended thinking
			temperature = extendedThinking ? 1 : resolved.temperature;
		} else {
			// Fallback if interaction is not provided
			const projectEditor = await this.invoke(LLMCallbackType.PROJECT_EDITOR);
			const registryService = await ModelRegistryService.getInstance(projectEditor.projectConfig);

			maxTokens = registryService.resolveMaxTokens(
				model,
				messageRequest.maxTokens,
			);

			extendedThinking = registryService.resolveExtendedThinking(
				model,
				messageRequest.extendedThinking?.enabled,
			);

			// Resolve temperature, but prioritize explicitly setting to 1 for extended thinking
			temperature = extendedThinking ? 1 : registryService.resolveTemperature(
				model,
				messageRequest.temperature,
			);
		}

		const providerMessageRequest: Anthropic.Beta.Messages.MessageCreateParams = {
			messages,
			system,
			tools,
			model,
			max_tokens: maxTokens,
			temperature,
			betas: [
				'context-1m-2025-08-07',
				'output-128k-2025-02-19',
				'token-efficient-tools-2025-02-19',
				'interleaved-thinking-2025-05-14',
			],
			//stream: false,

			// Add extended thinking support if enabled in the request
			...(extendedThinking
				? {
					thinking: {
						type: 'enabled',
						budget_tokens: messageRequest.extendedThinking?.budgetTokens || 4000,
					},
				}
				: {}),
		};
		logger.info(`LlmProvider[${this.llmProviderName}]: llms-anthropic-asProviderMessageRequest`, {
			maxTokens,
			model,
			usePromptCaching,
		});
		//logger.info(`LlmProvider[${this.llmProviderName}]: llms-anthropic-asProviderMessageRequest`, JSON.stringify(providerMessageRequest.messages));
		//logger.info(`LlmProvider[${this.llmProviderName}]: llms-anthropic-asProviderMessageRequest`, providerMessageRequest);
		//logger.dir(providerMessageRequest);

		return providerMessageRequest;
	}

	/**
	 * Run Anthropic service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from Anthropic or an error
	 */
	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			//logger.dir(messageRequest);

			const providerMessageRequest: Anthropic.Beta.Messages.MessageCreateParams = await this
				.asProviderMessageRequest(
					messageRequest,
					interaction,
				);

			// https://github.com/anthropics/anthropic-sdk-typescript/blob/6886b29e0a550d28aa082670381a4bb92101099c/src/resources/beta/prompt-caching/prompt-caching.ts
			//const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(

			//const anthropicMessage = (await anthropicMessageStream.finalMessage()) as Anthropic.Messages.Message;
			let anthropicMessageStream;
			let anthropicResponse;
			let anthropicMessage: Anthropic.Messages.Message | undefined;
			try {
				const streamResponse = await this.anthropic.beta.messages
					.stream(
						providerMessageRequest,
						{
							headers: {
								'anthropic-beta':
									'context-1m-2025-08-07,output-128k-2025-02-19,token-efficient-tools-2025-02-19,interleaved-thinking-2025-05-14',
							},
						},
					).withResponse();
				anthropicMessageStream = streamResponse.data;
				anthropicResponse = streamResponse.response;
				// Add nested try/catch specifically for the finalMessage operation
				anthropicMessage = (await anthropicMessageStream.finalMessage()) as Anthropic.Messages.Message;
			} catch (streamError) {
				logger.error(`LlmProvider[${this.llmProviderName}]: Error in stream processing`, streamError);
				throw createError(
					ErrorType.LLM,
					`Invalid request sent to LLM`,
					{
						model: messageRequest.model,
						provider: this.llmProviderName,
						args: {
							status: anthropicResponse?.status || 400,
							reason: errorMessage(streamError),
						},
					} as LLMErrorOptions,
				);
			}
			//const anthropicMessage = anthropicMessageStream as Anthropic.Messages.Message;
			//logger.info(`LlmProvider[${this.llmProviderName}]: llms-anthropic-anthropicMessage`, anthropicMessage);
			//logger.info(`LlmProvider[${this.llmProviderName}]: llms-anthropic-anthropicResponse`, anthropicResponse);

			if (this.projectConfig.api?.logLevel === 'debug1') {
				interaction.interactionPersistence.writeLLMRequest({
					messageId: anthropicMessage.id,
					requestBody: messageRequest,
					requestHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15' },
					responseMessage: anthropicMessage,
					response: anthropicResponse,
				});
			}

			// Validate essential response properties
			if (!anthropicMessage || !anthropicMessage.content) {
				logger.error(
					`LlmProvider[${this.llmProviderName}]: Invalid Anthropic response - missing message or content:`,
					{
						anthropicMessage,
					},
				);
				throw createError(
					ErrorType.LLM,
					'Invalid response from Anthropic API: missing required properties',
					{ provider: this.llmProviderName, model: messageRequest.model } as LLMErrorOptions,
				);
			}

			// Validate and normalize content to ensure it's a non-empty array
			if (!Array.isArray(anthropicMessage.content)) {
				logger.error(
					`LlmProvider[${this.llmProviderName}]: !!!!! CRITICAL ERROR !!!!! Anthropic response content is not an array:`,
					{
						content: anthropicMessage.content,
					},
				);
				// Convert to array if possible, or create error message
				if (anthropicMessage.content && typeof anthropicMessage.content === 'object') {
					anthropicMessage.content = [anthropicMessage.content];
				} else if (typeof anthropicMessage.content === 'string') {
					// For string content from Anthropic, we don't have existing citations
					// String content doesn't have citations, so use empty array
					anthropicMessage.content = [{ type: 'text', text: anthropicMessage.content, citations: [] }];
				} else {
					anthropicMessage.content = [{
						type: 'text',
						text: 'Error: Invalid response format from LLM',
						citations: [],
					}];
				}
			}

			// Ensure content array is not empty
			if (anthropicMessage.content.length === 0) {
				logger.error(
					`LlmProvider[${this.llmProviderName}]: !!!!! CRITICAL ERROR !!!!! Anthropic response content array is empty`,
				);
				anthropicMessage.content = [{ type: 'text', text: 'Error: Empty response from LLM', citations: [] }];
			}

			const headers = anthropicResponse?.headers;

			//const requestId = headers.get('request-id');

			const requestsRemaining = Number(headers?.get('anthropic-ratelimit-requests-remaining') || 0);
			const requestsLimit = Number(headers?.get('anthropic-ratelimit-requests-limit') || 0);
			const requestsResetDate = new Date(headers?.get('anthropic-ratelimit-requests-reset') || '');

			const tokensRemaining = Number(headers?.get('anthropic-ratelimit-tokens-remaining') || 0);
			const tokensLimit = Number(headers?.get('anthropic-ratelimit-tokens-limit') || 0);
			const tokensResetDate = new Date(headers?.get('anthropic-ratelimit-tokens-reset') || '');

			//logger.debug(`LlmProvider[${this.llmProviderName}]: Creating message response from Anthropic message:`, {
			//	messageType: anthropicMessage.type,
			//	role: anthropicMessage.role,
			//	contentLength: anthropicMessage.content.length,
			//});
			if (anthropicResponse.status !== 200) {
				logger.info(`LlmProvider[${this.llmProviderName}]: Non-200 response:`, { headers });
			}

			const messageResponse: LLMProviderMessageResponse = {
				id: anthropicMessage.id,
				type: anthropicMessage.type,
				role: anthropicMessage.role,
				model: anthropicMessage.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: anthropicMessage.content as LLMMessageContentParts,
				answer: extractTextFromContent(anthropicMessage.content as LLMMessageContentParts), // answer will get overridden in baseLLM - but this keeps type checking happy
				isTool: anthropicMessage.stop_reason === 'tool_use',
				messageStop: {
					stopReason: anthropicMessage.stop_reason as LLMMessageStop['stopReason'],
					stopSequence: anthropicMessage.stop_sequence as LLMMessageStop['stopSequence'],
				},
				usage: {
					inputTokens: anthropicMessage.usage.input_tokens,
					outputTokens: anthropicMessage.usage.output_tokens,
					totalTokens: (anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens),
					cacheCreationInputTokens: anthropicMessage.usage.cache_creation_input_tokens || 0,
					cacheReadInputTokens: anthropicMessage.usage.cache_read_input_tokens || 0,
					thoughtTokens: 0,
					totalAllTokens: (anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens +
						(anthropicMessage.usage.cache_creation_input_tokens || 0) +
						(anthropicMessage.usage.cache_read_input_tokens || 0)),
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
					statusCode: anthropicResponse.status,
					statusText: anthropicResponse.statusText,
				},
			};
			logger.debug(`LlmProvider[${this.llmProviderName}]: Created message response:`, {
				id: messageResponse.id,
				type: messageResponse.type,
				contentLength: messageResponse.answerContent.length,
			});
			//logger.debug(`LlmProvider[${this.llmProviderName}]: llms-anthropic-messageResponse`, messageResponse);

			// Include request parameters in messageMeta
			const llmRequestParams: LLMRequestParams = {
				modelConfig: {
					model: messageRequest.model,
					maxTokens: providerMessageRequest.max_tokens!,
					temperature: providerMessageRequest.temperature!,
					extendedThinking: messageRequest.extendedThinking,
					usePromptCaching: this.projectConfig.api?.usePromptCaching ?? true,
				},
			};

			return {
				messageResponse,
				messageMeta: {
					system: messageRequest.system,
					llmRequestParams,
				},
			};
		} catch (err) {
			logger.error(`LlmProvider[${this.llmProviderName}]: Error calling Anthropic API`, err);
			throw createError(
				ErrorType.LLM,
				`Could not get response from Anthropic API: ${errorMessage(err)}`,
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
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema. Ensure you are using arrays and objects instead of JSON strings.",
					true,
				);
			} else {
				logger.warn(
					`LlmProvider[${this.llmProviderName}]: modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
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

	protected override checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		// Check if the response has a stop reason
		if (llmProviderMessageResponse.messageStop.stopReason) {
			// Perform special handling based on the stop reason
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'max_tokens':
					logger.warn(
						`LlmProvider[${this.llmProviderName}]: Response reached the maximum token limit`,
					);

					break;
				case 'end_turn':
					logger.warn(`LlmProvider[${this.llmProviderName}]: Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`LlmProvider[${this.llmProviderName}]: Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`LlmProvider[${this.llmProviderName}]: Response is using a tool`);
					break;
				case 'refusal':
					logger.warn(
						`LlmProvider[${this.llmProviderName}]: Response has refused to continue for safety reasons`,
					);
					break;
				default:
					logger.info(
						`LlmProvider[${this.llmProviderName}]: Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default AnthropicLLM;
