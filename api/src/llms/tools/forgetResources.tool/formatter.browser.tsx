/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolForgetResourcesInput, LLMToolForgetResourcesResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { resources } = toolInput as LLMToolForgetResourcesInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Resources to forget:')}
			{LLMTool.TOOL_TAGS_BROWSER.base.list(
				resources.map((resource) => (
					<>
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.resourcePath)}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.label('(Revision:')} {resource.revision}
						{')'}
					</>
				)),
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Forget Resources'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
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

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{resourcesSuccess.length > 0 && (
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Successfully removed:')}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							resourcesSuccess.map((resource) => (
								<>
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.resourcePath)}{' '}
									{LLMTool.TOOL_TAGS_BROWSER.base.label('(Revision:')} {resource.revision}
									{')'}
								</>
							)),
						)}
					</>
				)}
				{resourcesError.length > 0 && (
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Failed to remove:')}
						{LLMTool.TOOL_TAGS_BROWSER.base.list(
							resourcesError.map((resource) => (
								<>
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.resourcePath)}{' '}
									{LLMTool.TOOL_TAGS_BROWSER.base.label('(Revision:')} {resource.revision}
									{')'}
									{': '}
									{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', resource.error)}
								</>
							)),
						)}
					</>
				)}
			</>,
		);

		const totalResources = resourcesSuccess.length + resourcesError.length;
		const successCount = resourcesSuccess.length;
		const subtitle = `${successCount} of ${totalResources} resource${totalResources === 1 ? '' : 's'} removed`;

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Forget Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
			content,
			preview: `${successCount} of ${totalResources} resources forgotten`,
		};
	} else {
		logger.error('LLMToolForgetResources: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Forget Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				LLMTool.TOOL_TAGS_BROWSER.content.error(String(bbResponse)),
			),
			preview: 'Error forgetting resources',
		};
	}
}
