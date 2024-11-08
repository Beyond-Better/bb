import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { query, models } = toolInput as { query: string; models: string[] };
	return stripIndents`
    ${colors.bold('Querying multiple models:')}
    Query: ${colors.cyan(query)}
    Models: ${colors.green(models.join(', '))}
  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as {
			querySuccess: Array<{ modelIdentifier: string; answer: string }>;
			queryError: Array<{ modelIdentifier: string; error: string }>;
		};
		return [
			`${
				data.querySuccess.length > 0
					? (
						colors.bold('✅  BB has queried models:\n') +
						data.querySuccess.map((query) =>
							`${colors.bold('Model: ')}${colors.yellow(query.modelIdentifier)}\nAnswer:\n${query.answer}`
						).join('\n\n')
					)
					: ''
			}`,
			`${
				data.queryError.length > 0
					? (
						colors.bold.red('⚠️  BB failed to query models:\n') +
						data.queryError.map((query) =>
							`${colors.bold('Model: ')}${colors.yellow(query.modelIdentifier)}\nError:\n${query.error}`
						).join('\n\n')
					)
					: ''
			}
		`,
		].join('\n\n\n');
	} else {
		logger.error('LLMToolMultiModelQuery: Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
