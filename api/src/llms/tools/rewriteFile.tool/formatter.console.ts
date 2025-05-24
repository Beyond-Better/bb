import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRewriteResourceInput, LLMToolRewriteResourceResult } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { resourcePath, content, createIfMissing, allowEmptyContent, expectedLineCount } =
		toolInput as LLMToolRewriteResourceInput;
	const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;

	const formattedContent = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)
	}
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
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Rewrite Resource'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Rewriting ${resourcePath}`),
		content: formattedContent,
		preview: `Rewriting ${resourcePath} (${expectedLineCount} lines)`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolRewriteResourceResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { resourcePath, lineCount, isNewResource, lineCountError } = bbResponse.data;
		const operation = isNewResource ? 'Created' : 'Modified';

		const content = stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label(`✅ Resource ${operation.toLowerCase()} successfully:`)}
            ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)} (${lineCount} lines)
            ${lineCountError ? `\n${LLMTool.TOOL_STYLES_CONSOLE.status.warning(lineCountError)}` : ''}
        `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rewrite Resource'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${operation} ${resourcePath}`),
			content,
			preview: `${operation} resource with ${lineCount} lines`,
		};
	} else {
		logger.error('LLMToolRewriteResource: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rewrite Resource'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Operation failed',
		};
	}
};
