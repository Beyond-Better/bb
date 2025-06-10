import Ajv from 'ajv';
import md5 from 'md5';

//import { LLMCallbackType, LLMProvider as LLMProviderEnum } from 'api/types.ts';
import { LLMCallbackType, LLMProvider } from 'api/types.ts';
import type {
	LLMCallbacks,
	LLMExtendedThinkingOptions,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMRateLimit,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
	//LLMTokenUsage,
	LLMValidateResponseCallback,
} from 'api/types.ts';
import type { LLMMessageContentPart } from 'api/llms/llmMessage.ts';
//import LLMTool from '../llmTool.ts';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import { logger } from 'shared/logger.ts';
import { extractTextFromContent, extractToolUseFromContent } from 'api/utils/llms.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import { ErrorType, isLLMError, type LLMErrorOptions } from 'api/errors/error.ts';
import { createError } from 'api/utils/error.ts';
//import { metricsService } from '../../services/metrics.service.ts';
import { KVManager } from 'api/utils/kvManager.ts';
import { rateLimitManager } from '../../utils/rateLimit.utils.ts';

const ajv = new Ajv();
//logger.debug(`BaseLLM:provider[${this.llmProviderName}]: Creating storage for llmCache`);
const storage = await new KVManager<LLMSpeakWithResponse | CompressedCacheItem>({ prefix: 'llmCache' }).init();

// Size threshold for compression (in bytes)
const COMPRESSION_THRESHOLD = 30000; // ~30KB

// Maximum size for KV storage (in bytes)
const KV_MAX_SIZE = 65000; // Just under the 65536 limit

// Interface for compressed cache items
interface CompressedCacheItem {
	compressed: true;
	data: Uint8Array;
}

class LLM {
	public llmProviderName: LLMProvider = LLMProvider.ANTHROPIC;
	public maxSpeakRetries: number = 3;
	public requestCacheExpiry: number = 3 * (1000 * 60 * 60 * 24); // 3 days in milliseconds
	private callbacks: LLMCallbacks;
	public projectConfig!: ProjectConfig;

	// Getter for default model (used by instance inspector)
	protected get defaultModel(): string | undefined {
		return undefined; // Subclasses will override this
	}

	// Public accessor for instance inspector
	public getDefaultModel(): string | undefined {
		return this.defaultModel;
	}

	constructor(callbacks: LLMCallbacks) {
		this.callbacks = callbacks;
		this.projectConfig = this.invokeSync(LLMCallbackType.PROJECT_CONFIG);
	}

	async invoke<K extends LLMCallbackType>(
		event: K,
		...args: Parameters<LLMCallbacks[K]>
	): Promise<Awaited<ReturnType<LLMCallbacks[K]>>> {
		const result = this.callbacks[event](...args);
		return result instanceof Promise ? await result : result;
	}
	invokeSync<K extends LLMCallbackType>(
		event: K,
		...args: Parameters<LLMCallbacks[K]>
	): ReturnType<LLMCallbacks[K]> {
		const result = this.callbacks[event](...args);
		return result;
	}

	// deno-lint-ignore require-await
	async speakWith(
		_messageRequest: LLMProviderMessageRequest,
		_interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		throw new Error("Method 'speakWith' must be implemented.");
	}

	protected checkStopReason(_llmProviderMessageResponse: LLMProviderMessageResponse): void {
		throw new Error("Method 'checkStopReason' must be implemented.");
	}

	protected modifySpeakWithInteractionOptions(
		_interaction: LLMInteraction,
		_speakOptions: LLMSpeakWithOptions,
		_validationFailedReason: string,
	): void {
		// Default implementation, can be overridden by subclasses
	}

	// deno-lint-ignore require-await
	async asProviderMessageRequest(
		_messageRequest: LLMProviderMessageRequest,
		_interaction?: LLMInteraction,
	): Promise<object> {
		throw new Error("Method 'asProviderMessageRequest' must be implemented.");
	}

