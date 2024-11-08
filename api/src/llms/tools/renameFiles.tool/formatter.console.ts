import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { operations, createMissingDirectories, overwrite } = toolInput as {
		operations: Array<{ source: string; destination: string }>;
		overwrite?: boolean;
		createMissingDirectories?: boolean;
	};
	return stripIndents`
    ${colors.bold('Renaming files/directories:')}
    ${operations.map((op) => `${colors.cyan(op.source)} -> ${colors.cyan(op.destination)}`).join('\n')}
    Overwrite: ${overwrite ? colors.green('Yes') : colors.red('No')}
    Create Missing Directories: ${createMissingDirectories ? colors.green('Yes') : colors.red('No')}
  `;
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as {
			filesRenamed: Array<{ source: string; destination: string }>;
			filesError: Array<{ source: string; destination: string }>;
		};
		return [
			`${
				data.filesRenamed.length > 0
					? (
						colors.bold('✅ BB has renamed these files:\n') +
						data.filesRenamed.map((file) => colors.cyan(`- ${file.source} -> ${file.destination}`)).join(
							'\n',
						)
					)
					: ''
			}`,
			`${
				data.filesError.length > 0
					? (
						colors.bold('⚠️ BB failed to renaqme these files:\n') +
						data.filesError.map((file) => colors.cyan(`- ${file.source} -> ${file.destination}`)).join('\n')
					)
					: ''
			}
		`,
		].join('\n\n');
	} else {
		logger.error('LLMToolRenameFiles: Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
