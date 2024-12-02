/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRequestFilesInput, LLMToolRequestFilesResult } from './types.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { fileNames } = toolInput as LLMToolRequestFilesInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.content.status('running', 'Files Requested')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				fileNames.map((fileName) => LLMTool.TOOL_TAGS_BROWSER.content.filename(fileName)),
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Request Files'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${fileNames.length} files`),
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

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{data.filesAdded.length > 0 && (
					<div>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Files Added')}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							data.filesAdded.map((file) => LLMTool.TOOL_TAGS_BROWSER.content.filename(file)),
						)}
					</div>
				)}
				{data.filesError.length > 0 && (
					<div>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', 'Failed to Add')}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							data.filesError.map((file) => LLMTool.TOOL_TAGS_BROWSER.content.filename(file)),
						)}
					</div>
				)}
			</>,
		);

		const addedCount = data.filesAdded.length;
		const errorCount = data.filesError.length;
		const subtitle = `${addedCount} added${errorCount > 0 ? `, ${errorCount} failed` : ''}`;

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Request Files'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
			content,
			preview: addedCount > 0 ? `Added ${addedCount} file${addedCount === 1 ? '' : 's'}` : 'No files added',
		};
	} else {
		logger.error('LLMToolRequestFiles: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Request Files'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				LLMTool.TOOL_TAGS_BROWSER.content.status('failed', String(bbResponse)),
			),
			preview: 'Error requesting files',
		};
	}
};
