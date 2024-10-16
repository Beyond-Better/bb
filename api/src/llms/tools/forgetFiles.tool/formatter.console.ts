import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { fileNames } = toolInput as { fileNames: string[] };
	return stripIndents`
    ${colors.bold('Forgetting files:')}
    ${fileNames.map((fileName) => colors.cyan(fileName)).join('\n')}
  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	return `${colors.cyan(`${bbResponse}`)}`;
};
