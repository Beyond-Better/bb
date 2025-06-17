import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';
import type { LLMToolApplyPatchInput, LLMToolApplyPatchResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { filePath, patch } = toolInput as LLMToolApplyPatchInput;
	const content = stripIndents`
    ${
		filePath
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('File to patch:')} ${
				LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePath)
			}`
			: LLMTool.TOOL_STYLES_CONSOLE.base.label('Multi-file patch')
	}
    
    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Patch:')}
    ${LLMTool.TOOL_STYLES_CONSOLE.content.code(patch)}
  `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Apply Patch'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(filePath ? 'Single file' : 'Multi-file'),
		content,
		preview: filePath ? `Patching ${filePath}` : 'Applying multi-file patch',
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolApplyPatchResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { modifiedFiles, newFiles } = bbResponse.data;
		const totalFiles = modifiedFiles.length + newFiles.length;

		const content = stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label(`✅ Patch applied successfully to ${totalFiles} file(s):`)}
      
      ${
			modifiedFiles.length > 0
				? modifiedFiles.map((file) => `📝 Modified: ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)}`)
					.join('\n')
				: ''
		}
      ${
			newFiles.length > 0
				? newFiles.map((file) => `📄 Created: ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)}`).join('\n')
				: ''
		}
    `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Apply Patch'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${totalFiles} files updated`),
			content,
			preview: `Modified ${modifiedFiles.length} files, created ${newFiles.length} files`,
		};
	} else {
		logger.error('LLMToolApplyPatch: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Apply Patch'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Operation failed',
		};
	}
};
