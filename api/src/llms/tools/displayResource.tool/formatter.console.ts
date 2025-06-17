import { stripIndents } from 'common-tags';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { DisplayResult, LLMToolDisplayResourceInput, LLMToolDisplayResourceResult } from './types.ts';

function formatMetadata(metadata: DisplayResult['metadata']): string {
	const size = metadata.size > 1024 * 1024
		? `${(metadata.size / (1024 * 1024)).toFixed(2)} MB`
		: metadata.size > 1024
		? `${(metadata.size / 1024).toFixed(2)} KB`
		: `${metadata.size} bytes`;

	return stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource:')} ${
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

	if (result.contentType === 'text') {
		content = result.content;
		if (result.truncated) {
			content += '\n' +
				LLMTool.TOOL_STYLES_CONSOLE.status.warning(
					'Content truncated due to size. Showing first 1MB of resource.',
				);
		}
	} else if (result.contentType === 'image') {
		content = LLMTool.TOOL_STYLES_CONSOLE.content.code('[Image content available in browser view]');
	} else if (result.contentType === 'unsupported') {
		content = LLMTool.TOOL_STYLES_CONSOLE.status.warning(
			'This resource type is not currently supported for display.',
		);
	}

	return content;
}

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { resourcePath } = toolInput as LLMToolDisplayResourceInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Displaying resource:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Display Resource'),
		subtitle: 'Reading resource contents',
		content,
		preview: `Displaying resource: ${resourcePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolDisplayResourceResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const result = bbResponse.data;

		const content = stripIndents`
            ${formatMetadata(result.metadata)}
            
            ${formatContent(result)}
        `;

		const subtitle = result.error
			? 'Error displaying resource'
			: result.contentType === 'unsupported'
			? 'Unsupported resource type'
			: 'Resource contents displayed';

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Display Resource'),
			subtitle,
			content,
			preview: `Displayed ${result.metadata.name}`,
		};
	} else {
		const content = LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse));

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Display Resource'),
			subtitle: 'failed',
			content,
			preview: 'Operation failed',
		};
	}
};