	async prepareMessageRequest(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageRequest> {
		//logger.debug(`BaseLLM:provider[${this.llmProviderName}]: prepareMessageRequest-systemPrompt`, interaction.baseSystem);

		const systemPrompt = await this.invoke(
			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
			speakOptions?.system || interaction.baseSystem,
			interaction.id,
		);
		const system = systemPrompt;

		//logger.debug(`BaseLLM:provider[${this.llmProviderName}]: prepareMessageRequest-tools`, interaction.allTools());
		const tools = await this.invoke(
			LLMCallbackType.PREPARE_TOOLS,
			speakOptions?.tools || interaction.allTools(),
			interaction.id,
		) || [];

		const messages = await this.invoke(
			LLMCallbackType.PREPARE_MESSAGES,
			speakOptions?.messages || interaction.getMessages(),
			interaction.id,
		) || [];

		const model: string = speakOptions?.model || interaction.model;

		if (!speakOptions?.maxTokens && !interaction.maxTokens) {
			logger.error(
				`BaseLLM:provider[${this.llmProviderName}]: maxTokens missing from both speakOptions and interaction`,
			);
		}
		if (!speakOptions?.temperature && !interaction.temperature) {
			logger.error(
				`BaseLLM:provider[${this.llmProviderName}]: temperature missing from both speakOptions and interaction`,
			);
		}

		const maxTokens: number = speakOptions?.maxTokens || interaction.maxTokens || 16384;
		const temperature: number = speakOptions?.temperature || interaction.temperature || 0.2;
		const extendedThinking: LLMExtendedThinkingOptions = speakOptions?.extendedThinking ||
			interaction.extendedThinking || { enabled: false, budgetTokens: 0 };

		const messageRequest: LLMProviderMessageRequest = {
			messages,
			system,
			tools,
			model,
			maxTokens,
			temperature,
			extendedThinking,
		};
		//logger.debug(`BaseLLM:provider[${this.llmProviderName}]: llms-prepareMessageRequest`, messageRequest);
		//logger.dir(messageRequest);

		return messageRequest;
	}

	protected createRequestCacheKey(
		messageRequest: LLMProviderMessageRequest,
	): string[] {
		const cacheKey = ['messageRequest', this.llmProviderName, md5(JSON.stringify(messageRequest))];
		logger.info(`BaseLLM:provider[${this.llmProviderName}]: using cache key: ${cacheKey}`);
		return cacheKey;
	}

	public async speakWithPlus(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		//const start = Date.now();

		const messageRequest = await this.prepareMessageRequest(
			interaction,
			speakOptions,
		) as LLMProviderMessageRequest;

		let llmSpeakWithResponse!: LLMSpeakWithResponse;

		const cacheKey = !(this.projectConfig.api?.ignoreLLMRequestCache ?? false)
			? this.createRequestCacheKey(messageRequest)
			: [];
		if (!(this.projectConfig.api?.ignoreLLMRequestCache ?? false)) {
			//logger.info(`BaseLLM:provider[${this.llmProviderName}]: speakWithPlus: Checking for cached response`);
			const cachedItem = await storage.getItem(cacheKey);

			if (cachedItem) {
				// Check if the cached item is compressed
				if ('compressed' in cachedItem && cachedItem.compressed === true) {
					try {
						// Decompress the data using DecompressionStream
						const stream = new DecompressionStream('gzip');

						// Create a readable stream from the compressed data
						const readableStream = new ReadableStream({
							start(controller) {
								controller.enqueue(cachedItem.data);
								controller.close();
							},
						});

						// Get decompressed data
						const decompressedData = await new Response(readableStream.pipeThrough(stream)).text();
						llmSpeakWithResponse = JSON.parse(decompressedData) as LLMSpeakWithResponse;
						logger.info(
							`BaseLLM:provider[${this.llmProviderName}]: speakWithPlus: Using decompressed cached response`,
						);
					} catch (error) {
						logger.error(
							`BaseLLM:provider[${this.llmProviderName}]: Failed to decompress cached response:`,
							error,
						);
						// Continue to generate a new response
					}
				} else {
					// Regular uncompressed response
					logger.info(`BaseLLM:provider[${this.llmProviderName}]: speakWithPlus: Using cached response`);
					llmSpeakWithResponse = cachedItem as LLMSpeakWithResponse;
				}
				if (llmSpeakWithResponse) {
					llmSpeakWithResponse.messageResponse.fromCache = true;
					//await metricsService.recordCacheMetrics({ operation: 'hit' });
				}
			} else {
				//await metricsService.recordCacheMetrics({ operation: 'miss' });
			}
		}

		if (!llmSpeakWithResponse) {
			const maxRetries = this.maxSpeakRetries;
			let retries = 0;
			let delay = 1000; // Start with a 1-second delay

			while (retries < maxRetries) {
				try {
					llmSpeakWithResponse = await this.speakWith(messageRequest, interaction);

					const statusCode = llmSpeakWithResponse.messageResponse.providerMessageResponseMeta.statusCode;

					if (statusCode >= 200 && statusCode < 300) {
						break; // Successful response, break out of the retry loop
					} else if (statusCode === 400) {
						logger.warn(`BaseLLM:provider[${this.llmProviderName}]: Request is invalid.`);
						throw createError(
							ErrorType.LLM,
							`Error calling LLM service: ${
								llmSpeakWithResponse.messageResponse.providerMessageResponseMeta.statusText ||
								'Request is invalid'
							}`,
							{
								model: interaction.model,
								provider: this.llmProviderName,
								args: { status: statusCode, reason: 'Request is invalid' },
								conversationId: interaction.id,
							} as LLMErrorOptions,
						);
					} else if (statusCode === 413) {
						logger.warn(`BaseLLM:provider[${this.llmProviderName}]: Request is too large.`);
						throw createError(
							ErrorType.LLM,
							`Error calling LLM service: ${
								llmSpeakWithResponse.messageResponse.providerMessageResponseMeta.statusText ||
								'Request is too large'
							}`,
							{
								model: interaction.model,
								provider: this.llmProviderName,
								args: { status: statusCode, reason: 'Request is too large' },
								conversationId: interaction.id,
							} as LLMErrorOptions,
						);
					} else if (statusCode === 429) {
						// Rate limit exceeded
						const rateLimit = llmSpeakWithResponse.messageResponse.rateLimit.requestsResetDate.getTime() -
							Date.now();
						const waitTime = Math.max(rateLimit, delay);
						logger.warn(
							`BaseLLM:provider[${this.llmProviderName}]: Rate limit exceeded. Waiting for ${waitTime}ms before retrying.`,
						);
						await new Promise((resolve) => setTimeout(resolve, waitTime));
					} else if (statusCode >= 500) {
						// Server error, use exponential backoff
						logger.warn(
							`BaseLLM:provider[${this.llmProviderName}]: Server error (${statusCode}). Retrying in ${delay}ms.`,
						);
						await new Promise((resolve) => setTimeout(resolve, delay));
						delay *= 2; // Double the delay for next time
					} else {
						// For other errors, throw and don't retry
						throw createError(
							ErrorType.LLM,
							`Error calling LLM service: ${llmSpeakWithResponse.messageResponse.providerMessageResponseMeta.statusText}`,
							{
								model: interaction.model,
								provider: this.llmProviderName,
								args: { status: statusCode },
								conversationId: interaction.id,
							} as LLMErrorOptions,
						);
					}

					retries++;
				} catch (error) {
					// Handle any unexpected errors
					const args = isLLMError(error) ? (error.options || {}) : {};
					logger.error(`BaseLLM:provider[${this.llmProviderName}]: Error calling LLM: `, { args, error });
					throw createError(
						ErrorType.LLM,
						`Unexpected error calling LLM service: ${(error as Error).message}`,
						{
							model: interaction.model,
							provider: this.llmProviderName,
							args: { ...args, reason: (error as Error).message },
							conversationId: interaction.id,
						} as LLMErrorOptions,
					);
				}
			}

			if (retries >= maxRetries) {
				throw createError(
					ErrorType.LLM,
					'Max retries reached when calling LLM service.',
					{
						model: interaction.model,
						provider: this.llmProviderName,
						args: {
							retries: { max: maxRetries, current: retries },
							reason: 'Max retries reached when calling LLM service',
						},
						conversationId: interaction.id,
					} as LLMErrorOptions,
				);
			}

			//const latency = Date.now() - start;
			//await metricsService.recordLLMMetrics({
			//	provider: this.llmProviderName,
			//	latency,
			//	tokenUsage: llmSpeakWithResponse.messageResponse.usage.totalTokens,
			//	error: llmSpeakWithResponse.messageResponse.type === 'error' ? 'LLM request failed' : undefined,
			//});

			// [TODO] remove or properly implement token and request tracking
			// currently just being used to record usage for most recent turn, overwriting last turn
			//await this.updateRateLimit(llmSpeakWithResponse.messageResponse.rateLimit);

			if (llmSpeakWithResponse.messageResponse.isTool) {
				llmSpeakWithResponse.messageResponse.toolsUsed = llmSpeakWithResponse.messageResponse.toolsUsed || [];
				this.extractToolUse(llmSpeakWithResponse.messageResponse);
				llmSpeakWithResponse.messageResponse.answer = llmSpeakWithResponse.messageResponse.toolsUsed.map(
					(toolUse) => toolUse.toolThinking,
				).join('\n');
			} else {
				// Add logging and robust error handling for response processing
				logger.info(`BaseLLM:provider[${this.llmProviderName}]: Processing non-tool response`);

				if (!llmSpeakWithResponse.messageResponse.answerContent) {
					logger.error(`BaseLLM:provider[${this.llmProviderName}]: answerContent is missing in response`);
					throw createError(
						ErrorType.LLM,
						'Invalid response format: answerContent is missing',
						{ provider: this.llmProviderName } as LLMErrorOptions,
					);
				}

				// Process all answer parts and combine text content
				try {
					const combinedAnswer = extractTextFromContent(llmSpeakWithResponse.messageResponse.answerContent);
					const toolUseAnswer = extractToolUseFromContent(llmSpeakWithResponse.messageResponse.answerContent);
					if (combinedAnswer) {
						llmSpeakWithResponse.messageResponse.answer = combinedAnswer;
						logger.info(
							`BaseLLM:provider[${this.llmProviderName}]: Extracted combined text answer:`,
							combinedAnswer.substring(0, 100) + '...',
						);
					} else if (toolUseAnswer) {
						llmSpeakWithResponse.messageResponse.answer = 'Extracted tool use';
						logger.info(
							`BaseLLM:provider[${this.llmProviderName}]: Extracted tool use answer:`,
							toolUseAnswer.substring(0, 100) + '...',
						);
					} else {
						logger.info(
							`BaseLLM:provider[${this.llmProviderName}]: No valid text content found: `,
							llmSpeakWithResponse.messageResponse.answerContent,
						);
						llmSpeakWithResponse.messageResponse.answer =
							'Error: No valid text content found in LLM response';
						llmSpeakWithResponse.messageResponse.answerContent = [{
							type: 'text',
							text: llmSpeakWithResponse.messageResponse.answer,
						}];
						logger.warn(
							`BaseLLM:provider[${this.llmProviderName}]: No valid text content found in any answer parts`,
						);
					}
				} catch (error) {
					logger.error(
						`BaseLLM:provider[${this.llmProviderName}]: Error processing answer content: ${
							(error as Error).message
						}`,
						error as Error,
					);
					llmSpeakWithResponse.messageResponse.answer = 'Error: Failed to process LLM response content';
					llmSpeakWithResponse.messageResponse.answerContent = [{
						type: 'text',
						text: llmSpeakWithResponse.messageResponse.answer,
					}];
				}
			}

			// Add the assistant's message
			interaction.addMessageForAssistantRole(
				llmSpeakWithResponse.messageResponse.answerContent,
				undefined,
				llmSpeakWithResponse.messageResponse,
			);

			llmSpeakWithResponse.messageResponse.fromCache = false;

			if (!this.projectConfig.api?.ignoreLLMRequestCache) {
				try {
					// Serialize the response
					const serialized = JSON.stringify(llmSpeakWithResponse);
					const serializedSize = new TextEncoder().encode(serialized).length;

					// Check if we need to compress based on size
					if (serializedSize > COMPRESSION_THRESHOLD) {
						logger.info(
							`BaseLLM:provider[${this.llmProviderName}]: Large response detected (${serializedSize} bytes), applying compression`,
						);

						// Compress the data using CompressionStream
						const encoder = new TextEncoder();
						const uint8Array = encoder.encode(serialized);

						// Create a compression stream
						const stream = new CompressionStream('gzip');

						// Create a readable stream from the uint8array and pipe through compression
						const readableStream = new ReadableStream({
							start(controller) {
								controller.enqueue(uint8Array);
								controller.close();
							},
						});

						// Collect compressed chunks
						const compressed = await new Response(readableStream.pipeThrough(stream)).arrayBuffer().then(
							(buffer) => new Uint8Array(buffer),
						);
						const compressedSize = compressed.byteLength;

						// Check if compressed data is still too large
						if (compressedSize > KV_MAX_SIZE) {
							logger.warn(
								`BaseLLM:provider[${this.llmProviderName}]: ⚠️ CACHING FAILURE: Response too large even after compression (${compressedSize} bytes)`,
							);
							logger.warn(
								`BaseLLM:provider[${this.llmProviderName}]: ⚠️ CACHING FAILURE: Original size: ${serializedSize} bytes, compressed size: ${compressedSize} bytes`,
							);
							logger.warn(
								`BaseLLM:provider[${this.llmProviderName}]: ⚠️ CACHING FAILURE: This response will not be cached and must be regenerated next time`,
							);
						} else {
							// Store the compressed data with a marker
							const compressedItem: CompressedCacheItem = {
								compressed: true,
								data: compressed,
							};
							await storage.setItem(cacheKey, compressedItem, { expireIn: this.requestCacheExpiry });
							logger.info(
								`BaseLLM:provider[${this.llmProviderName}]: Cached compressed response (${serializedSize} → ${compressedSize} bytes, ${
									Math.round((compressedSize / serializedSize) * 100)
								}%)`,
							);
						}
					} else {
						// Store uncompressed for small responses
						await storage.setItem(cacheKey, llmSpeakWithResponse, { expireIn: this.requestCacheExpiry });
						logger.info(
							`BaseLLM:provider[${this.llmProviderName}]: Cached uncompressed response (${serializedSize} bytes)`,
						);
					}
				} catch (error) {
					if (error instanceof TypeError && error.message.includes('Value too large')) {
						logger.error(
							`BaseLLM:provider[${this.llmProviderName}]: ⚠️ CACHING FAILURE: Maximum KV size exceeded when caching response`,
						);
						logger.error(
							`BaseLLM:provider[${this.llmProviderName}]: ⚠️ CACHING FAILURE: This response will not be cached and must be regenerated next time`,
						);
					} else {
						// Log but don't throw to prevent disrupting the main flow
						logger.error(`BaseLLM:provider[${this.llmProviderName}]: Error caching response:`, error);
					}
				}
				//await metricsService.recordCacheMetrics({ operation: 'set' });
			}
		}

		return llmSpeakWithResponse;
	}

	// called by
	//  - chatInteraction.chat
	//  - conversationInteraction.converse
	//  - conversationInteraction.relayToolResult
	public async speakWithRetry(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		const maxRetries = this.maxSpeakRetries;
		const retrySpeakOptions = { ...speakOptions };
		let retries = 0;
		let failReason = '';
		let failDetails: Record<string, unknown> | LLMErrorOptions | undefined = {};
		let totalProviderRequests = 0;
		let llmSpeakWithResponse: LLMSpeakWithResponse | null = null;

		while (retries < maxRetries) {
			retries++;
			totalProviderRequests++;
			try {
				llmSpeakWithResponse = await this.speakWithPlus(interaction, retrySpeakOptions);
				//logger.debug(`BaseLLM:provider[${this.llmProviderName}]: speakWithRetry-llmSpeakWithResponse`, llmSpeakWithResponse );

				interaction.updateTotals(llmSpeakWithResponse.messageResponse);

				const validationFailedReason = this.validateResponse(
					llmSpeakWithResponse.messageResponse,
					interaction,
					retrySpeakOptions.validateResponseCallback,
				);
				//logger.debug(`BaseLLM:provider[${this.llmProviderName}]: speakWithRetry - validation response: ${validationFailedReason}`);

				if (validationFailedReason === null) {
					break; // Success, break out of the loop
				} else if (validationFailedReason === 'fatal') {
					break; // Unrecoverable failure, break out of the loop
				}

				this.modifySpeakWithInteractionOptions(interaction, retrySpeakOptions, validationFailedReason);

				failReason = `validation: ${validationFailedReason}`;
			} catch (error) {
				logger.error(
					`BaseLLM:provider[${this.llmProviderName}]: speakWithRetry: Error calling speakWithPlus`,
					error as Error,
				);
				if (isLLMError(error)) {
					if (error.options?.args?.error?.type && error.options.args.error.type === 'quota_exceeded') {
						failReason = `Quota Exceeded: ${error.options.args.error.message}`;
						failDetails = error.options.args.error.details;
						break; // Unrecoverable error
					} else if (error.options?.args?.error) {
						failReason = `LLM error: ${error.options.args.error.message}`;
						failDetails = error.options.args.error.details;
					} else {
						failReason = `LLM error: ${error.message}`;
						failDetails = error.options;
					}
				} else {
					failReason = `caught error: ${(error as Error)}`;
				}
			}
			logger.warn(
				`BaseLLM:provider[${this.llmProviderName}]: Request to ${this.llmProviderName} failed. Retrying (${retries}/${maxRetries}) - ${failReason}`,
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		//await interaction.save(); // Persist the interaction even if all retries failed

		if (llmSpeakWithResponse) {
			return llmSpeakWithResponse;
		}

		logger.error(
			`BaseLLM:provider[${this.llmProviderName}]: Max retries reached. Request to ${this.llmProviderName} failed.`,
		);
		const errorMessage = retries > 1 ? `Request failed after multiple retries. ${failReason}` : `${failReason}`;
		throw createError(
			ErrorType.LLM,
			errorMessage,
			{
				model: interaction.model,
				provider: this.llmProviderName,
				args: { reason: failReason, retries: { max: maxRetries, current: retries }, ...failDetails },
				conversationId: interaction.id,
			} as LLMErrorOptions,
		);
	}

	protected validateResponse(
		llmProviderMessageResponse: LLMProviderMessageResponse,
		interaction: LLMInteraction,
		validateCallback?: LLMValidateResponseCallback,
	): string | null {
		if (
			llmProviderMessageResponse.isTool &&
			llmProviderMessageResponse.toolsUsed &&
			llmProviderMessageResponse.toolsUsed.length > 0
		) {
			for (const toolUse of llmProviderMessageResponse.toolsUsed) {
				const tool = interaction.getTool(toolUse.toolName ?? '');
				//logger.error(`BaseLLM:provider[${this.llmProviderName}]: validateResponse - Validating Tool: ${toolUse.toolName}`);
				if (tool) {
					if (llmProviderMessageResponse.messageStop.stopReason === 'max_tokens') {
						logger.error(`BaseLLM:provider[${this.llmProviderName}]: Tool input exceeded max tokens`);
						return `Tool exceeded max tokens`;
					}

					const inputSchema: LLMToolInputSchema = tool.inputSchema;
					const validate = ajv.compile(inputSchema);
					const valid = validate(toolUse.toolInput);
					//logger.error(`BaseLLM:provider[${this.llmProviderName}]: validateResponse - Tool is valid: ${toolUse.toolName}`);
					toolUse.toolValidation.validated = true;
					if (!valid) {
						const validationErrors = ajv.errorsText(validate.errors);
						toolUse.toolValidation.results = `validation failed: ${validationErrors}`;
						logger.error(
							`BaseLLM:provider[${this.llmProviderName}]: Tool input validation failed: ${validationErrors}`,
						);
						return `Tool input validation failed: ${validationErrors}`;
					}
				} else {
					logger.error(`BaseLLM:provider[${this.llmProviderName}]: Tool not found: ${toolUse.toolName}`);
					return `Tool not found: ${toolUse.toolName}`;
				}
			}
		}

		if (validateCallback) {
			const validationFailed = validateCallback(llmProviderMessageResponse, interaction);
			if (validationFailed) {
				logger.error(
					`BaseLLM:provider[${this.llmProviderName}]: Callback validation failed: ${validationFailed}`,
				);
				return validationFailed;
			}
		}

		return null;
	}

	protected extractToolUse(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		let currentToolThinking = '';

		llmProviderMessageResponse.answerContent.forEach((answerPart: LLMMessageContentPart, index: number) => {
			if (answerPart.type === 'text') {
				currentToolThinking += answerPart.text;
			} else if (answerPart.type === 'tool_use') {
				// Ensure toolsUsed array exists
				if (!llmProviderMessageResponse.toolsUsed) {
					llmProviderMessageResponse.toolsUsed = [];
				}
				llmProviderMessageResponse.toolsUsed!.push({
					toolInput: answerPart.input,
					toolUseId: answerPart.id,
					toolName: answerPart.name,
					toolThinking: currentToolThinking || '', // Ensure it's never undefined
					toolValidation: { validated: false, results: '' },
				});
				currentToolThinking = '';
			}

			// if the last/final content part is type text, then add to toolThinking of last tool in toolsUsed
			if (
				index === llmProviderMessageResponse.answerContent.length - 1 &&
				answerPart.type === 'text' &&
				llmProviderMessageResponse.toolsUsed &&
				llmProviderMessageResponse.toolsUsed.length > 0
			) {
				const lastTool =
					llmProviderMessageResponse.toolsUsed![llmProviderMessageResponse.toolsUsed!.length - 1];
				if (lastTool && typeof lastTool.toolThinking === 'string') {
					lastTool.toolThinking += answerPart.text;
				} else if (lastTool) {
					// Initialize toolThinking if it's somehow undefined
					lastTool.toolThinking = answerPart.text;
				}
			}
		});
	}

	// [TODO] remove or properly implement token and request tracking
	// currently just being used to record usage for most recent turn, overwriting last turn
	// tokensRemaining and requestsRemaining get extracted from LLM response headers
	// but not propagated via usage (only via ratelimit)
	// This is likely a deprecated usage since llm-proxy handles proper tracking and
	// localMode doesn't need to enforce usage tracking

	// deno-lint-ignore-zz no-unused-labels
	private async updateRateLimit(limits: LLMRateLimit): Promise<void> {
		const currentUsage = await rateLimitManager.getRateLimit(this.llmProviderName);
		logger.info(
			`BaseLLM:provider[${this.llmProviderName}]: speakWithPlus: Checking rate limits for: ${this.llmProviderName}`,
			//currentUsage,
		);
		if (currentUsage) {
			const updatedUsage = {
				...currentUsage,
				requestsRemaining: limits.requestsRemaining,
				tokensRemaining: limits.tokensRemaining,
			};
			//logger.info(
			//	`BaseLLM:provider[${this.llmProviderName}]: speakWithPlus: Updating rate limits for: ${this.llmProviderName}`,
			//	updatedUsage,
			//);
			await rateLimitManager.updateRateLimit(this.llmProviderName, updatedUsage);
		} else {
			//logger.info(
			//	`BaseLLM:provider[${this.llmProviderName}]: speakWithPlus: Setting rate limits for: ${this.llmProviderName}`,
			//	limits,
			//);
			await rateLimitManager.updateRateLimit(this.llmProviderName, limits);
		}
	}
}

export default LLM;
