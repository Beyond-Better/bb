/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolMoveFilesInput, LLMToolMoveFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { sources, destination, overwrite, createMissingDirectories } = toolInput as LLMToolMoveFilesInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Moving files/directories:')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				sources.map((source) => LLMTool.TOOL_TAGS_BROWSER.content.filename(source)),
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.label('To destination:')}{'  '}
			{LLMTool.TOOL_TAGS_BROWSER.content.directory(destination)}
			<div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Overwrite:')}{'  '}
				{LLMTool.TOOL_TAGS_BROWSER.content.boolean(!!overwrite, 'enabled/disabled')}
			</div>
			<div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Create Missing Directories:')}{'  '}
				{LLMTool.TOOL_TAGS_BROWSER.content.boolean(!!createMissingDirectories, 'enabled/disabled')}
			</div>
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Move Files'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
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

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{data.filesMoved.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Files moved successfully:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.filesMoved.map((file) => (
							<>
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(file)}
								{' → '}
								{LLMTool.TOOL_TAGS_BROWSER.content.directory(data.destination)}
							</>
						)),
					)}
				</>
			)}
			{data.filesError.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', 'Failed to move files:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.filesError.map((file) => LLMTool.TOOL_TAGS_BROWSER.content.filename(file)),
					)}
				</>
			)}
		</>,
	);

	const totalFiles = data.filesMoved.length + data.filesError.length;
	const successCount = data.filesMoved.length;
	const subtitle = `${successCount} of ${totalFiles} file${totalFiles === 1 ? '' : 's'} moved to ${data.destination}`;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Move Files'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
		content,
		preview: `Moved ${successCount} of ${totalFiles} file${totalFiles === 1 ? '' : 's'}`,
	};
}
