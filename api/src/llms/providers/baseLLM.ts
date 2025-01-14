import Ajv from 'ajv';
import md5 from 'md5';

import { LLMCallbackType, LLMProvider as LLMProviderEnum } from 'api/types.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
	LLMTokenUsage,
	LLMValidateResponseCallback,
} from 'api/types.ts';
import type { LLMMessageContentPart } from 'api/llms/llmMessage.ts';
//import LLMTool from '../llmTool.ts';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import { logger } from 'shared/logger.ts';
import { extractTextFromContent, extractToolUseFromContent } from 'api/utils/llms.ts';
import type { ProjectConfig } from 'shared/config/v2/types.ts';
import { ErrorType, isLLMError, type LLMErrorOptions } from 'api/errors/error.ts';
import { createError } from 'api/utils/error.ts';
//import { metricsService } from '../../services/metrics.service.ts';
import { KVManager } from 'api/utils/kvManager.ts';
import { tokenUsageManager } from '../../utils/tokenUsage.utils.ts';

const ajv = new Ajv();
logger.info(`LLM: Creating storage for llmCache`);
const storage = await new KVManager<LLMSpeakWithResponse>({ prefix: 'llmCache' }).init();

class LLM {
	public llmProviderName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC;
	public maxSpeakRetries: number = 3;
	public requestCacheExpiry: number = 3 * (1000 * 60 * 60 * 24); // 3 days in milliseconds
	private callbacks: LLMCallbacks;
	public projectConfig!: ProjectConfig;

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

	async prepareMessageParams(
		_interaction: LLMInteraction,
		_speakOptions?: LLMSpeakWithOptions,
	): Promise<object> {
		throw new Error("Method 'prepareMessageParams' must be implemented.");
	}

