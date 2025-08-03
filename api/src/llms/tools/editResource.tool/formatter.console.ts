import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import type { LLMToolEditResourceInput, LLMToolEditResourceResult } from './types.ts';
import { stripIndents } from 'common-tags';

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
	let operationDetails = '';

	// Handle new unified operations format
	if (operations && Array.isArray(operations)) {
		operationCount = operations.length;
		const editTypes = new Set(operations.map(op => op.editType));
		editType = editTypes.size === 1 ? Array.from(editTypes)[0] : 'mixed';

		operationDetails = stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Operations:')}
			${
				operations.map((op, index) => {
					if (op.editType === 'searchReplace') {
						return stripIndents`
						${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Search & Replace ${index + 1}:`)}
						${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.searchReplace_caseSensitive ?? true, 'case-sensitive/case-insensitive')}
						${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.searchReplace_regexPattern ?? false, 'regex/literal')}
						${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.searchReplace_replaceAll ?? false, 'all/first')}

						${LLMTool.TOOL_STYLES_CONSOLE.base.label('Search:')}
						${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.searchReplace_search||'')}

						${LLMTool.TOOL_STYLES_CONSOLE.base.label('Replace:')}
						${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.searchReplace_replace||'')}
						`;
					} else if (op.editType === 'blocks') {
						const opLabel = `${op.blocks_operationType?.toUpperCase() || 'BLOCK'} operation ${index + 1}`;
						let details = `${LLMTool.TOOL_STYLES_CONSOLE.base.label(opLabel + ':')}`;
						
						if (op.blocks_index !== undefined) {
							details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Target index:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.blocks_index)}`;
						}
						if (op.blocks_key) {
							details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Target key:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.data(op.blocks_key)}`;
						}
						if (op.blocks_position !== undefined) {
							details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Insert position:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.blocks_position)}`;
						}
						if (op.blocks_from !== undefined && op.blocks_to !== undefined) {
							details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Move:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.blocks_from)} → ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.blocks_to)}`;
						}
						
						return details;
					} else if (op.editType === 'range') {
						let details = `${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Range ${op.range_rangeType} ${index + 1}:`)}`;
						
						if (op.range_location) {
							details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Position:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.range_location.index)}`;
						}
						if (op.range_range) {
							details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Range:')} ${op.range_range.startIndex}-${op.range_range.endIndex}`;
						}
						if (op.range_text) {
							details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Text:')}\n${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.range_text)}`;
						}
						
						return details;
					} else if (op.editType === 'structuredData') {
						return `${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Structured Data Operation ${index + 1}:`)} Future implementation`;
					} else {
						return `${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Unknown Operation ${index + 1}:`)} ${LLMTool.TOOL_STYLES_CONSOLE.content.data(`Type: ${op.editType}`)}`;
					}
				}).join('\n\n')
			}
		`;
	}
	// Legacy format support
	else if (searchAndReplaceEdits) {
		editType = 'search-replace';
		operationCount = searchAndReplaceEdits.operations.length;
		operationDetails = stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Default settings:')}
			${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(searchAndReplaceEdits.caseSensitive ?? true, 'case-sensitive/case-insensitive')}
			${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(searchAndReplaceEdits.regexPattern ?? false, 'regex/literal')}
			${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(searchAndReplaceEdits.replaceAll ?? false, 'all/first')}

			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Operations:')}
			${
				searchAndReplaceEdits.operations.map((op, index) =>
					stripIndents`
					${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Operation ${index + 1}:`)}
					${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.caseSensitive ?? searchAndReplaceEdits.caseSensitive ?? true, 'case-sensitive/case-insensitive')}
					${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.regexPattern ?? searchAndReplaceEdits.regexPattern ?? false, 'regex/literal')}
					${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.replaceAll ?? searchAndReplaceEdits.replaceAll ?? false, 'all/first')}

					${LLMTool.TOOL_STYLES_CONSOLE.base.label('Search:')}
					${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.search)}

					${LLMTool.TOOL_STYLES_CONSOLE.base.label('Replace:')}
					${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.replace)}
					`
				).join('\n\n')
			}
		`;
	} else if (blockEdits) {
		editType = 'block-edit';
		operationCount = blockEdits.operations.length;
		operationDetails = stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Block Operations:')}
			${
				blockEdits.operations.map((op, index) => {
					const opLabel = `${op.type.toUpperCase()} operation ${index + 1}`;
					let details = `${LLMTool.TOOL_STYLES_CONSOLE.base.label(opLabel + ':')}`;
					
					if (op.index !== undefined) {
						details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Target index:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.index)}`;
					}
					if (op._key) {
						details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Target key:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.data(op._key)}`;
					}
					if (op.position !== undefined) {
						details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Insert position:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.position)}`;
					}
					if (op.from !== undefined && op.to !== undefined) {
						details += `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Move:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.from)} → ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.to)}`;
					}
					
					return details;
				}).join('\n\n')
			}
		`;
	} else if (structuredDataEdits) {
		editType = 'structured-data';
		operationCount = structuredDataEdits.operations.length;
		operationDetails = `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Structured Data Operations:')} ${operationCount} operations (future implementation)`;
	}

	const opText = operationCount === 1 ? 'operation' : 'operations';

	const content = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)}
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Edit type:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.data(editType)}
		${createIfMissing !== undefined ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Create if missing:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(createIfMissing)}` : ''}

		${operationDetails}
	`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Edit Resource'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${operationCount} ${opText} (${editType})`),
		content,
		preview: `Editing ${resourcePath} with ${editType} operations`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent as LLMToolEditResourceResult;
	const results = getContentArrayFromToolResult(toolResult);
	
	// Safely access bbResponse.data with fallbacks
	const responseData = bbResponse?.data;
	if (!responseData) {
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Edit Resource'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error: No response data'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error('Error: Response data is not available'),
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

	const content = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.content.status[isSuccess ? 'success' : 'error'](`Edit operations applied to ${responseData.resourcePath ?? 'unknown resource'}`)}

		${results.map((content) => {
			// Style operation results based on their status
			if (content.includes('✅')) {
				return LLMTool.TOOL_STYLES_CONSOLE.status.success(content);
			} else if (content.includes('⚠️')) {
				return LLMTool.TOOL_STYLES_CONSOLE.status.warning(content);
			} else if (content.includes('❌')) {
				return LLMTool.TOOL_STYLES_CONSOLE.status.error(content);
			} else {
				return LLMTool.TOOL_STYLES_CONSOLE.content.data(content);
			}
		}).join('\n')}
	`;
	
	const statusSummary = isSuccess 
		? (warningCount > 0 
			? `${successCount} successful, ${warningCount} warnings`
			: `${successCount} successful`)
		: `${failedCount} failed`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Edit Resource'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${editType}: ${statusSummary}`),
		content,
		preview: `${responseData.operationsApplied ?? 0} operations applied to ${responseData.resourcePath ?? 'unknown resource'}`,
	};
};