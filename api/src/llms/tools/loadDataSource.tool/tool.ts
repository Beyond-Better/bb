import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
//import type { PaginationInfo, ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { LLMToolLoadDatasourceInput } from './types.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { DataSourceHandlingErrorOptions } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

export default class LLMToolLoadDatasource extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceId: {
					type: 'string',
					description:
						'The name of the data source to retrieve resources from. Data sources are identified by their Name (e.g., "local", "notion-work") and ID (e.g., "xyz123", "mcp-supabase").',
				},
				path: {
					type: 'string',
					description:
						'Optional path filter to only return resources within a specific directory or matching a pattern.',
				},
				depth: {
					type: 'number',
					description: 'Optional depth for directory traversal. Default is 1 (immediate children only).',
				},
				pageSize: {
					type: 'number',
					description: 'Optional maximum number of resources to return per page.',
				},
				pageToken: {
					type: 'string',
					description: 'Optional token for pagination when retrieving large resource lists.',
				},
			},
			required: ['dataSourceId'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		logger.info(`LLMToolLoadDatasource: runTool input: `, { toolInput });
		const {
			dataSourceId,
			path,
			depth = 1,
			pageSize,
			pageToken,
		} = toolInput as LLMToolLoadDatasourceInput;

		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		if (!primaryDsConnection) {
			throw createError(ErrorType.DataSourceHandling, `Data source not found`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dsConnectionToLoad = dsConnections[0] || primaryDsConnection;
		const dsConnectionToLoadId = dsConnectionToLoad.id;
		if (!dsConnectionToLoadId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		try {
			// Check if data source supports listing
			if (!dsConnectionToLoad.provider.hasCapability('list')) {
				throw createError(
					ErrorType.DataSourceHandling,
					`Data source does not support listing: ${dsConnectionToLoadId}`,
					{
						name: 'load-datasource',
						dataSourceIds: [dsConnectionToLoadId],
					} as DataSourceHandlingErrorOptions,
				);
			}

			const resourceAccessor = await dsConnectionToLoad.getResourceAccessor();
			const resourcesResult = await resourceAccessor.listResources(
				{
					path,
					depth,
					pageSize,
					pageToken,
				},
			);

			const resources = resourcesResult.resources;
			const uriTemplate = resourcesResult.uriTemplate || dsConnectionToLoad.getUriForResource('file:./{path}');
			const uriExpression = 'path';
			const pagination = resourcesResult.pagination;

			// Generate the result content
			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dsConnectionToLoad.id}\nName: ${dsConnectionToLoad.name}\nType: ${dsConnectionToLoad.providerType}\nResource count: ${resources.length}`;

			// Add header information
			toolResultContentParts.push({
				'type': 'text',
				'text': dsConnectionStatus,
			});

			// Add resources
			if (resources.length > 0) {
				const resourcesWithMetadata = resources.map((r) => {
					// Start with the path (using uriTerm or uri)
					let entry = `- ${uriExpression ? uriExpression : 'uri'}: "${r.uriTerm || r.uri || r.uriTemplate}"`;
					if (r.uriTemplate) entry += `\n  uriTemplate: "${r.uriTemplate}"`;
					// Add each defined metadata property with proper indentation
					if (r.type) entry += `\n  type: "${r.extraType || r.type}"`;
					if (r.mimeType) entry += `\n  mimeType: "${r.mimeType}"`;
					if (r.size !== undefined && r.size !== null) entry += `\n  size: ${r.size}`;
					if (r.description) entry += `\n  description: "${r.description}"`;
					if (r.lastModified) {
						const formattedDate = r.lastModified instanceof Date
							? r.lastModified.toISOString()
							: r.lastModified;
						entry += `\n  lastModified: "${formattedDate}"`;
					}

					return entry;
				}).join('\n\n');
				toolResultContentParts.push({
					'type': 'text',
					'text': `${
						uriTemplate ? `URI Template: ${uriTemplate}\n` : ''
					}Resources:\n<resources>\n${resourcesWithMetadata}\n</resources>`,
				});
			} else {
				toolResultContentParts.push({
					'type': 'text',
					'text': '\nNo resources found.',
				});
			}

			// Add pagination info if present
			if (pagination?.nextPageToken) {
				toolResultContentParts.push({
					'type': 'text',
					'text': `\nPagination: More resources available. Use pageToken: ${pagination.nextPageToken}`,
				});
			}

			const toolResults = toolResultContentParts;
			const toolResponse = `Retrieved ${resources.length} resources from data source: ${dsConnectionToLoadId}`;
			const bbResponse = {
				data: {
					resources,
					uriTemplate,
					pagination,
					dataSource: {
						dsConnectionId: dsConnectionToLoadId,
						dsConnectionName: dsConnectionToLoad.name,
						dsProviderType: dsConnectionToLoad.providerType,
					},
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
			};
		} catch (error) {
			logger.error(
				`LLMToolLoadDatasource: Error loading resources from data source: ${(error as Error).message}`,
			);

			const toolResults = `⚠️ Error loading resources: ${(error as Error).message}`;
			const bbResponse = `BB failed to load resources from data source. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to load resources from data source. Error: ${(error as Error).message}`;

			return { toolResults, toolResponse, bbResponse };
		}
	}
}
