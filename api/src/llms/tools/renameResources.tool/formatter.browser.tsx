/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRenameResourcesInput, LLMToolRenameResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { operations, createMissingDirectories, overwrite } = toolInput as LLMToolRenameResourcesInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Resources to rename:')}
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
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Rename Resources'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${operations.length} operations`),
		content,
		preview: `Renaming ${operations.length} resource${operations.length === 1 ? '' : 's'}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolRenameResourcesResult['bbResponse'];
		const { resourcesRenamed, resourcesError } = data;

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{resourcesRenamed.length > 0 && (
					<div className='mb-4'>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('completed')}
						{' Resources renamed successfully:'}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							resourcesRenamed.map((resource) => (
								<>
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.source)}
									{' → '}
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.destination)}
								</>
							)),
						)}
					</div>
				)}
				{resourcesError.length > 0 && (
					<div>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('failed')}
						{' Failed to rename:'}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							resourcesError.map((resource) => (
								<>
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.source)}
									{' → '}
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.destination)}
									{resource.error && (
										<>
											<br />
											{LLMTool.TOOL_TAGS_BROWSER.content.error(resource.error)}
										</>
									)}
								</>
							)),
						)}
					</div>
				)}
			</>,
		);

		const totalResources = resourcesRenamed.length + resourcesError.length;
		const successCount = resourcesRenamed.length;
		//const status = resourcesError.length > 0 ? 'failed' : 'completed';

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Rename Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
				`${successCount}/${totalResources} resources renamed successfully`,
			),
			content,
			preview: `${successCount} of ${totalResources} resources renamed`,
		};
	} else {
		logger.error('LLMToolRenameResources: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Rename Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				LLMTool.TOOL_TAGS_BROWSER.content.error(String(bbResponse)),
			),
			preview: 'Error renaming resources',
		};
	}
};
