import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRenameResourcesInput, LLMToolRenameResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { operations, createMissingDirectories, overwrite } = toolInput as LLMToolRenameResourcesInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resources to rename:')}
        ${
		operations.map((op) =>
			`${LLMTool.TOOL_STYLES_CONSOLE.content.filename(op.source)} → ${
				LLMTool.TOOL_STYLES_CONSOLE.content.filename(op.destination)
			}`
		).join('\n')
	}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Options:')}
        Overwrite: ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!overwrite, 'enabled/disabled')}
        Create Missing Directories: ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!createMissingDirectories, 'enabled/disabled')
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Rename Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${operations.length} operations`),
		content,
		preview: `Renaming ${operations.length} resource${operations.length === 1 ? '' : 's'}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolRenameResourcesResult['bbResponse'];
		const { resourcesRenamed, resourcesError } = data;

		const successContent = resourcesRenamed.length > 0
			? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Resources renamed successfully:')}
                ${
				resourcesRenamed.map((resource) =>
					`${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.source)} → ${
						LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.destination)
					}`
				).join('\n')
			}`
			: '';

		const errorContent = resourcesError.length > 0
			? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to rename:')}
                ${
				resourcesError.map((resource) =>
					`${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.source)} → ${
						LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.destination)
					}` +
					(resource.error ? `\n${LLMTool.TOOL_STYLES_CONSOLE.status.error(resource.error)}` : '')
				).join('\n\n')
			}`
			: '';

		const content = [successContent, errorContent].filter(Boolean).join('\n\n');
		const totalResources = resourcesRenamed.length + resourcesError.length;
		const successCount = resourcesRenamed.length;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rename Resources'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
				`${successCount}/${totalResources} resources renamed successfully`,
			),
			content,
			preview: `${successCount} of ${totalResources} resources renamed`,
		};
	} else {
		logger.error('LLMToolRenameResources: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Rename Resources'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Error renaming resources',
		};
	}
};
