/** @jsxImportSource preact */
//import type { JSX } from 'preact';
//import { escape as escapeHtmlEntities } from '@std/html';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import type { LLMToolBlockEditInput, LLMToolBlockEditResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { resourcePath, operations } = toolInput as LLMToolBlockEditInput;
	const opCount = operations.length;
	const opText = opCount === 1 ? 'operation' : 'operations';
	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			<div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Resource:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePath)}
			</div>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Operations:')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				operations.map((op, index) => (
					<div key={index}>
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label(`Operation ${index + 1}:`)}{' '}
							{LLMTool.TOOL_TAGS_BROWSER.content.keyword(op.type)}
							{op.index !== undefined && (
								<span> (index: {LLMTool.TOOL_TAGS_BROWSER.content.number(op.index)})</span>
							)}
							{op._key && (
								<span> (key: {LLMTool.TOOL_TAGS_BROWSER.content.string(op._key)})</span>
							)}
							{op.position !== undefined && (
								<span> (position: {LLMTool.TOOL_TAGS_BROWSER.content.number(op.position)})</span>
							)}
						</div>
						{op.content && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Content Type:')}
								{LLMTool.TOOL_TAGS_BROWSER.content.keyword(op.content._type)}
								{op.content.style && (
									<span> (style: {LLMTool.TOOL_TAGS_BROWSER.content.keyword(op.content.style)})</span>
								)}
							</div>
						)}
						{op.block && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Block Type:')}
								{LLMTool.TOOL_TAGS_BROWSER.content.keyword(op.block._type)}
								{op.block.style && (
									<span> (style: {LLMTool.TOOL_TAGS_BROWSER.content.keyword(op.block.style)})</span>
								)}
							</div>
						)}
						{(op.from !== undefined || op.fromKey) && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('From:')}
								{op.from !== undefined && (
									<span> index {LLMTool.TOOL_TAGS_BROWSER.content.number(op.from)}</span>
								)}
								{op.fromKey && (
									<span> key {LLMTool.TOOL_TAGS_BROWSER.content.string(op.fromKey)}</span>
								)}
							</div>
						)}
						{(op.to !== undefined || op.toPosition !== undefined) && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('To:')}
								{op.to !== undefined && (
									<span> index {LLMTool.TOOL_TAGS_BROWSER.content.number(op.to)}</span>
								)}
								{op.toPosition !== undefined && (
									<span> position {LLMTool.TOOL_TAGS_BROWSER.content.number(op.toPosition)}</span>
								)}
							</div>
						)}
					</div>
				)),
			)}
		</>,
	);
	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Block Edit'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${opCount} ${opText}`),
		content,
		preview: `Editing blocks in ${resourcePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent as unknown as LLMToolBlockEditResult;
	const results = getContentArrayFromToolResult(toolResult);

	// Check if operation was successful
	const isSuccess = !bbResponse.toLowerCase().includes('error') &&
		!bbResponse.toLowerCase().includes('failed');

	// Count successful operations
	const successCount = results.filter((r) =>
		r.includes('✅') || r.toLowerCase().includes('succeeded')
	).length;

	// Count total operations
	const operationMatch = bbResponse.match(/(\d+)\/(\d+) operations succeeded/);
	const totalOperations = operationMatch ? parseInt(operationMatch[2]) : successCount;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label(
				results[0],
			)}
			{results.length > 1 && (
				LLMTool.TOOL_TAGS_BROWSER.base.list(
					results.slice(1),
				)
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Block Edit'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
			isSuccess ? `${successCount}/${totalOperations} operations` : 'failed'
		),
		content,
		preview: bbResponse,
	};
};