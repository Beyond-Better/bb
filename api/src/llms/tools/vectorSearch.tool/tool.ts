import type { JSX } from 'preact';

import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
//import type ProjectEditor from 'api/editor/projectEditor.ts';
//import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { VectorSearchErrorOptions } from 'api/errors/error.ts';
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
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;

		const { query } = toolInput as { query: string };
		try {
			const vectorSearchResults = await searchEmbeddings(query);

			const toolResults = vectorSearchResults;
			const toolResponse = '';
			const bbResponse =
				`BB has completed vector search for query: "${query}". ${vectorSearchResults.length} results found.\n${vectorSearchResults}`;

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`LLMToolVectorSearch: Error performing vector search: ${error.message}`);
			throw createError(ErrorType.VectorSearch, `Error performing vector search: ${error.message}`, {
				name: 'vector-search',
				query,
				operation: 'search',
			} as VectorSearchErrorOptions);
		}
	}
}
