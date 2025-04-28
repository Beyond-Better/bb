import type { LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRemoveResourcesInput, LLMToolRemoveResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';

export function formatLogEntryToolUse(
	toolInput: LLMToolRemoveResourcesInput,
): LLMToolLogEntryFormattedResult {
	const { sources, acknowledgement } = toolInput;
	const isPermanentDelete = acknowledgement !== undefined;

	const warningContent = isPermanentDelete && acknowledgement?.hasDirectories
		? `\n${
			LLMTool.TOOL_STYLES_CONSOLE.content.status.warning(
				'⚠️  WARNING: Includes directories - all contents will be deleted!',
			)
		}`
		: '';

	const acknowledgeContent = isPermanentDelete && acknowledgement
		? stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Acknowledgement:')}
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('  Count:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.number(acknowledgement.resourceCount)
		} items
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('  Text:')} ${acknowledgement.acknowledgement}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Verified Items:')}
            ${
			acknowledgement.resources.map((resource) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource)}`).join('\n')
		}`
		: '';

	const content = stripIndents`
        ${
		LLMTool.TOOL_STYLES_CONSOLE.content.status[isPermanentDelete ? 'error' : 'warning'](
			isPermanentDelete ? '🔥 PERMANENTLY DELETING:' : '🗑️  Moving to trash:',
		)
	}

        ${
		sources.map((source) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(source)}`).join('\n')
	}${warningContent}

        ${acknowledgeContent}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title(
			'Tool Use',
			isPermanentDelete ? 'Remove Resources (Permanent)' : 'Remove Resources (Trash)',
		),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
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

	const successContent = data.resourcesRemoved.length > 0
		? stripIndents`
            ${
			LLMTool.TOOL_STYLES_CONSOLE.content.status[isPermanentDelete ? 'error' : 'completed'](
				isPermanentDelete ? '🔥 Items permanently deleted:' : '✅ Items moved to trash:',
			)
		}
            ${
			data.resourcesRemoved.map((item) => {
				const icon = item.isDirectory ? '📁' : '📄';
				return `  ${icon} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(item.name)}${
					item.destination ? ` → ${LLMTool.TOOL_STYLES_CONSOLE.content.directory(item.destination)}` : ''
				}`;
			}).join('\n')
		}${
			isPermanentDelete && data.resourcesRemoved.some((item) => item.isDirectory)
				? `\n\n${
					LLMTool.TOOL_STYLES_CONSOLE.content.status.warning(
						'Note: Directories were deleted with all their contents',
					)
				}`
				: ''
		}`
		: '';

	const errorContent = data.resourcesError.length > 0
		? stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to remove:')}
            ${
			data.resourcesError.map((resource) =>
				`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.name)}: ${
					LLMTool.TOOL_STYLES_CONSOLE.content.status.error(resource.error)
				}`
			).join('\n')
		}`
		: '';

	const content = [successContent, errorContent].filter(Boolean).join('\n\n');

	const totalItems = data.resourcesRemoved.length + data.resourcesError.length;
	const successCount = data.resourcesRemoved.length;
	const subtitle = `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} ${
		isPermanentDelete ? 'deleted' : 'moved to trash'
	}`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Remove Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
		content,
		preview: `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} removed`,
	};
}
