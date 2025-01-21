import { stripIndents } from 'common-tags';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { DisplayResult, LLMToolDisplayFileInput, LLMToolDisplayFileResult } from './types.ts';

function formatMetadata(metadata: DisplayResult['metadata']): string {
	const size = metadata.size > 1024 * 1024
		? `${(metadata.size / (1024 * 1024)).toFixed(2)} MB`
		: metadata.size > 1024
		? `${(metadata.size / 1024).toFixed(2)} KB`
		: `${metadata.size} bytes`;

	return stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('File:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.filename(metadata.name)
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Type:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.code(metadata.mimeType)
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Size:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.code(size)}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Modified:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.code(new Date(metadata.lastModified).toLocaleString())
	}
    `;
}

function formatContent(result: DisplayResult): string {
	if (result.error) {
		return LLMTool.TOOL_STYLES_CONSOLE.status.error(`Error: ${result.error}`);
	}

	let content = '';

	if (result.type === 'text') {
		content = result.content;
		if (result.truncated) {
			content += '\n' +
				LLMTool.TOOL_STYLES_CONSOLE.status.warning('Content truncated due to size. Showing first 1MB of file.');
		}
	} else if (result.type === 'image') {
		content = LLMTool.TOOL_STYLES_CONSOLE.content.code('[Image content available in browser view]');
	} else if (result.type === 'unsupported') {
		content = LLMTool.TOOL_STYLES_CONSOLE.status.warning('This file type is not currently supported for display.');
	}

	return content;
}

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { filePath } = toolInput as LLMToolDisplayFileInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Displaying file:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePath)
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Display File'),
		subtitle: 'Reading file contents',
		content,
		preview: `Displaying file: ${filePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolDisplayFileResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const result = bbResponse.data;

		const content = stripIndents`
            ${formatMetadata(result.metadata)}
            
            ${formatContent(result)}
        `;

		const subtitle = result.error
			? 'Error displaying file'
			: result.type === 'unsupported'
			? 'Unsupported file type'
			: 'File contents displayed';

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Display File'),
			subtitle,
			content,
			preview: `Displayed ${result.metadata.name}`,
		};
	} else {
		const content = LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse));

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Display File'),
			subtitle: 'failed',
			content,
			preview: 'Operation failed',
		};
	}
};
