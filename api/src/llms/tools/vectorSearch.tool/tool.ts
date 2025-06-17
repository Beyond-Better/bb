//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { VectorSearchErrorOptions } from 'api/errors/error.ts';
import type { LLMToolVectorSearchInput } from './types.ts';

import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { searchEmbeddings } from '../../../utils/embedding.utils.ts';
import { logger } from 'shared/logger.ts';

export default class LLMToolVectorSearch extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The search query to use for vector search',
				},
			},
			required: ['query'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
	): Promise<LLMToolRunResult> {
		const input = toolUse.toolInput as LLMToolVectorSearchInput;
		const { query } = input;

		try {
			const vectorSearchResults = await searchEmbeddings(query);
			const toolResults = vectorSearchResults.join('\n');
			const toolResponse = `Found ${vectorSearchResults.length} matching embeddings`;
			const bbResponse = `BB found ${vectorSearchResults.length} matches for query: "${query}"`;

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`LLMToolVectorSearch: Error performing vector search: ${(error as Error).message}`);

			throw createError(ErrorType.VectorSearch, `Error performing vector search: ${(error as Error).message}`, {
				name: 'vector-search',
				query,
				operation: 'search',
			} as VectorSearchErrorOptions);
		}
	}
}
