import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { tasks } = toolInput as { tasks: string[] };
	return stripIndents`
    ${colors.bold('Tasks to delegate:')}
    ${tasks.map((task, index) => `${index + 1}. ${colors.cyan(task)}`).join('\n')}
  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { toolResult, bbResponse } = resultContent;
	const results = getContentArrayFromToolResult(toolResult);
	return stripIndents`
		${colors.cyan(`${bbResponse}:`)}
	
		${
		results.map((content) => {
			return colors.bold(content);
		}).join('\n')
	}`;
};
