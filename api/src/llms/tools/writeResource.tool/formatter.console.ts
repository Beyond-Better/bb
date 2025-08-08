import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolWriteResourceInput, LLMToolWriteResourceResult } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const {
		resourcePath,
		overwriteExisting,
		createMissingDirectories,
		plainTextContent,
		structuredContent,
		binaryContent,
	} = toolInput as LLMToolWriteResourceInput;

	// Determine content type and preview
	let contentType = 'unknown';
	let contentPreview = '';
	let contentSize = 0;
	let expectedLineCount: number | undefined;

	if (plainTextContent && plainTextContent.content) {
		contentType = 'plain-text';
		contentPreview = plainTextContent.content.length > 100
			? plainTextContent.content.slice(0, 100) + '...'
			: plainTextContent.content;
		contentSize = plainTextContent.content.length;
		expectedLineCount = plainTextContent.expectedLineCount;
	} else if (structuredContent && structuredContent.blocks) {
		contentType = 'structured';
		const blockCount = structuredContent.blocks.length;
		contentPreview = `${blockCount} structured block${blockCount !== 1 ? 's' : ''}`;
		contentSize = JSON.stringify(structuredContent.blocks).length;
	} else if (binaryContent && binaryContent.data) {
		contentType = 'binary';
		contentPreview = `Binary data (${binaryContent.mimeType})`;
		contentSize = binaryContent.data instanceof Uint8Array ? binaryContent.data.length : binaryContent.data.length;
	}

	const formattedContent = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content type:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.data(contentType)
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content size:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.number(contentSize)
	} bytes
        ${
		expectedLineCount !== undefined
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Expected line count:')} ${
				LLMTool.TOOL_STYLES_CONSOLE.content.number(expectedLineCount)
			}`
			: ''
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Overwrite existing:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(overwriteExisting ?? false)
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Create missing directories:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(createMissingDirectories ?? true)
	}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content preview:')}
        ${
		plainTextContent
			? LLMTool.TOOL_STYLES_CONSOLE.content.code(contentPreview)
			: LLMTool.TOOL_STYLES_CONSOLE.content.data(contentPreview)
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Write Resource'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Creating ${resourcePath} (${contentType})`),
		content: formattedContent,
		preview: `Creating ${resourcePath} with ${contentType} content`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolWriteResourceResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const {
			resourcePath,
			contentType,
			size,
			isNewResource,
			lineCount,
			lineCountError,
		} = bbResponse.data;

		const operation = isNewResource ? 'Created' : 'Overwrote';
		const sizeDisplay = lineCount !== undefined ? `${lineCount} lines, ${size} bytes` : `${size} bytes`;

		const content = stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label(`✅ Resource ${operation.toLowerCase()} successfully:`)}
            ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)} 
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content type:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.data(contentType)
		}
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Size:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.data(sizeDisplay)}
            ${lineCountError ? `\n${LLMTool.TOOL_STYLES_CONSOLE.status.warning(lineCountError)}` : ''}
        `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Write Resource'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${operation} ${resourcePath}`),
			content,
			preview: `${operation} ${contentType} resource (${sizeDisplay})`,
		};
	} else {
		logger.error('LLMToolWriteResource: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Write Resource'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Operation failed',
		};
	}
};
