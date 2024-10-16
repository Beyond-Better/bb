import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { filePath, operations, createIfMissing } = toolInput as {
		filePath: string;
		operations: Array<{ search: string; replace: string; caseSensitive?: boolean; replaceAll?: boolean }>;
		createIfMissing: boolean;
	};
	return stripIndents`
		${colors.bold('File:')} ${colors.cyan(filePath)} (${
		colors.bold(createIfMissing ? colors.green('Create if missing') : colors.red("Don't create new file"))
	})
		${colors.bold('Operations:')}
		${
		operations.map((op, index) =>
			stripIndents`
		  ${colors.yellow(`Operation ${index + 1}:`)} (${
				colors.bold(op.replaceAll ? 'Replace all' : 'Replace first')
			})  (${colors.bold(op.caseSensitive ? 'Case sensitive' : 'Case insensitive')})
		  Search: 
		  ${colors.magenta(op.search)}
		  Replace: 
		  ${colors.magenta(op.replace)}
		`
		).join('\n')
	}
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
