import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { filePath, patch } = toolInput as { filePath?: string; patch: string };
	return stripIndents`
    ${filePath ? `${colors.bold('File to patch:')} ${colors.cyan(filePath)}` : colors.bold('Multi-file patch')}
    
    ${colors.bold('Patch:')}
    ${colors.yellow(patch)}
  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { modifiedFiles, newFiles } = bbResponse.data as { modifiedFiles: string[]; newFiles: string[] };
		return [
			`✅ Patch applied successfully to ${modifiedFiles.length + newFiles.length} file(s):`,
			`${
				modifiedFiles.length > 0
					? modifiedFiles.map((file) => colors.cyan(`📝 Modified: ${file}`)).join('\n')
					: ''
			}`,
			`${newFiles.length > 0 ? newFiles.map((file) => colors.cyan(`📄 Created: ${file}`)).join('\n') : ''}
		`,
		].join('\n\n');
	} else {
		logger.error('Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
