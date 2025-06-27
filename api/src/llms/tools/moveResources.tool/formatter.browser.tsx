/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolMoveResourcesInput, LLMToolMoveResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { sources, destination, overwrite, createMissingDirectories } = toolInput as LLMToolMoveResourcesInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Moving resources:')}
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
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Move Resources'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
			`Moving ${sources.length} resource${sources.length === 1 ? '' : 's'}`,
		),
		content,
		preview: `Moving ${sources.length} resource${sources.length === 1 ? '' : 's'} to ${destination}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as unknown as LLMToolMoveResourcesResult;
	const { data } = bbResponse;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{data.resourcesMoved.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Resources moved successfully:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.resourcesMoved.map((resource) => (
							<>
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource)}
								{' → '}
								{LLMTool.TOOL_TAGS_BROWSER.content.directory(data.destination)}
							</>
						)),
					)}
				</>
			)}
			{data.resourcesError.length > 0 && (
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', 'Failed to move resources:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						data.resourcesError.map((resource) => LLMTool.TOOL_TAGS_BROWSER.content.filename(resource)),
					)}
				</>
			)}
		</>,
	);

	const totalResources = data.resourcesMoved.length + data.resourcesError.length;
	const successCount = data.resourcesMoved.length;
	const subtitle = `${successCount} of ${totalResources} resource${
		totalResources === 1 ? '' : 's'
	} moved to ${data.destination}`;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Move Resources'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
		content,
		preview: `Moved ${successCount} of ${totalResources} resource${totalResources === 1 ? '' : 's'}`,
	};
}
