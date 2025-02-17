/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRemoveFilesInput, LLMToolRemoveFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { sources, acknowledgement } = toolInput as LLMToolRemoveFilesInput;
	const isPermanentDelete = acknowledgement !== undefined;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{isPermanentDelete
				? LLMTool.TOOL_TAGS_BROWSER.content.badge('🔥 PERMANENTLY DELETING:', 'warning')
				: LLMTool.TOOL_TAGS_BROWSER.content.badge('🗑️ Moving to trash:', 'default')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				sources.map((source) => LLMTool.TOOL_TAGS_BROWSER.content.filename(source)),
			)}

			{isPermanentDelete && acknowledgement && (
				<>
					{acknowledgement.hasDirectories && (
						<div className='text-lg font-bold mt-2'>
							{LLMTool.TOOL_TAGS_BROWSER.content.status(
								'warning',
								'⚠️ WARNING: Includes directories - all contents will be deleted!',
							)}
						</div>
					)}
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Acknowledgement:')}
					<div className='ml-4'>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Count:')}{'  '}
						{LLMTool.TOOL_TAGS_BROWSER.content.number(acknowledgement.fileCount)} items
					</div>
					<div className='ml-4'>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Verification:')}{'  '}{acknowledgement.acknowledgement}
					</div>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Verified Items:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						acknowledgement.files.map((file) => LLMTool.TOOL_TAGS_BROWSER.content.filename(file)),
					)}
				</>
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title(
			'Tool Use',
			isPermanentDelete ? 'Remove Files (Permanent)' : 'Remove Files (Trash)',
		),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
			`Removing ${sources.length} item${sources.length === 1 ? '' : 's'}${
				isPermanentDelete ? ' permanently' : ' to trash'
			}`,
		),
		content,
		preview: `Removing ${sources.length} item${sources.length === 1 ? '' : 's'}${
			isPermanentDelete ? ' permanently' : ' to trash'
		}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as unknown as LLMToolRemoveFilesResult;
	const { data } = bbResponse;

	const isPermanentDelete = !data.filesRemoved.some((f) => f.destination);

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{data.filesRemoved.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status(
						'completed',
						isPermanentDelete ? '🔥 Items permanently deleted:' : '✅ Items moved to trash:',
					)}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.filesRemoved.map((item) => (
							<>
								{item.isDirectory ? '📁 ' : '📄 '}
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(item.name)}
								{item.destination && (
									<>
										{' → '}
										{LLMTool.TOOL_TAGS_BROWSER.content.directory(item.destination)}
									</>
								)}
							</>
						)),
					)}
					{isPermanentDelete && data.filesRemoved.some((item) => item.isDirectory) && (
						<div className='mt-2 text-yellow-600'>
							Note: Directories were deleted with all their contents
						</div>
					)}
				</>
			)}
			{data.filesError.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', 'Failed to remove:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.filesError.map((file) => (
							<>
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.name)}
								{': '}
								{LLMTool.TOOL_TAGS_BROWSER.content.error(file.error)}
							</>
						)),
					)}
				</>
			)}
		</>,
	);

	const totalItems = data.filesRemoved.length + data.filesError.length;
	const successCount = data.filesRemoved.length;
	const subtitle = `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} ${
		isPermanentDelete ? 'deleted' : 'moved to trash'
	}`;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Remove Files'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
		content,
		preview: `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} removed`,
	};
}
