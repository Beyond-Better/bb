import type { LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRemoveFilesInput, LLMToolRemoveFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';

export function formatLogEntryToolUse(
	toolInput: LLMToolRemoveFilesInput,
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
			LLMTool.TOOL_STYLES_CONSOLE.content.number(acknowledgement.fileCount)
		} items
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('  Text:')} ${acknowledgement.acknowledgement}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Verified Items:')}
            ${
			acknowledgement.files.map((file) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)}`).join('\n')
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
			isPermanentDelete ? 'Remove Files (Permanent)' : 'Remove Files (Trash)',
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
	const { bbResponse } = resultContent as unknown as LLMToolRemoveFilesResult;
	const { data } = bbResponse;

	const isPermanentDelete = !data.filesRemoved.some((f) => f.destination);

	const successContent = data.filesRemoved.length > 0
		? stripIndents`
            ${
			LLMTool.TOOL_STYLES_CONSOLE.content.status[isPermanentDelete ? 'error' : 'completed'](
				isPermanentDelete ? '🔥 Items permanently deleted:' : '✅ Items moved to trash:',
			)
		}
            ${
			data.filesRemoved.map((item) => {
				const icon = item.isDirectory ? '📁' : '📄';
				return `  ${icon} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(item.name)}${
					item.destination ? ` → ${LLMTool.TOOL_STYLES_CONSOLE.content.directory(item.destination)}` : ''
				}`;
			}).join('\n')
		}${
			isPermanentDelete && data.filesRemoved.some((item) => item.isDirectory)
				? `\n\n${
					LLMTool.TOOL_STYLES_CONSOLE.content.status.warning(
						'Note: Directories were deleted with all their contents',
					)
				}`
				: ''
		}`
		: '';

	const errorContent = data.filesError.length > 0
		? stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed to remove:')}
            ${
			data.filesError.map((file) =>
				`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.name)}: ${
					LLMTool.TOOL_STYLES_CONSOLE.content.status.error(file.error)
				}`
			).join('\n')
		}`
		: '';

	const content = [successContent, errorContent].filter(Boolean).join('\n\n');

	const totalItems = data.filesRemoved.length + data.filesError.length;
	const successCount = data.filesRemoved.length;
	const subtitle = `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} ${
		isPermanentDelete ? 'deleted' : 'moved to trash'
	}`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Remove Files'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
		content,
		preview: `${successCount} of ${totalItems} item${totalItems === 1 ? '' : 's'} removed`,
	};
}
