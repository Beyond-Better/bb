/** @jsxImportSource preact */
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRewriteFileInput, LLMToolRewriteFileResult } from './types.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { filePath, content, createIfMissing, allowEmptyContent, expectedLineCount } =
		toolInput as LLMToolRewriteFileInput;
	const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;

	const formattedContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('File:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.filename(filePath)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Expected line count:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.number(expectedLineCount)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Create if missing:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(createIfMissing ?? true)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Allow empty content:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(allowEmptyContent ?? false)}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('New content:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.pre(contentPreview)}
				</>,
				`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
			)}
		</>,
		LLMTool.TOOL_STYLES_BROWSER.base.container,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Rewrite File'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Rewriting ${filePath}`),
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

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label(`✅ File ${operation.toLowerCase()} successfully:`)}
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.content.filename(filePath)} ({lineCount} lines)
						</div>
					</>,
				)}
				{lineCountError && LLMTool.TOOL_TAGS_BROWSER.base.container(
					LLMTool.TOOL_TAGS_BROWSER.base.label(lineCountError),
					`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.warning}`,
				)}
			</>,
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.success}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Rewrite File'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${operation} ${filePath}`),
			content,
			preview: `${operation} file with ${lineCount} lines`,
		};
	} else {
		logger.error('LLMToolRewriteFile: Unexpected bbResponse format:', bbResponse);
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse)),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Rewrite File'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content,
			preview: 'Operation failed',
		};
	}
};
