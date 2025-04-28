/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRemoveResourcesInput, LLMToolRemoveResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { sources, acknowledgement } = toolInput as LLMToolRemoveResourcesInput;
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
						{LLMTool.TOOL_TAGS_BROWSER.content.number(acknowledgement.resourceCount)} items
					</div>
					<div className='ml-4'>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Verification:')}{'  '}{acknowledgement.acknowledgement}
					</div>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Verified Items:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						acknowledgement.resources.map((resource) =>
							LLMTool.TOOL_TAGS_BROWSER.content.filename(resource)
						),
					)}
				</>
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title(
			'Tool Use',
			isPermanentDelete ? 'Remove Resources (Permanent)' : 'Remove Resources (Trash)',
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
	const { bbResponse } = resultContent as unknown as LLMToolRemoveResourcesResult;
	const { data } = bbResponse;

	const isPermanentDelete = !data.resourcesRemoved.some((f) => f.destination);

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{data.resourcesRemoved.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status(
						'completed',
						isPermanentDelete ? '🔥 Items permanently deleted:' : '✅ Items moved to trash:',
					)}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.resourcesRemoved.map((item) => (
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
					{isPermanentDelete && data.resourcesRemoved.some((item) => item.isDirectory) && (
						<div className='mt-2 text-yellow-600'>
							Note: Directories were deleted with all their contents
						</div>
					)}
				</>
			)}
			{data.resourcesError.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', 'Failed to remove:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.resourcesError.map((resource) => (
							<>
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.name)}
								{': '}
								{LLMTool.TOOL_TAGS_BROWSER.content.error(resource.error)}
							</>
						)),
					)}
				</>
			)}
		</>,
	);

	const totalItems = data.resourcesRemoved.length + data.resourcesError.length;
	const successCount = data.resourcesRemoved.length;
	const subtitle = `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} ${
		isPermanentDelete ? 'deleted' : 'moved to trash'
	}`;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Remove Resources'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
		content,
		preview: `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} removed`,
	};
}
