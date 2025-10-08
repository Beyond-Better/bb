/** @jsxImportSource preact */
//import type { JSX } from 'preact';
//import { escape as escapeHtmlEntities } from '@std/html';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import type { LLMToolEditResourceInput, LLMToolEditResourceResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const {
		resourcePath,
		createIfMissing,
		operations,
		// Legacy support
		searchAndReplaceEdits,
		blockEdits,
		structuredDataEdits,
	} = toolInput as LLMToolEditResourceInput;

	// Determine edit type and operation details
	let editType = 'unknown';
	let operationCount = 0;
	let operationElements;

	// Handle new unified operations format
	if (operations && Array.isArray(operations)) {
		operationCount = operations.length;
		const editTypes = new Set(operations.map((op) => op.editType));
		editType = editTypes.size === 1 ? Array.from(editTypes)[0] : 'mixed';

		operationElements = (
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Operations:')}
				{LLMTool.TOOL_TAGS_BROWSER.base.list(
					operations.map((op, index) => {
						if (op.editType === 'searchReplace') {
							return (
								<div key={index}>
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label(`Search & Replace ${index + 1}:`)}
										({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
											op.searchReplace_caseSensitive ?? true,
											'case-sensitive/case-insensitive',
										)}) ({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
											op.searchReplace_regexPattern ?? false,
											'regex/literal',
										)}) ({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
											op.searchReplace_replaceAll ?? false,
											'all/first',
										)})
									</div>
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Search:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.pre(op.searchReplace_search || '')}
									</div>
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Replace:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.pre(op.searchReplace_replace || '')}
									</div>
								</div>
							);
						} else if (op.editType === 'blocks') {
							return (
								<div key={index}>
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label(
											`Block ${op.blocks_operationType?.toUpperCase()} ${index + 1}:`,
										)}
									</div>
									{op.blocks_index !== undefined && (
										<div>
											{LLMTool.TOOL_TAGS_BROWSER.base.label('Target index:')}
											{LLMTool.TOOL_TAGS_BROWSER.content.number(op.blocks_index)}
										</div>
									)}
									{op.blocks_key && (
										<div>
											{LLMTool.TOOL_TAGS_BROWSER.base.label('Target key:')}
											{LLMTool.TOOL_TAGS_BROWSER.base.text(op.blocks_key)}
										</div>
									)}
									{op.blocks_position !== undefined && (
										<div>
											{LLMTool.TOOL_TAGS_BROWSER.base.label('Insert position:')}
											{LLMTool.TOOL_TAGS_BROWSER.content.number(op.blocks_position)}
										</div>
									)}
									{op.blocks_from !== undefined && op.blocks_to !== undefined && (
										<div>
											Move: {LLMTool.TOOL_TAGS_BROWSER.content.number(op.blocks_from)} →{' '}
											{LLMTool.TOOL_TAGS_BROWSER.content.number(op.blocks_to)}
										</div>
									)}
								</div>
							);
						} else if (op.editType === 'range') {
							return (
								<div key={index}>
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label(
											`Range ${op.range_rangeType} ${index + 1}:`,
										)}
									</div>
									{op.range_location && (
										<div>
											{LLMTool.TOOL_TAGS_BROWSER.base.label('Position:')}
											{LLMTool.TOOL_TAGS_BROWSER.content.number(op.range_location.index)}
										</div>
									)}
									{op.range_range && (
										<div>
											{LLMTool.TOOL_TAGS_BROWSER.base.label('Range:')}
											{op.range_range.startIndex}-{op.range_range.endIndex}
										</div>
									)}
									{op.range_text && (
										<div>
											{LLMTool.TOOL_TAGS_BROWSER.base.label('Text:')}
											{LLMTool.TOOL_TAGS_BROWSER.base.pre(op.range_text)}
										</div>
									)}
								</div>
							);
						} else if (op.editType === 'structuredData') {
							return (
								<div key={index}>
									{LLMTool.TOOL_TAGS_BROWSER.base.label(`Structured Data Operation ${index + 1}:`)}
									{LLMTool.TOOL_TAGS_BROWSER.base.text('Future implementation')}
								</div>
							);
						} else {
							return (
								<div key={index}>
									{LLMTool.TOOL_TAGS_BROWSER.base.label(`Unknown Operation ${index + 1}:`)}
									{LLMTool.TOOL_TAGS_BROWSER.base.text(`Type: ${op.editType}`)}
								</div>
							);
						}
					}),
				)}
			</>
		);
	} // Legacy format support
	else if (searchAndReplaceEdits) {
		editType = 'search-replace';
		operationCount = searchAndReplaceEdits.operations.length;
		operationElements = (
			<>
				<div>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Default settings:')}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(
						searchAndReplaceEdits.caseSensitive ?? true,
						'case-sensitive/case-insensitive',
					)}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(
						searchAndReplaceEdits.regexPattern ?? false,
						'regex/literal',
					)}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(
						searchAndReplaceEdits.replaceAll ?? false,
						'all/first',
					)}
				</div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Operations:')}
				{LLMTool.TOOL_TAGS_BROWSER.base.list(
					searchAndReplaceEdits.operations.map((op, index) => (
						<div key={index}>
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.label(`Operation ${index + 1}:`)}
								({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
									op.caseSensitive ?? searchAndReplaceEdits.caseSensitive ?? true,
									'case-sensitive/case-insensitive',
								)}) ({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
									op.regexPattern ?? searchAndReplaceEdits.regexPattern ?? false,
									'regex/literal',
								)}) ({LLMTool.TOOL_TAGS_BROWSER.content.boolean(
									op.replaceAll ?? searchAndReplaceEdits.replaceAll ?? false,
									'all/first',
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
			</>
		);
	} else if (blockEdits) {
		editType = 'block-edit';
		operationCount = blockEdits.operations.length;
		operationElements = (
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Block Operations:')}
				{LLMTool.TOOL_TAGS_BROWSER.base.list(
					blockEdits.operations.map((op, index) => {
						const opLabel = `${op.type.toUpperCase()} operation ${index + 1}`;
						return (
							<div key={index}>
								<div>{LLMTool.TOOL_TAGS_BROWSER.base.label(opLabel + ':')}</div>
								{op.index !== undefined && (
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Target index:')}
										{LLMTool.TOOL_TAGS_BROWSER.content.number(op.index)}
									</div>
								)}
								{op._key && (
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Target key:')}
										{LLMTool.TOOL_TAGS_BROWSER.base.text(op._key)}
									</div>
								)}
								{op.position !== undefined && (
									<div>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Insert position:')}
										{LLMTool.TOOL_TAGS_BROWSER.content.number(op.position)}
									</div>
								)}
								{op.from !== undefined && op.to !== undefined && (
									<div>
										Move: {LLMTool.TOOL_TAGS_BROWSER.content.number(op.from)} →{' '}
										{LLMTool.TOOL_TAGS_BROWSER.content.number(op.to)}
									</div>
								)}
							</div>
						);
					}),
				)}
			</>
		);
	} else if (structuredDataEdits) {
		editType = 'structured-data';
		operationCount = structuredDataEdits.operations.length;
		operationElements = (
			<div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Structured Data Operations:')}
				{LLMTool.TOOL_TAGS_BROWSER.base.text(`${operationCount} operations (future implementation)`)}
			</div>
		);
	}

	const opText = operationCount === 1 ? 'operation' : 'operations';

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			<div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Resource:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePath)}
			</div>
			<div>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Edit type:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.toolName(editType)}
			</div>
			{createIfMissing !== undefined && (
				<div>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Create if missing:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(createIfMissing)}
				</div>
			)}
			{operationElements}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Edit Resource'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${operationCount} ${opText} (${editType})`),
		content,
		preview: `Editing ${resourcePath} with ${editType} operations`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResults, bbResponse } = resultContent as LLMToolEditResourceResult;
	const results = getContentArrayFromToolResult(toolResults);

	// Safely access bbResponse.data with fallbacks
	const responseData = bbResponse?.data;
	if (!responseData) {
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Edit Resource'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error: No response data'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				<div className='text-red-700 dark:text-red-300'>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Error: Response data is not available')}
				</div>,
			),
			preview: 'Edit resource operation failed - no response data',
		};
	}

	// Check if operation was successful
	const isSuccess = (responseData.operationsFailed ?? 1) === 0;

	// Get edit type from response
	const editType = responseData.operationResults?.[0].editType ?? 'unknown';

	// Get operation counts from response data
	const successCount = responseData.operationsSuccessful ?? 0;
	const warningCount = responseData.operationsWithWarnings ?? 0;
	const failedCount = responseData.operationsFailed ?? 0;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			<div className={isSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
				{LLMTool.TOOL_TAGS_BROWSER.base.label(
					`Edit operations applied to ${responseData.resourcePath ?? 'unknown resource'}`,
				)}
			</div>
			{results.length > 0 && (
				<div className='mt-2'>
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						results.map((result, index) => {
							// Style operation results based on their status
							let className = '';
							if (result.includes('✅')) {
								className = 'text-green-700 dark:text-green-300';
							} else if (result.includes('⚠️')) {
								className = 'text-yellow-700 dark:text-yellow-300';
							} else if (result.includes('❌')) {
								className = 'text-red-700 dark:text-red-300';
							}
							return (
								<div key={index} className={className}>
									{result}
								</div>
							);
						}),
					)}
				</div>
			)}
		</>,
	);

	const statusSummary = isSuccess
		? (warningCount > 0 ? `${successCount} successful, ${warningCount} warnings` : `${successCount} successful`)
		: `${failedCount} failed`;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Edit Resource'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${editType}: ${statusSummary}`),
		content,
		preview: `${responseData.operationsApplied ?? 0} operations applied to ${
			responseData.resourcePath ?? 'unknown resource'
		}`,
	};
};
