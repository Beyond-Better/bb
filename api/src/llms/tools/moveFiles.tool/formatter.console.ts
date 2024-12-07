import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolMoveFilesInput, LLMToolMoveFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { sources, destination, overwrite, createMissingDirectories } = toolInput as LLMToolMoveFilesInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Moving files/directories:')}
        ${sources.map((source) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(source)}`).join('\n')}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('To destination:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.directory(destination)
	}
        
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Overwrite:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!overwrite, 'enabled/disabled')
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Create Missing Directories:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!createMissingDirectories, 'enabled/disabled')
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Move Files'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
			`Moving ${sources.length} file${sources.length === 1 ? '' : 's'}`,
		),
		content,
		preview: `Moving ${sources.length} file${sources.length === 1 ? '' : 's'} to ${destination}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as unknown as LLMToolMoveFilesResult;
	const { data } = bbResponse;

	const successContent = data.filesMoved.length > 0
		? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Files moved successfully:')}
        ${
			data.filesMoved.map((file) =>
				`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)} → ${
					LLMTool.TOOL_STYLES_CONSOLE.content.directory(data.destination)
				}`
			).join('\n')
		}
    `
		: '';

	const errorContent = data.filesError.length > 0
		? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to move files:')}
        ${data.filesError.map((file) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)}`).join('\n')}
    `
		: '';

	const content = [successContent, errorContent].filter(Boolean).join('\n\n');

	const totalFiles = data.filesMoved.length + data.filesError.length;
	const successCount = data.filesMoved.length;
	const subtitle = `${successCount} of ${totalFiles} file${totalFiles === 1 ? '' : 's'} moved to ${data.destination}`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Move Files'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
		content,
		preview: `Moved ${successCount} of ${totalFiles} file${totalFiles === 1 ? '' : 's'}`,
	};
}
