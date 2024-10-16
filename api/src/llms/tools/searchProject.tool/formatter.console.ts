import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { contentPattern, caseSensitive, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } = toolInput as {
		contentPattern?: string;
		caseSensitive?: boolean;
		filePattern?: string;
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
	};
	return stripIndents`
    ${colors.bold('Project Search Parameters:')}
    ${
		contentPattern
			? `${colors.cyan('Content pattern:')} ${contentPattern}, , ${
				caseSensitive ? 'case-sensitive' : 'case-insensitive'
			}`
			: ''
	}
    ${filePattern ? `${colors.cyan('File pattern:')} ${filePattern}` : ''}
    ${dateAfter ? `${colors.cyan('Modified after:')} ${dateAfter}` : ''}
    ${dateBefore ? `${colors.cyan('Modified before:')} ${dateBefore}` : ''}
    ${sizeMin ? `${colors.cyan('Minimum size:')} ${sizeMin.toString()} bytes` : ''}
    ${sizeMax ? `${colors.cyan('Maximum size:')} ${sizeMax.toString()} bytes` : ''}
  `.trim();
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { toolResult, bbResponse } = resultContent;
	const lines = getContentFromToolResult(toolResult).split('\n');
	const fileList = lines.slice(2, -1).join('\n');
	return stripIndents`				
		${colors.cyan(`${bbResponse}:`)}

		${fileList}
	`;
};
