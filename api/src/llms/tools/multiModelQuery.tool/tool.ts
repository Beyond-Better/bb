import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolConfig, LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { logger } from 'shared/logger.ts';

import { AnthropicProvider } from './providers/anthropic.ts';
import { OpenAIProvider } from './providers/openai.ts';
import { GeminiProvider } from './providers/gemini.ts';

export interface ModelProvider {
	query(model: string, prompt: string): Promise<string>;
}

const MODELS = [
	//anthropic
	'claude-3-5-sonnet-20241022',
	'claude-3-opus-20240229',
	'claude-3-sonnet-20240229',
	'claude-3-haiku-20240307',
	//openai
	'gpt-4o',
	'gpt-4o-mini',
	'gpt-4-turbo',
	'gpt-4',
	'gpt-3.5-turbo',
	//google
	'gemini-pro',
	//'gemini-pro-vision',
];
const MODELS_PROVIDERS = {
	//anthropic
	'claude-3-5-sonnet-20241022': 'anthropic',
	'claude-3-opus-20240229': 'anthropic',
	'claude-3-sonnet-20240229': 'anthropic',
	'claude-3-haiku-20240307': 'anthropic',
	//openai
	'gpt-4o': 'openai',
	'gpt-4o-mini': 'openai',
	'gpt-4-turbo': 'openai',
	'gpt-4': 'openai',
	'gpt-3.5-turbo': 'openai',
	//google
	'gemini-pro': 'gemini',
	//'gemini-pro-vision': 'gemini',
} as Record<string, string>;

interface LLMToolMultiModelQueryConfig extends LLMToolConfig {
	openaiApiKey?: string;
	anthropicApiKey?: string;
	geminiApiKey?: string;
	models?: string[];
}

export default class LLMToolMultiModelQuery extends LLMTool {
	public providers: Record<string, ModelProvider> = {};
	private models: Array<string>;

	constructor(name: string, description: string, toolConfig: LLMToolMultiModelQueryConfig) {
		super(
			name,
			description,
			toolConfig,
		);

		this.models = toolConfig.models || MODELS;

		this.description = `${description}. Available models: ${this.models.join(', ')}`;

		if (toolConfig.anthropicApiKey) this.providers.anthropic = new AnthropicProvider(toolConfig.anthropicApiKey);
		if (toolConfig.openaiApiKey) this.providers.openai = new OpenAIProvider(toolConfig.openaiApiKey);
		if (toolConfig.geminiApiKey) this.providers.gemini = new GeminiProvider(toolConfig.geminiApiKey);

		/*
		this.providers = {
			anthropic: new AnthropicProvider(toolConfig.anthropicApiKey),
			openai: new OpenAIProvider(toolConfig.openaiApiKey),
			gemini: new GeminiProvider(toolConfig.geminiApiKey),
		};
		 */

		//logger.debug(`LLMToolMultiModelQuery: models`, this.models);
		//logger.debug(`LLMToolMultiModelQuery: description`, this.description);
		//logger.debug(`LLMToolMultiModelQuery: providers`, this.providers);
	}

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description:
						`The exact prompt text that will be sent to each selected model. The prompt is used as provided with minimal modification. The tool will not:
* Modify the prompt content
* Add additional context
* Change formatting
* Insert model-specific instructions

The user should ensure their prompt is appropriate for all selected models. Example prompt types:
* Direct questions: "What is the difference between TCP and UDP?"
* Task instructions: "Write a function that calculates the Fibonacci sequence"
* Analysis requests: "Explain the advantages and disadvantages of microservices"
* Creative prompts: "Write a story about a time traveler"

Each model will receive exactly the same prompt text and their complete responses will be returned separately.`,
				},
				models: {
					type: 'array',
					items: { type: 'string' },
					description: `List of model identifiers to query. Available models by provider:

1. Anthropic:
   * claude-3-5-sonnet-20241022 (Latest Sonnet)
   * claude-3-opus-20240229 (Most capable)
   * claude-3-sonnet-20240229
   * claude-3-haiku-20240307 (Fastest)

2. OpenAI:
   * gpt-4o (Latest GPT-4)
   * gpt-4o-mini
   * gpt-4-turbo
   * gpt-4
   * gpt-3.5-turbo

3. Google:
   * gemini-pro

Example selections:
* ["claude-3-5-sonnet-20241022", "gpt-4o"] - Compare latest models
* ["claude-3-opus-20240229", "claude-3-haiku-20240307"] - Compare Claude variants
* ["gpt-4o", "gpt-3.5-turbo", "gemini-pro"] - Compare across providers

Responses will be returned separately for each model, preserving their exact output.`,
				},
			},
			required: ['query', 'models'],
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(resultContent) : formatToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { query, models } = toolInput as { query: string; models: string[] };

		logger.info(`LLMToolMultiModelQuery: input`, toolInput);

		try {
			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
			const querySuccess: Array<{ modelIdentifier: string; answer: string }> = [];
			const queryError: Array<{ modelIdentifier: string; error: string }> = [];

			const modelQueries = models.map(async (modelName: string) => {
				const provider = MODELS_PROVIDERS[modelName];
				const modelIdentifier = `${provider}/${modelName}`;

				if (!this.providers[provider]) {
					return {
						type: 'error',
						modelName,
						modelIdentifier,
						error: `Unsupported provider: ${provider}`,
					};
				}

				try {
					const answer = await this.providers[provider].query(modelName, query);
					return {
						type: 'success',
						modelName,
						modelIdentifier,
						answer,
					};
				} catch (error) {
					return {
						type: 'error',
						modelName,
						modelIdentifier,
						error: error.message,
					};
				}
			});

			const results = await Promise.all(modelQueries);

			results.forEach((result) => {
				if (result.type === 'success') {
					toolResultContentParts.push({
						'type': 'text',
						'text': `**Model: ${result.modelIdentifier}**\n\n# Answer:\n${result.answer}`,
					});
					querySuccess.push({ modelIdentifier: result.modelIdentifier, answer: result.answer || '' });
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error querying ${result.modelIdentifier}: ${result.error}`,
					});
					queryError.push({ modelIdentifier: result.modelIdentifier, error: result.error });
				}
			});

			const toolResponses = [];
			if (querySuccess.length > 0) {
				toolResponses.push(
					`Queried models:\n${querySuccess.map((m) => `- ${m.modelIdentifier}`).join('\n')}`,
				);
			}
			if (queryError.length > 0) {
				toolResponses.push(
					`Failed to query models:\n${
						queryError.map((m) => `- ${m.modelIdentifier}: ${m.error}`).join('\n')
					}`,
				);
			}

			const toolResults = toolResultContentParts;
			const toolResponse = (querySuccess.length === 0 ? 'No models queried.\n' : '') + toolResponses.join('\n\n');
			const bbResponse = {
				data: {
					querySuccess,
					queryError,
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
			};
		} catch (error) {
			logger.error(`LLMToolMultiModelQuery: Error querying models: ${error.message}`);
			throw error;
		}
	}
}
