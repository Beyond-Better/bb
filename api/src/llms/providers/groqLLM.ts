import Groq from 'groq-sdk';
import type { ClientOptions } from 'groq-sdk';

import { GroqModel, LLMCallbackType, LLMProvider } from 'api/types.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { createError, errorMessage } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithResponse,
} from 'api/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';

class GroqLLM extends LLM {
	private groq!: Groq;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.GROQ;

		this.initializeGroqClient();
	}

	private initializeGroqClient() {
		const clientOptions: ClientOptions = {
			apiKey: this.projectConfig.api?.llmProviders?.groq?.apiKey,
		};

		this.groq = new Groq(clientOptions);
	}

	private asProviderMessageType(
		messages: LLMMessage[],
	): Groq.Chat.ChatCompletionMessageParam[] {
		return messages.map((m) => {
			return {
				role: m.role,
				content: m.content
					.filter((part) => part.type === 'text')
					.map((part) => (part as LLMMessageContentPartTextBlock).text)
					.join(''),
			} as Groq.Chat.ChatCompletionMessageParam;
		});
	}

	private asProviderToolType(tools: LLMTool[]): Groq.Chat.ChatCompletionTool[] {
		return tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			},
		} as Groq.Chat.ChatCompletionTool));
	}

	private asApiMessageContentPartsType(message: Groq.Chat.ChatCompletionMessage): LLMMessageContentPart[] {
		const contentParts: LLMMessageContentParts = [];

		// Handle text content
		if (message.content) {
			logger.debug(`LlmProvider[${this.llmProviderName}]: Processing text content from response`);
			contentParts.push({
				type: 'text',
				text: message.content,
			} as LLMMessageContentPartTextBlock);
		}

		// Handle tool calls
		if (message.tool_calls) {
			message.tool_calls.forEach((toolCall) => {
				logger.debug(`LlmProvider[${this.llmProviderName}]: Processing tool call: ${toolCall.function.name}`);
				// Parse the arguments JSON string into an object
				let parsedInput: object;
				try {
					parsedInput = JSON.parse(toolCall.function.arguments);
				} catch (error) {
					logger.warn(`LlmProvider[${this.llmProviderName}]: Failed to parse tool arguments: ${error}`);
					parsedInput = {};
				}

				contentParts.push({
					type: 'tool_use',
					id: toolCall.id,
					name: toolCall.function.name,
					input: parsedInput,
				} as LLMMessageContentPartToolUseBlock);
			});
		}

		return contentParts;
	}

	private hasToolCalls(message: Groq.Chat.ChatCompletionMessage): boolean {
		return message.tool_calls && message.tool_calls.length > 0 || false;
	}

	private detectMalformedToolUse(message: Groq.Chat.ChatCompletionMessage): boolean {
		// Only check if there are no proper tool_calls AND content exists
		if (!message.content || this.hasToolCalls(message)) return false;

		// Look for patterns that strongly suggest attempted tool calls in text
		const malformedPatterns = [
			// Function-like syntax with JSON parameters (very specific pattern)
			/<function=.*\{.*".*":.*\}/i,
			// XML-style function tags with JSON parameters
			/<function>\w+<\/function>/i,
			// Tool-specific parameter patterns that are unique to our tools
			/"dataSourceId"\s*:\s*"ds-/i,
			/"resourcePath"\s*:\s*"/i,
			/"operations"\s*:\s*\[/i,
			/"templateResources"\s*:\s*\[/i,
			/"directUris"\s*:\s*\[/i,
			/"mode"\s*:\s*"(template|direct)"/i,
			// Pattern that looks like function call with our typical parameter structure
			/\w+\(\{\s*"\w+"\s*:/i,
		];

		return malformedPatterns.some((pattern) => pattern.test(message.content!));
	}

	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<Parameters<typeof this.groq.chat.completions.create>[0]> {
		let messages = this.asProviderMessageType(messageRequest.messages);

		// Groq requires system message to be part of the messages array, not a separate property
		if (messageRequest.system) {
			messages = [
				{ role: 'system', content: messageRequest.system },
				...messages,
			];
		}

		const tools = this.asProviderToolType(messageRequest.tools);
		const model: string = messageRequest.model || GroqModel.GROQ_LLAMA3_8B;

		const providerMessageRequest: Parameters<typeof this.groq.chat.completions.create>[0] = {
			messages,
			tools,
			model,
			max_tokens: messageRequest.maxTokens,
			temperature: messageRequest.temperature,
		};

		return providerMessageRequest;
	}

	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			const providerMessageRequest = await this.asProviderMessageRequest(
				messageRequest,
				interaction,
			);

			const { data: groqCompletion, response: groqResponse } = await this.groq.chat.completions.create({
				...providerMessageRequest,
				stream: false, // Ensure we get a complete response, not a stream
			})
				.withResponse();

			// Type assertion since we explicitly requested non-streaming
			const completion = groqCompletion as Groq.Chat.ChatCompletion;
			//logger.info(`LlmProvider[${this.llmProviderName}]: `, JSON.stringify({ completion }, null, 2));

			const message = completion.choices[0]?.message;

			// Check for malformed tool use in the response
			let malformedToolUseError = '';
			if (message && this.detectMalformedToolUse(message)) {
				logger.warn(`LlmProvider[${this.llmProviderName}]: Detected malformed tool use in response content`);
				malformedToolUseError =
					`I attempted to use tools but formatted them incorrectly. The model ${completion.model} may not be reliable for tool use. Please try your request again, or consider using a different model like Claude or GPT-4 that supports structured tool calling.\n\nOriginal response:`;
			}

			const answerContent = this.asApiMessageContentPartsType(message || {});
			if (malformedToolUseError) {
				answerContent.unshift({
					type: 'text',
					text: malformedToolUseError,
				} as LLMMessageContentPartTextBlock);
			}
			const answer = malformedToolUseError
				? `${malformedToolUseError}\n\n${extractTextFromContent(answerContent)}`
				: extractTextFromContent(answerContent);

			const messageResponse: LLMProviderMessageResponse = {
				id: completion.id,
				type: 'message',
				role: 'assistant',
				model: completion.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answer: answer,
				answerContent: answerContent,
				isTool: this.hasToolCalls(completion.choices[0]?.message || {}),
				messageStop: {
					stopReason: completion.choices[0]?.finish_reason,
					stopSequence: null,
				},
				usage: {
					inputTokens: completion.usage?.prompt_tokens || 0,
					outputTokens: completion.usage?.completion_tokens || 0,
					totalTokens: completion.usage?.total_tokens || 0,
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
					statusCode: groqResponse.status,
					statusText: groqResponse.statusText,
				},
			};

			return {
				messageResponse,
				messageMeta: {
					system: messageRequest.system,
				},
			};
		} catch (err) {
			logger.error(`LlmProvider[${this.llmProviderName}]: Error calling Groq API`, err);
			throw createError(
				ErrorType.LLM,
				`Could not get response from Groq API: ${errorMessage(err)}`,
				{
					model: messageRequest.model,
					provider: this.llmProviderName,
				} as LLMErrorOptions,
			);
		}
	}

	protected override modifySpeakWithInteractionOptions(): void {
		// Not implemented
	}

	protected override checkStopReason(): void {
		// Not implemented
	}
}

export default GroqLLM;
