import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRewriteFileInput, LLMToolRewriteFileResult } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { filePath, content, createIfMissing, allowEmptyContent, expectedLineCount } =
		toolInput as LLMToolRewriteFileInput;
	const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;

	const formattedContent = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('File:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePath)}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Expected line count:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.number(expectedLineCount)
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Create if missing:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(createIfMissing ?? true)
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Allow empty content:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(allowEmptyContent ?? false)
	}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('New content:')}
        ${LLMTool.TOOL_STYLES_CONSOLE.content.code(contentPreview)}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Rewrite File'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Rewriting ${filePath}`),
		content: formattedContent,
		preview: `Rewriting ${filePath} (${expectedLineCount} lines)`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolRewriteFileResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { filePath, lineCount, isNewFile, lineCountError } = bbResponse.data;
		const operation = isNewFile ? 'Created' : 'Modified';

		const content = stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label(`✅ File ${operation.toLowerCase()} successfully:`)}
            ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePath)} (${lineCount} lines)
            ${lineCountError ? `\n${LLMTool.TOOL_STYLES_CONSOLE.status.warning(lineCountError)}` : ''}
        `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rewrite File'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${operation} ${filePath}`),
			content,
			preview: `${operation} file with ${lineCount} lines`,
		};
	} else {
		logger.error('LLMToolRewriteFile: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rewrite File'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Operation failed',
		};
	}
};