	async speakWith(
		_messageParams: LLMProviderMessageRequest,
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

	protected createRequestCacheKey(
		messageParams: LLMProviderMessageRequest,
	): string[] {
		const cacheKey = ['messageRequest', this.llmProviderName, md5(JSON.stringify(messageParams))];
		logger.info(`provider[${this.llmProviderName}] using cache key: ${cacheKey}`);
		return cacheKey;
	}

	public async speakWithPlus(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		//const start = Date.now();

		const llmProviderMessageRequest = await this.prepareMessageParams(
			interaction,
			speakOptions,
		) as LLMProviderMessageRequest;

		let llmSpeakWithResponse!: LLMSpeakWithResponse;

		const cacheKey = !(this.projectConfig.settings.api?.ignoreLLMRequestCache ?? false)
			? this.createRequestCacheKey(llmProviderMessageRequest)
			: [];
		if (!(this.projectConfig.settings.api?.ignoreLLMRequestCache ?? false)) {
			logger.info(`provider[${this.llmProviderName}] speakWithPlus: Caching response`);
			const cachedResponse = await await storage.getItem(cacheKey);

			if (cachedResponse) {
				logger.info(`provider[${this.llmProviderName}] speakWithPlus: Using cached response`);
				llmSpeakWithResponse = cachedResponse;
				llmSpeakWithResponse.messageResponse.fromCache = true;
				//await metricsService.recordCacheMetrics({ operation: 'hit' });
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
					llmSpeakWithResponse = await this.speakWith(llmProviderMessageRequest, interaction);

					const statusCode = llmSpeakWithResponse.messageResponse.providerMessageResponseMeta.statusCode;

					if (statusCode >= 200 && statusCode < 300) {
						break; // Successful response, break out of the retry loop
					} else if (statusCode === 413) {
						logger.warn(`Request is too large.`);
						throw createError(
							ErrorType.LLM,
							`Error calling LLM service: ${llmSpeakWithResponse.messageResponse.providerMessageResponseMeta.statusText || 'Request is too large'}`,
							{
								model: interaction.model,
								provider: this.llmProviderName,
								args: { status: statusCode },
								conversationId: interaction.id,
							} as LLMErrorOptions,
						);
					} else if (statusCode === 429) {
						// Rate limit exceeded
						const rateLimit = llmSpeakWithResponse.messageResponse.rateLimit.requestsResetDate.getTime() -
							Date.now();
						const waitTime = Math.max(rateLimit, delay);
						logger.warn(`Rate limit exceeded. Waiting for ${waitTime}ms before retrying.`);
						await new Promise((resolve) => setTimeout(resolve, waitTime));
					} else if (statusCode >= 500) {
						// Server error, use exponential backoff
						logger.warn(`Server error (${statusCode}). Retrying in ${delay}ms.`);
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
					const args = isLLMError(error) ? error.args : {};
					throw createError(
						ErrorType.LLM,
						`Unexpected error calling LLM service: ${(error as Error).message}`,
						{
							model: interaction.model,
							provider: this.llmProviderName,
							args: { ...args, reason: (error as Error) },
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
						args: { retries: maxRetries },
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
			//await this.updateTokenUsage(llmSpeakWithResponse.messageResponse.usage);

			if (llmSpeakWithResponse.messageResponse.isTool) {
				llmSpeakWithResponse.messageResponse.toolsUsed = llmSpeakWithResponse.messageResponse.toolsUsed || [];
				this.extractToolUse(llmSpeakWithResponse.messageResponse);
				llmSpeakWithResponse.messageResponse.answer = llmSpeakWithResponse.messageResponse.toolsUsed.map(
					(toolUse) => toolUse.toolThinking,
				).join('\n');
			} else {
				// Add logging and robust error handling for response processing
				logger.info(`provider[${this.llmProviderName}] Processing non-tool response`);

				if (!llmSpeakWithResponse.messageResponse.answerContent) {
					logger.error(`provider[${this.llmProviderName}] answerContent is missing in response`);
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
							`provider[${this.llmProviderName}] Extracted combined text answer:`,
							combinedAnswer.substring(0, 100) + '...',
						);
					} else if (toolUseAnswer) {
						llmSpeakWithResponse.messageResponse.answer = 'Extracted tool use';
						logger.info(
							`provider[${this.llmProviderName}] Extracted tool use answer:`,
							toolUseAnswer.substring(0, 100) + '...',
						);
					} else {
						logger.info(
							`provider[${this.llmProviderName}] No valid text content found: `,
							llmSpeakWithResponse.messageResponse.answerContent,
						);
						llmSpeakWithResponse.messageResponse.answer =
							'Error: No valid text content found in LLM response';
						llmSpeakWithResponse.messageResponse.answerContent = [{
							type: 'text',
							text: llmSpeakWithResponse.messageResponse.answer,
						}];
						logger.warn(
							`provider[${this.llmProviderName}] No valid text content found in any answer parts`,
						);
					}
				} catch (error) {
					logger.error(
						`provider[${this.llmProviderName}] Error processing answer content: ${
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

			if (!this.projectConfig.settings.api?.ignoreLLMRequestCache) {
				await storage.setItem(cacheKey, llmSpeakWithResponse, { expireIn: this.requestCacheExpiry });
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
		let totalProviderRequests = 0;
		let llmSpeakWithResponse: LLMSpeakWithResponse | null = null;

		while (retries < maxRetries) {
			retries++;
			totalProviderRequests++;
			try {
				llmSpeakWithResponse = await this.speakWithPlus(interaction, retrySpeakOptions);
				//logger.debug(`provider[${this.llmProviderName}] speakWithRetry-llmSpeakWithResponse`, llmSpeakWithResponse );

				interaction.updateTotals(llmSpeakWithResponse.messageResponse);

				const validationFailedReason = this.validateResponse(
					llmSpeakWithResponse.messageResponse,
					interaction,
					retrySpeakOptions.validateResponseCallback,
				);
				//logger.debug(`speakWithRetry - validation response: ${validationFailedReason}`);

				if (validationFailedReason === null) {
					break; // Success, break out of the loop
				}

				this.modifySpeakWithInteractionOptions(interaction, retrySpeakOptions, validationFailedReason);

				failReason = `validation: ${validationFailedReason}`;
			} catch (error) {
				logger.error(
					`provider[${this.llmProviderName}] speakWithRetry: Error calling speakWithPlus`,
					error as Error,
				);
				failReason = `caught error: ${(error as Error)}`;
			}
			logger.warn(
				`provider[${this.llmProviderName}] Request to ${this.llmProviderName} failed. Retrying (${retries}/${maxRetries}) - ${failReason}`,
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		//await interaction.save(); // Persist the interaction even if all retries failed

		if (llmSpeakWithResponse) {
			return llmSpeakWithResponse;
		}

		logger.error(
			`provider[${this.llmProviderName}] Max retries reached. Request to ${this.llmProviderName} failed.`,
		);
		throw createError(
			ErrorType.LLM,
			'Request failed after multiple retries.',
			{
				model: interaction.model,
				provider: this.llmProviderName,
				args: { reason: failReason, retries: { max: maxRetries, current: retries } },
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
				//logger.error(`validateResponse - Validating Tool: ${toolUse.toolName}`);
				if (tool) {
					if (llmProviderMessageResponse.messageStop.stopReason === 'max_tokens') {
						logger.error(`Tool input exceeded max tokens`);
						return `Tool exceeded max tokens`;
					}

					const inputSchema: LLMToolInputSchema = tool.inputSchema;
					const validate = ajv.compile(inputSchema);
					const valid = validate(toolUse.toolInput);
					//logger.error(`validateResponse - Tool is valid: ${toolUse.toolName}`);
					toolUse.toolValidation.validated = true;
					if (!valid) {
						const validationErrors = ajv.errorsText(validate.errors);
						toolUse.toolValidation.results = `validation failed: ${validationErrors}`;
						logger.error(`Tool input validation failed: ${validationErrors}`);
						return `Tool input validation failed: ${validationErrors}`;
					}
				} else {
					logger.error(`Tool not found: ${toolUse.toolName}`);
					return `Tool not found: ${toolUse.toolName}`;
				}
			}
		}

		if (validateCallback) {
			const validationFailed = validateCallback(llmProviderMessageResponse, interaction);
			if (validationFailed) {
				logger.error(`Callback validation failed: ${validationFailed}`);
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
				llmProviderMessageResponse.toolsUsed!.push({
					toolInput: answerPart.input,
					toolUseId: answerPart.id,
					toolName: answerPart.name,
					toolThinking: currentToolThinking,
					toolValidation: { validated: false, results: '' },
				});
				currentToolThinking = '';
			}

			// if the last/final content part is type text, then add to toolThinking of last tool in toolsUsed
			if (index === llmProviderMessageResponse.answerContent.length - 1 && answerPart.type === 'text') {
				llmProviderMessageResponse.toolsUsed![llmProviderMessageResponse.toolsUsed!.length - 1].toolThinking +=
					answerPart.text;
			}
		});
	}

	// [TODO] remove or properly implement token and request tracking
	// currently just being used to record usage for most recent turn, overwriting last turn
	// tokensRemaining and requestsRemaining get extracted from LLM response headers
	// but not propagated via usage (only via ratelimit)
	// This is likely a deprecated usage since llm-proxy handles proper tracking and
	// localMode doesn't need to enforce usage tracking
	private async updateTokenUsage(usage: LLMTokenUsage): Promise<void> {
		const currentUsage = await tokenUsageManager.getTokenUsage(this.llmProviderName);
		logger.info(
			`provider[${this.llmProviderName}] speakWithPlus: Checking token usage for: ${this.llmProviderName}`,
			//currentUsage,
		);
		if (currentUsage) {
			const updatedUsage = {
				...currentUsage,
				requestsRemaining: currentUsage.requestsRemaining - 1,
				tokensRemaining: currentUsage.tokensRemaining - usage.totalTokens,
			};
			//logger.info(
			//	`provider[${this.llmProviderName}] speakWithPlus: Updating token usage for: ${this.llmProviderName}`,
			//	updatedUsage,
			//);
			await tokenUsageManager.updateTokenUsage(this.llmProviderName, updatedUsage);
		} else {
			//logger.info(
			//	`provider[${this.llmProviderName}] speakWithPlus: Setting token usage for: ${this.llmProviderName}`,
			//	usage,
			//);
			await tokenUsageManager.updateTokenUsage(this.llmProviderName, usage);
		}
	}
}

export default LLM;
