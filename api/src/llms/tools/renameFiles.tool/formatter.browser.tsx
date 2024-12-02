/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRenameFilesInput, LLMToolRenameFilesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { operations, createMissingDirectories, overwrite } = toolInput as LLMToolRenameFilesInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Files to rename:')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				operations.map((op) => (
					<>
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(op.source)}
						{' → '}
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(op.destination)}
					</>
				)),
			)}
			<div className='mt-2'>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Options:')}
				<div className='ml-4'>
					Overwrite: {LLMTool.TOOL_TAGS_BROWSER.content.boolean(!!overwrite, 'enabled/disabled')}
					<br />
					Create Missing Directories:{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.boolean(!!createMissingDirectories, 'enabled/disabled')}
				</div>
			</div>
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Rename Files'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${operations.length} operations`),
		content,
		preview: `Renaming ${operations.length} file${operations.length === 1 ? '' : 's'}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolRenameFilesResult['bbResponse'];
		const { filesRenamed, filesError } = data;

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{filesRenamed.length > 0 && (
					<div className='mb-4'>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('completed')}
						{' Files renamed successfully:'}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							filesRenamed.map((file) => (
								<>
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.source)}
									{' → '}
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.destination)}
								</>
							)),
						)}
					</div>
				)}
				{filesError.length > 0 && (
					<div>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('failed')}
						{' Failed to rename:'}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							filesError.map((file) => (
								<>
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.source)}
									{' → '}
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(file.destination)}
									{file.error && (
										<>
											<br />
											{LLMTool.TOOL_TAGS_BROWSER.content.error(file.error)}
										</>
									)}
								</>
							)),
						)}
					</div>
				)}
			</>,
		);

		const totalFiles = filesRenamed.length + filesError.length;
		const successCount = filesRenamed.length;
		//const status = filesError.length > 0 ? 'failed' : 'completed';

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Rename Files'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
				`${successCount}/${totalFiles} files renamed successfully`,
			),
			content,
			preview: `${successCount} of ${totalFiles} files renamed`,
		};
	} else {
		logger.error('LLMToolRenameFiles: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Rename Files'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				LLMTool.TOOL_TAGS_BROWSER.content.error(String(bbResponse)),
			),
			preview: 'Error renaming files',
		};
	}
};
