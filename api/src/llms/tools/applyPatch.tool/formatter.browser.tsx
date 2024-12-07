/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import type { LLMToolApplyPatchInput, LLMToolApplyPatchResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { filePath, patch } = toolInput as LLMToolApplyPatchInput;
	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{filePath
				? LLMTool.TOOL_TAGS_BROWSER.base.container(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('File to patch:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(filePath)}
					</>,
				)
				: LLMTool.TOOL_TAGS_BROWSER.base.container(
					LLMTool.TOOL_TAGS_BROWSER.base.label('Multi-file patch'),
				)}
			{LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Patch:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.pre(patch)}
				</>,
			)}
		</>,
		`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Apply Patch'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(filePath ? 'Single file' : 'Multi-file'),
		content,
		preview: filePath ? `Patching ${filePath}` : 'Applying multi-file patch',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolApplyPatchResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { modifiedFiles, newFiles } = bbResponse.data;
		const totalFiles = modifiedFiles.length + newFiles.length;

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.container(
					LLMTool.TOOL_TAGS_BROWSER.base.label(`✅ Patch applied successfully to ${totalFiles} file(s):`),
				)}
				{modifiedFiles.length > 0 && LLMTool.TOOL_TAGS_BROWSER.base.list(
					modifiedFiles.map((file) => (
						<>
							📝 Modified: {LLMTool.TOOL_TAGS_BROWSER.content.filename(file)}
						</>
					)),
				)}
				{newFiles.length > 0 && LLMTool.TOOL_TAGS_BROWSER.base.list(
					newFiles.map((file) => (
						<>
							📄 Created: {LLMTool.TOOL_TAGS_BROWSER.content.filename(file)}
						</>
					)),
				)}
			</>,
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.success}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Apply Patch'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${totalFiles} files updated`),
			content,
			preview: `Modified ${modifiedFiles.length} files, created ${newFiles.length} files`,
		};
	} else {
		logger.error('LLMToolApplyPatch: Unexpected bbResponse format:', bbResponse);
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse)),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Apply Patch'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content,
			preview: 'Operation failed',
		};
	}
};
