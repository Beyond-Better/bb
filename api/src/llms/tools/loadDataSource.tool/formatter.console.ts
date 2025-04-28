import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolLoadDatasourceInput, LLMToolLoadDatasourceResponseData } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { dataSourceId, path, depth, pageSize, pageToken } = toolInput as LLMToolLoadDatasourceInput;

	// Build options list
	const optionsParts = [];
	if (path) optionsParts.push(`Path: ${path}`);
	if (depth !== undefined) optionsParts.push(`Depth: ${depth}`);
	if (pageSize) optionsParts.push(`Page Size: ${pageSize}`);
	if (pageToken) optionsParts.push(`Page Token: ${pageToken}`);

	const optionsText = optionsParts.length > 0
		? `\n${LLMTool.TOOL_STYLES_CONSOLE.base.label('Options:')}\n  ${optionsParts.join('\n  ')}`
		: '';

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Loading data source:')} ${dataSourceId}${optionsText}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Load Data Source'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Listing resources from ${dataSourceId}`),
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

		const contentParts = [];
		contentParts.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Data Source:')} ${data.dataSource.dsConnectionName} | ${
			LLMTool.TOOL_STYLES_CONSOLE.base.label('Type:')
		} ${data.dataSource.dsProviderType}
        `);

		if (resources.length > 0) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Resources Found:')}
                ${
				resources.map((resource) => {
					const description = resource.description ? ` (${resource.description})` : '';
					return `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource.name || resource.uri)}${description}`;
				}).join('\n')
			}
            `);
		} else {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.warning('No Resources Found')}
            `);
		}

		if (data.pagination?.nextPageToken) {
			contentParts.push(stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.warning('More Results Available:')}
                  Use page token: ${data.pagination.nextPageToken}
            `);
		}

		const content = contentParts.join('\n\n');

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${resources.length} resources found`),
			content,
			preview: `Found ${resources.length} resources in ${data.dataSource.dsConnectionName}`,
		};
	} else {
		logger.error('LLMToolLoadDatasource: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Load Data Source'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.content.status.failed(String(bbResponse)),
			preview: 'Error loading data source resources',
		};
	}
};
