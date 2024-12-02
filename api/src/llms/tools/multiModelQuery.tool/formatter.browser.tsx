/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolMultiModelQueryInput, LLMToolMultiModelQueryResult } from './types.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { query, models } = toolInput as LLMToolMultiModelQueryInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Query:')} {query}
			<div className='mt-2'>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Models:')}{'  '}{LLMTool.TOOL_TAGS_BROWSER.base.list(models)}
			</div>
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Multi Model Query'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Querying ${models.length} models`),
		content,
		preview: `Querying ${models.length} models with prompt`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolMultiModelQueryResult['bbResponse'];

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{data.querySuccess.length > 0 && (
					<div>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Successful Queries')}
						{data.querySuccess.map((query, index) => (
							<div key={index} className='mt-4'>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Model:')}{'  '}
								{LLMTool.TOOL_TAGS_BROWSER.content.toolName(query.modelIdentifier)}
								<div className='mt-2 p-4 bg-gray-50 rounded-lg'>
									{LLMTool.TOOL_TAGS_BROWSER.base.pre(query.answer)}
								</div>
							</div>
						))}
					</div>
				)}
				{data.queryError.length > 0 && (
					<div className='mt-4'>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('failed', 'Failed Queries')}
						{data.queryError.map((query, index) => (
							<div key={index} className='mt-4'>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Model:')}{'  '}
								{LLMTool.TOOL_TAGS_BROWSER.content.toolName(query.modelIdentifier)}
								<div className='mt-2 p-4 bg-red-50 rounded-lg text-red-700'>
									{query.error}
								</div>
							</div>
						))}
					</div>
				)}
			</>,
		);

		const successCount = data.querySuccess.length;
		const errorCount = data.queryError.length;
		const subtitle = `${successCount} successful, ${errorCount} failed`;

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Multi Model Query'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(subtitle),
			content,
			preview: `${successCount} models queried, ${errorCount} failed`,
		};
	} else {
		logger.error('LLMToolMultiModelQuery: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Multi Model Query'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				<div className='text-red-700'>
					Unexpected response format
				</div>,
			),
			preview: 'Error: Invalid response format',
		};
	}
};
