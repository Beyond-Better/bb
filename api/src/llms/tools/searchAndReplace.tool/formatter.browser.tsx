/** @jsxImportSource preact */
//import type { JSX } from 'preact';
//import { escape as escapeHtmlEntities } from '@std/html';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import type { LLMToolSearchAndReplaceInput, LLMToolSearchAndReplaceResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { resourcePath, operations, createIfMissing } = toolInput as LLMToolSearchAndReplaceInput;
	const opCount = operations.length;
	const opText = opCount === 1 ? 'operation' : 'operations';
	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			<div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Resource:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePath)} ({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
					createIfMissing ?? false,
					"create new resource/don't create new resource",
				)})
			</div>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Operations:')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				operations.map((op, index) => (
					<div key={index}>
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label(`Operation ${index + 1}:`)}{' '}
							({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
								op.replaceAll ?? false,
								'Replace All/Replace First',
							)}) ({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
								op.caseSensitive ?? true,
								'case-sensitive/case-insensitive',
							)})
						</div>
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Search:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.pre(op.search)}
						</div>
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Replace:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.pre(op.replace)}
						</div>
					</div>
				)),
			)}
		</>,
	);
	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Search And Replace'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${opCount} ${opText}`),
		content,
		preview: `Modifying ${resourcePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent as unknown as LLMToolSearchAndReplaceResult;
	const results = getContentArrayFromToolResult(toolResult);

	// Check if operation was successful
	const isSuccess = !bbResponse.toLowerCase().includes('error') &&
		!bbResponse.toLowerCase().includes('failed');

	// Count the number of changes
	const changeCount = results.filter((r) =>
		r.toLowerCase().includes('completed successfully') ||
		r.toLowerCase().includes('created')
	).length;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label(
				results[0],
			)}
			{results.length > 0 && (
				LLMTool.TOOL_TAGS_BROWSER.base.list(
					results.slice(1),
				)
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search And Replace'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(isSuccess ? `${changeCount} changes` : 'failed'),
		content,
		preview: bbResponse,
	};
};
