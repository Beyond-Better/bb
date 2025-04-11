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
import type { PaginationInfo, ResourceListItem } from 'api/resources/resourceManager.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
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
				dataSourceName: {
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
			required: ['dataSourceName'],
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
			dataSourceName,
			path,
			depth = 1,
			pageSize,
			pageToken,
		} = toolInput as LLMToolLoadDatasourceInput;

		const { primaryDataSource, dataSources, notFound } = this.getDataSources(
			projectEditor,
			dataSourceName ? [dataSourceName] : undefined,
		);
		if (!primaryDataSource) {
			throw createError(ErrorType.DataSourceHandling, `Data source not found`, {
				name: 'data-source',
				dataSourceIds: dataSourceName ? [dataSourceName] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dataSourceToLoad = dataSources[0] || primaryDataSource;
		const dataSourceToLoadId = dataSourceToLoad.id;
		if (!dataSourceToLoadId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'data-source',
				dataSourceIds: dataSourceName ? [dataSourceName] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		try {
			// Check if data source supports listing
			if (!dataSourceToLoad.canList()) {
				throw createError(
					ErrorType.DataSourceHandling,
					`Data source does not support listing: ${dataSourceToLoadId}`,
					{
						name: 'load-datasource',
						dataSourceIds: [dataSourceToLoadId],
					} as DataSourceHandlingErrorOptions,
				);
			}

			let resources: ResourceListItem[] = [];
			let uriTemplate: string | undefined;
			let uriExpression: string | undefined;
			let pagination: PaginationInfo | undefined;

			// Handle different types of data sources
			if (dataSourceToLoad.accessMethod === 'mcp') {
				// For MCP data sources, delegate to MCPManager
				if (!dataSourceToLoad.type) {
					logger.info(`LLMToolLoadDatasource: dataSourceToLoad: `, { dataSourceToLoad });
					throw createError(
						ErrorType.DataSourceHandling,
						`MCP data source missing server ID: ${dataSourceToLoadId}`,
						{
							name: 'load-datasource',
							dataSourceIds: [dataSourceToLoadId],
						} as DataSourceHandlingErrorOptions,
					);
				}

				const mcpServerId = dataSourceToLoad.type;
				const mcpManager = await getMCPManager();
				const mcpResources = await mcpManager.listResources(mcpServerId);

				resources = mcpResources.map((resource) => ({
					name: resource.name,
					uri: resource.uri,
					uriTemplate: resource.uriTemplate,
					type: resource.type || 'mcp',
					accessMethod: 'mcp',
					mimeType: resource.mimeType || 'text/plain',
					description: resource.description,
				}));
			} else {
				// For bb data sources (filesystem, etc.), use ResourceManager
				// Note: These methods don't exist yet and need to be implemented
				if (dataSourceToLoad.type === 'filesystem') {
					const dataSourceToLoadRoot = dataSourceToLoad.getDataSourceRoot();
					if (!dataSourceToLoadRoot) {
						throw createError(
							ErrorType.DataSourceHandling,
							`Data source has no root path: ${dataSourceToLoadId}`,
							{
								name: 'load-datasource',
								dataSourceIds: [dataSourceToLoadId],
							} as DataSourceHandlingErrorOptions,
						);
					}

					// This is a placeholder - the actual implementation doesn't exist yet
					const filesystemResult = await projectEditor.resourceManager.listFilesystem(
						dataSourceToLoadRoot,
						{
							path,
							depth,
							pageSize,
							pageToken,
						},
					);

					resources = filesystemResult.resources;
					uriTemplate = filesystemResult.uriTemplate || dataSourceToLoad.getUriForResource('file:./{path}');
					uriExpression = 'path';
					pagination = filesystemResult.pagination;
				} else {
					// This is a placeholder - the actual implementation doesn't exist yet
					const resourcesResult = await projectEditor.resourceManager.listResources(
						dataSourceToLoadId,
						{
							path,
							depth,
							pageSize,
							pageToken,
						},
					);

					resources = resourcesResult.resources;
					uriTemplate = resourcesResult.uriTemplate || dataSourceToLoad.getUriForResource('file:./{path}');
					uriExpression = 'path';
					pagination = resourcesResult.pagination;
				}
			}

			// Generate the result content
			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];

			const dataSourceStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dataSourceToLoad.id}\nName: ${dataSourceToLoad.name}\nType: ${dataSourceToLoad.type}\nResource count: ${resources.length}`;

			// Add header information
			toolResultContentParts.push({
				'type': 'text',
				'text': dataSourceStatus,
			});

			// Add resources
			if (resources.length > 0) {
				const resourcesWithMetadata = resources.map((r) => {
					// Start with the path (using uriTerm or uri)
					let entry = `- ${uriExpression ? uriExpression : 'uri'}: "${r.uriTerm || r.uri || r.uriTemplate}"`;
					if (r.uriTemplate) entry += `\n  uriTemplate: "${r.uriTemplate}"`;
					// Add each defined metadata property with proper indentation
					if (r.type) entry += `\n  type: "${r.type}"`;
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
			const toolResponse = `Retrieved ${resources.length} resources from data source: ${dataSourceToLoadId}`;
			const bbResponse = {
				data: {
					resources,
					uriTemplate,
					pagination,
					dataSourceId: dataSourceToLoadId,
					dataSourceName: dataSourceToLoad.name,
					dataSourceType: dataSourceToLoad.type,
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
