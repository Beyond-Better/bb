/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolForgetFilesInput, LLMToolForgetFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { files } = toolInput as LLMToolForgetFilesInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Files to forget:')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				files.map((file) => (
					<>
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.filePath)}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.label('(Revision:')} {file.revision}
						{')'}
					</>
				)),
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Forget Files'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
			`Forgetting ${files.length} file${files.length === 1 ? '' : 's'}`,
		),
		content,
		preview: `Forgetting ${files.length} file${files.length === 1 ? '' : 's'}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const { bbResponse, filesSuccess = [], filesError = [] } = resultContent as unknown as LLMToolForgetFilesResult;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{filesSuccess.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Successfully removed:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						filesSuccess.map((file) => (
							<>
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.filePath)}{' '}
								{LLMTool.TOOL_TAGS_BROWSER.base.label('(Revision:')} {file.revision}
								{')'}
							</>
						)),
					)}
				</>
			)}
			{filesError.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Failed to remove:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						filesError.map((file) => (
							<>
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.filePath)}{' '}
								{LLMTool.TOOL_TAGS_BROWSER.base.label('(Revision:')} {file.revision}
								{')'}
								{': '}
								{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', file.error)}
							</>
						)),
					)}
				</>
			)}
		</>,
	);

	const totalFiles = filesSuccess.length + filesError.length;
	const successCount = filesSuccess.length;
	const subtitle = `${successCount} of ${totalFiles} file${totalFiles === 1 ? '' : 's'} removed`;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Forget Files'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
		content,
		preview: bbResponse,
	};
}
