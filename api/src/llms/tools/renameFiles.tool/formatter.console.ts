import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRenameFilesInput, LLMToolRenameFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { operations, createMissingDirectories, overwrite } = toolInput as LLMToolRenameFilesInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Files to rename:')}
        ${
		operations.map((op) =>
			`${LLMTool.TOOL_STYLES_CONSOLE.content.filename(op.source)} → ${
				LLMTool.TOOL_STYLES_CONSOLE.content.filename(op.destination)
			}`
		).join('\n')
	}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Options:')}
        Overwrite: ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!overwrite, 'enabled/disabled')}
        Create Missing Directories: ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!createMissingDirectories, 'enabled/disabled')
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Rename Files'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${operations.length} operations`),
		content,
		preview: `Renaming ${operations.length} file${operations.length === 1 ? '' : 's'}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolRenameFilesResult['bbResponse'];
		const { filesRenamed, filesError } = data;

		const successContent = filesRenamed.length > 0
			? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Files renamed successfully:')}
                ${
				filesRenamed.map((file) =>
					`${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.source)} → ${
						LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.destination)
					}`
				).join('\n')
			}`
			: '';

		const errorContent = filesError.length > 0
			? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to rename:')}
                ${
				filesError.map((file) =>
					`${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.source)} → ${
						LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.destination)
					}` +
					(file.error ? `\n${LLMTool.TOOL_STYLES_CONSOLE.status.error(file.error)}` : '')
				).join('\n\n')
			}`
			: '';

		const content = [successContent, errorContent].filter(Boolean).join('\n\n');
		const totalFiles = filesRenamed.length + filesError.length;
		const successCount = filesRenamed.length;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rename Files'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
				`${successCount}/${totalFiles} files renamed successfully`,
			),
			content,
			preview: `${successCount} of ${totalFiles} files renamed`,
		};
	} else {
		logger.error('LLMToolRenameFiles: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rename Files'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Error renaming files',
		};
	}
};
