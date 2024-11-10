import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { filePath, content, createIfMissing, allowEmptyContent, expectedLineCount } = toolInput as {
		filePath: string;
		content: string;
		createIfMissing: boolean;
		allowEmptyContent: boolean;
		expectedLineCount: number;
	};
	const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;
	return stripIndents`
		${colors.bold('Rewriting file:')} ${colors.cyan(filePath)}
		${colors.bold('Expected line count:')} ${colors.cyan(`${expectedLineCount}`)}
		${colors.bold('Create if missing:')} ${createIfMissing ? colors.green('Yes') : colors.red('No')}
		${colors.bold('Allow empty content:')} ${allowEmptyContent ? colors.green('Yes') : colors.red('No')}
		${colors.bold('New content:')}
		${colors.gray(contentPreview)}
	  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	return `${colors.cyan(`${bbResponse}`)}`;
};
