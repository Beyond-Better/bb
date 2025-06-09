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
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithResponse,
} from 'api/types.ts';

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
	): Groq.Chat.Completions.CompletionCreateParams.Message[] {
		return messages.map((m) => {
			return {
				role: m.role,
				content: m.content.map(part => part.text).join(''),
			} as Groq.Chat.Completions.CompletionCreateParams.Message;
		});
	}

	private asProviderToolType(tools: LLMTool[]): Groq.Chat.Completions.CompletionCreateParams.Tool[] {
		return tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			}
		} as Groq.Chat.Completions.CompletionCreateParams.Tool));
	}

	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<Groq.Chat.Completions.CompletionCreateParams> {
		const messages = this.asProviderMessageType(messageRequest.messages);
		const tools = this.asProviderToolType(messageRequest.tools);
		const model: string = messageRequest.model || GroqModel.LLAMA3_8B;

		const providerMessageRequest: Groq.Chat.Completions.CompletionCreateParams = {
			messages,
			tools,
			model,
			max_tokens: messageRequest.maxTokens,
			temperature: messageRequest.temperature,
		};
		if (messageRequest.system) {
			messages.unshift({ role: 'system', content: messageRequest.system });
		}
		
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
			
			const groqCompletion = await this.groq.chat.completions.create(providerMessageRequest);
			
			const messageResponse: LLMProviderMessageResponse = {
				id: groqCompletion.id,
				type: 'message',
				role: 'assistant',
				model: groqCompletion.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answer: groqCompletion.choices[0]?.message?.content || '',
				answerContent: [{
					type: 'text',
					text: groqCompletion.choices[0]?.message?.content || '',
				}],
				isTool: !!groqCompletion.choices[0]?.message?.tool_calls,
				messageStop: {
					stopReason: groqCompletion.choices[0]?.finish_reason,
					stopSequence: null,
				},
				usage: {
					inputTokens: groqCompletion.usage?.prompt_tokens || 0,
					outputTokens: groqCompletion.usage?.completion_tokens || 0,
					totalTokens: groqCompletion.usage?.total_tokens || 0,
				},
				rateLimit: {
					requestsRemaining: 0,
					requestsLimit: 0,
					requestsResetDate: new Date(),
					tokensRemaining: 0,
					tokensLimit: 0,
					tokensResetDate: new Date(),
				},
				providerMessageResponseMeta: {},
			};

			return {
				messageResponse,
				messageMeta: {
					system: messageRequest.system,
				},
			};

		} catch (err) {
			logger.error('GroqLLM: Error calling Groq API', err);
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
