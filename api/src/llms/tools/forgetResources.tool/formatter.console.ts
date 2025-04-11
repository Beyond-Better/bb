import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolForgetResourcesInput, LLMToolForgetResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';
import { logger } from 'shared/logger.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { resources } = toolInput as LLMToolForgetResourcesInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resources to forget:')}
        ${
		resources.map((resource) =>
			`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.resourcePath)} ` +
			`${LLMTool.TOOL_STYLES_CONSOLE.base.label('(Revision:')} ` +
			`${resource.revision})`
		).join('\n')
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Forget Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
			`Forgetting ${resources.length} resource${resources.length === 1 ? '' : 's'}`,
		),
		content,
		preview: `Forgetting ${resources.length} resource${resources.length === 1 ? '' : 's'}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolForgetResourcesResult['bbResponse'];
		const { resourcesSuccess, resourcesError } = data;

		const successContent = resourcesSuccess.length > 0
			? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Successfully removed:')}
        ${
				resourcesSuccess.map((resource) =>
					`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.resourcePath)} ` +
					`${LLMTool.TOOL_STYLES_CONSOLE.base.label('(Revision:')} ` +
					`${resource.revision})`
				).join('\n')
			}
    `
			: '';

		const errorContent = resourcesError.length > 0
			? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Failed to remove:')}
        ${
				resourcesError.map((resource) =>
					`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.resourcePath)} ` +
					`${LLMTool.TOOL_STYLES_CONSOLE.base.label('(Revision:')} ` +
					`${resource.revision}): ` +
					`${LLMTool.TOOL_STYLES_CONSOLE.status.error(resource.error)}`
				).join('\n')
			}
    `
			: '';

		const content = [successContent, errorContent].filter(Boolean).join('\n\n');

		const totalResources = resourcesSuccess.length + resourcesError.length;
		const successCount = resourcesSuccess.length;
		const subtitle = `${successCount} of ${totalResources} resource${totalResources === 1 ? '' : 's'} removed`;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Forget Resources'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
			content,
			preview: `${successCount} of ${totalResources} resources forgotten`,
		};
	} else {
		logger.error('LLMToolRenameResources: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Forget Resources'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Error forgetting resources',
		};
	}
}
