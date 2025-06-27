import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolMoveResourcesInput, LLMToolMoveResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { sources, destination, overwrite, createMissingDirectories } = toolInput as LLMToolMoveResourcesInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Moving resources:')}
        ${sources.map((source) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(source)}`).join('\n')}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('To destination:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.directory(destination)
	}
        
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Overwrite:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!overwrite, 'enabled/disabled')
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Create Missing Directories:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.boolean(!!createMissingDirectories, 'enabled/disabled')
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Move Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
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

	const successContent = data.resourcesMoved.length > 0
		? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Resources moved successfully:')}
        ${
			data.resourcesMoved.map((resource) =>
				`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource)} → ${
					LLMTool.TOOL_STYLES_CONSOLE.content.directory(data.destination)
				}`
			).join('\n')
		}
    `
		: '';

	const errorContent = data.resourcesError.length > 0
		? stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to move resources:')}
        ${
			data.resourcesError.map((resource) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource)}`).join(
				'\n',
			)
		}
    `
		: '';

	const content = [successContent, errorContent].filter(Boolean).join('\n\n');

	const totalResources = data.resourcesMoved.length + data.resourcesError.length;
	const successCount = data.resourcesMoved.length;
	const subtitle = `${successCount} of ${totalResources} resource${
		totalResources === 1 ? '' : 's'
	} moved to ${data.destination}`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Move Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
		content,
		preview: `Moved ${successCount} of ${totalResources} resource${totalResources === 1 ? '' : 's'}`,
	};
}
