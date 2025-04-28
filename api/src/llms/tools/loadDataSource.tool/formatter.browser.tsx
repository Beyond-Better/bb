/** @jsxImportSource preact */
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolLoadDatasourceInput, LLMToolLoadDatasourceResponseData } from './types.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { dataSourceId, path, depth, pageSize, pageToken } = toolInput as LLMToolLoadDatasourceInput;

	// Build options list
	const optionsList = [];
	if (path) optionsList.push(`Path: ${path}`);
	if (depth !== undefined) optionsList.push(`Depth: ${depth}`);
	if (pageSize) optionsList.push(`Page Size: ${pageSize}`);
	if (pageToken) optionsList.push(`Page Token: ${pageToken}`);

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.content.status('running', 'Loading Data Source')}
			<div className='datasource-id'>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Data Source:')} {dataSourceId}
			</div>
			{optionsList.length > 0 && (
				<div className='datasource-options'>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Options:')}
					{LLMTool.TOOL_TAGS_BROWSER.base.list(
						optionsList.map((option, idx) => <span key={idx}>{option}</span>),
					)}
				</div>
			)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Load Data Source'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Listing resources from ${dataSourceId}`),
		content,
		preview: `Loading resources from data source: ${dataSourceId}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolLoadDatasourceResponseData;
		const resources = data.resources || [];

		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				<div className='datasource-info'>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Data Source:')} {data.dataSource.dsConnectionName}
					{' | '}
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Type:')} {data.dataSource.dsProviderType}
				</div>
				{resources.length > 0
					? (
						<div className='resources-container'>
							{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Resources Found')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list(
								resources.map((resource) => (
									<div className='resource-item'>
										{LLMTool.TOOL_TAGS_BROWSER.content.filename(resource.name || resource.uri)}{' '}
										{resource.description && (
											<span className='resource-description'>({resource.description})</span>
										)}
									</div>
								)),
							)}
						</div>
					)
					: (
						<div className='no-resources'>
							{LLMTool.TOOL_TAGS_BROWSER.content.status('warning', 'No Resources Found')}
						</div>
					)}
				{data.pagination?.nextPageToken && (
					<div className='pagination-info'>
						{LLMTool.TOOL_TAGS_BROWSER.content.status('warning', 'More Results Available')}
						<span>Use page token: {data.pagination.nextPageToken}</span>
					</div>
				)}
			</>,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${resources.length} resources found`),
			content,
			preview: `Found ${resources.length} resources in ${data.dataSource.dsConnectionName}`,
		};
	} else {
		logger.error('LLMToolLoadDatasource: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Error'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				LLMTool.TOOL_TAGS_BROWSER.content.status('failed', String(bbResponse)),
			),
			preview: 'Error loading data source resources',
		};
	}
};
