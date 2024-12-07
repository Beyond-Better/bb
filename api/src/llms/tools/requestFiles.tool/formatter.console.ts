import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRequestFilesInput, LLMToolRequestFilesResult } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { fileNames } = toolInput as LLMToolRequestFilesInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Requesting files:')}
        ${fileNames.map((fileName) => LLMTool.TOOL_STYLES_CONSOLE.content.filename(fileName)).join('\n')}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Request Files'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${fileNames.length} files`),
		content,
		preview: `Requesting ${fileNames.length} file${fileNames.length === 1 ? '' : 's'}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolRequestFilesResult['bbResponse'];

		const contentParts = [];

		if (data.filesAdded.length > 0) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Files Added:')}
                ${data.filesAdded.map((file) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)}`).join('\n')}
            `);
		}

		if (data.filesError.length > 0) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to Add:')}
                ${data.filesError.map((file) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)}`).join('\n')}
            `);
		}

		const content = contentParts.join('\n\n');
		const addedCount = data.filesAdded.length;
		const errorCount = data.filesError.length;
		const subtitle = `${addedCount} added${errorCount > 0 ? `, ${errorCount} failed` : ''}`;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Request Files'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
			content,
			preview: addedCount > 0 ? `Added ${addedCount} file${addedCount === 1 ? '' : 's'}` : 'No files added',
		};
	} else {
		logger.error('LLMToolRequestFiles: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Request Files'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.content.status.failed(String(bbResponse)),
			preview: 'Error requesting files',
		};
	}
};
