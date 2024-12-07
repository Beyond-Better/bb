import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolForgetFilesInput, LLMToolForgetFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';
import { logger } from 'shared/logger.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { files } = toolInput as LLMToolForgetFilesInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Files to forget:')}
        ${
		files.map((file) =>
			`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.filePath)} ` +
			`${LLMTool.TOOL_STYLES_CONSOLE.base.label('(Revision:')} ` +
			`${file.revision})`
		).join('\n')
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Forget Files'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
			`Forgetting ${files.length} file${files.length === 1 ? '' : 's'}`,
		),
		content,
		preview: `Forgetting ${files.length} file${files.length === 1 ? '' : 's'}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolForgetFilesResult['bbResponse'];
		const { filesSuccess, filesError } = data;

		const successContent = filesSuccess.length > 0
			? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Successfully removed:')}
        ${
				filesSuccess.map((file) =>
					`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.filePath)} ` +
					`${LLMTool.TOOL_STYLES_CONSOLE.base.label('(Revision:')} ` +
					`${file.revision})`
				).join('\n')
			}
    `
			: '';

		const errorContent = filesError.length > 0
			? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Failed to remove:')}
        ${
				filesError.map((file) =>
					`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.filePath)} ` +
					`${LLMTool.TOOL_STYLES_CONSOLE.base.label('(Revision:')} ` +
					`${file.revision}): ` +
					`${LLMTool.TOOL_STYLES_CONSOLE.status.error(file.error)}`
				).join('\n')
			}
    `
			: '';

		const content = [successContent, errorContent].filter(Boolean).join('\n\n');

		const totalFiles = filesSuccess.length + filesError.length;
		const successCount = filesSuccess.length;
		const subtitle = `${successCount} of ${totalFiles} file${totalFiles === 1 ? '' : 's'} removed`;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Forget Files'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
			content,
			preview: `${successCount} of ${totalFiles} files forgotten`,
		};
	} else {
		logger.error('LLMToolRenameFiles: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Forget Files'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Error forgetting files',
		};
	}
}
