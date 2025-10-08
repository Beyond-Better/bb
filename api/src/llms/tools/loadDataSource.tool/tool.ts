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
import type { InstructionFilters } from 'api/types/instructionFilters.ts';
import type { ContentTypeGuidance } from 'shared/types/dataSource.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { DataSourceHandlingErrorOptions } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

/**
 * ⚠️  CRITICAL: ALWAYS GET INSTRUCTIONS BEFORE EDITING
 *
 * Before performing ANY edit operations (edit_resource, write_resource), you MUST:
 * 1. Load data source with returnType="instructions" or returnType="combined"
 * 2. Read and understand the editing instructions for that specific data source type
 * 3. Follow the provider-specific guidance for operation structure and parameters
 *
 * Different data sources have different editing requirements:
 * - Google Docs: Range operations with 1-based indexing and specific formatting
 * - Filesystem: Search/replace operations with exact text matching
 * - Notion: Block operations with structured content and _key values
 *
 * Failure to follow provider-specific instructions will result in edit failures.
 */
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
				returnType: {
					type: 'string',
					enum: ['metadata', 'resources', 'both', 'instructions', 'combined'],
					description:
						'What to return: "metadata" (default) returns data source summary with capabilities and constraints, "resources" returns actual resource list, "both" returns metadata plus sample resources for immediate context, "instructions" returns detailed editing guidance with comprehensive examples, "combined" returns all information (metadata + resources + instructions). **IMPORTANT: Always get instructions before performing any edit operations.**',
				},
				instructionFilters: {
					type: 'object',
					description:
						'Optional filters to customize instruction content when returnType includes "instructions". If not provided, returns comprehensive instructions.',
					properties: {
						contentTypes: {
							type: 'array',
							items: {
								type: 'string',
								enum: ['documents', 'spreadsheets', 'files', 'databases', 'apis'],
							},
							description:
								'Filter instructions by content type. Example: ["documents"] for Google Docs only, ["spreadsheets"] for Google Sheets only, ["documents", "spreadsheets"] for both.',
						},
						operations: {
							type: 'array',
							items: {
								type: 'string',
								enum: ['create', 'edit', 'search', 'delete', 'move', 'rename', 'utility'],
							},
							description:
								'Filter instructions by operation type. Example: ["create"] for writing only, ["edit"] for editing only, ["utility"] for rename/move/remove operations.',
						},
						editTypes: {
							type: 'array',
							items: {
								type: 'string',
								enum: ['searchReplace', 'range', 'blocks', 'cell', 'structuredData'],
							},
							description:
								'Filter instructions by edit operation type. Example: ["searchReplace"] for text search/replace only, ["cell"] for spreadsheet operations only.',
						},
						sections: {
							type: 'array',
							items: {
								type: 'string',
								enum: [
									'workflows',
									'examples',
									'limitations',
									'bestPractices',
									'troubleshooting',
									'overview',
								],
							},
							description:
								'Filter instructions by section type. Example: ["workflows", "limitations"] for critical workflows and limitations only.',
						},
						includeOverview: {
							type: 'boolean',
							default: true,
							description:
								'Whether to include provider overview and capabilities. Set to false to exclude general information when you only need specific operation details.',
						},
					},
				},
				path: {
					type: 'string',
					description:
						'Optional path filter to only return resources within a specific directory or matching a pattern. Only used when returnType="resources".',
				},
				depth: {
					type: 'number',
					description:
						'Optional depth for directory traversal. Default is 1 (immediate children only). Only used when returnType="resources".',
				},
				pageSize: {
					type: 'number',
					description:
						'Optional maximum number of resources to return per page. Only used when returnType="resources".',
				},
				pageToken: {
					type: 'string',
					description:
						'Optional token for pagination when retrieving large resource lists. Only used when returnType="resources".',
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
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	/**
	 * Format content type guidance for display in tool results
	 * @param guidance ContentTypeGuidance object from provider
	 * @returns Formatted string for display
	 */
	private formatContentTypeGuidance(guidance: any): string {
		const { primaryContentType, acceptedContentTypes, acceptedEditTypes, preferredContentType, examples, notes } =
			guidance;

		let formatted = `\nContent Type Guidance:\n`;
		formatted += `Primary Type: ${primaryContentType}\n`;
		formatted += `Accepted Content Types: ${acceptedContentTypes.join(', ')}\n`;
		formatted += `Accepted Edit Types: ${acceptedEditTypes.join(', ')}\n`;
		formatted += `Preferred Content Type: ${preferredContentType}\n`;

		if (examples && examples.length > 0) {
			formatted += `\nUsage Examples:\n`;
			examples.forEach((example: any, index: number) => {
				formatted += `${index + 1}. ${example.description}\n`;
				formatted += `   Tool: ${example.toolCall.tool}\n`;
				const inputKeys = Object.keys(example.toolCall.input);
				if (inputKeys.length > 0) {
					formatted += `   Key Parameters:\n`;
					inputKeys.forEach((key) => {
						if (key !== 'resourcePath') {
							formatted += `     ${key}: ${typeof example.toolCall.input[key]}\n`;
						}
					});
				}
				formatted += `\n`;
			});
		}

		if (notes && notes.length > 0) {
			formatted += `Important Notes:\n`;
			notes.forEach((note: string, index: number) => {
				formatted += `• ${note}\n`;
			});
		}

		return formatted;
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
			returnType = 'metadata',
			instructionFilters,
			path,
			depth = 1,
			pageSize,
			pageToken,
		} = toolInput as LLMToolLoadDatasourceInput;

		//logger.error(`LLMToolLoadDatasource: Tool Input: ${dataSourceId}`, {
		//	returnType,
		//	path,
		//	depth,
		//	pageSize,
		//	pageToken,
		//});

		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		if (!primaryDsConnection) {
			throw createError(ErrorType.DataSourceHandling, `Data source not found`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dsConnectionToLoad = dsConnections[0] || primaryDsConnection;
		const dsConnectionToLoadId = dsConnectionToLoad.id;
		if (!dsConnectionToLoadId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}
		try {
			// Handle combined return type (all information)
			if (returnType === 'combined') {
				// Get the resource accessor to call getMetadata on it
				const resourceAccessor = await dsConnectionToLoad.getResourceAccessor();
				const metadata = await resourceAccessor.getMetadata();

				// Get content type guidance and detailed instructions from the provider
				const contentTypeGuidance = dsConnectionToLoad.provider.getContentTypeGuidance();
				const instructionsContent = dsConnectionToLoad.provider.getDetailedInstructions(instructionFilters);

				// Get a sample of resources
				const sampleSize = metadata.filesystem?.practicalLimits?.recommendedPageSize || 15;
				const resourcesResult = await resourceAccessor.listResources({
					path,
					depth: depth || 1,
					pageSize: Math.min(sampleSize, 20), // Cap at 20 for combined mode
					pageToken,
				});

				const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];

				const dsConnectionStatus = notFound.length > 0
					? `Could not find data source for: [${notFound.join(', ')}]`
					: `Data source: ${dsConnectionToLoad.id}\nName: ${dsConnectionToLoad.name}\nType: ${dsConnectionToLoad.providerType}`;

				// Add header information
				toolResultContentParts.push({
					'type': 'text',
					'text': dsConnectionStatus,
				});

				// Add metadata
				const metadataText = resourceAccessor.formatMetadata(metadata);
				toolResultContentParts.push({
					'type': 'text',
					'text': `\n## Metadata\n${metadataText}`,
				});

				// Add content type guidance
				toolResultContentParts.push({
					'type': 'text',
					'text': this.formatContentTypeGuidance(contentTypeGuidance),
				});

				// Add sample resources
				const resources = resourcesResult.resources;
				const uriTemplate = resourcesResult.uriTemplate ||
					dsConnectionToLoad.getUriForResource('file:./{path}');

				if (resources.length > 0) {
					const resourcesWithMetadata = resources.map((r) => {
						const uriExpression = 'path';
						let entry = `- ${uriExpression}: "${r.uriTerm || r.uri || r.uriTemplate}"`;
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
						'text': `\n## Sample Resources (${resources.length} of ${
							metadata.totalResources || 'unknown'
						})\nURI Template: ${uriTemplate}\n<resources>\n${resourcesWithMetadata}\n</resources>`,
					});

					if (resourcesResult.pagination?.nextPageToken) {
						toolResultContentParts.push({
							'type': 'text',
							'text':
								`\nMore resources available. Use returnType='resources' with pageToken: ${resourcesResult.pagination.nextPageToken}`,
						});
					}
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': '\n## Sample Resources\nNo resources found in sample.',
					});
				}

				// Add detailed instructions with emphasis
				toolResultContentParts.push({
					'type': 'text',
					'text': `\n## 🚨 IMPORTANT: Detailed Editing Instructions\n\n` +
						`**READ THESE INSTRUCTIONS BEFORE PERFORMING ANY EDIT OPERATIONS**\n\n` +
						`${instructionsContent}`,
				});

				const toolResults = toolResultContentParts;
				const toolResponse =
					`Retrieved complete information (metadata + resources + instructions) for data source: ${dsConnectionToLoadId}`;
				const bbResponse = {
					data: {
						metadata,
						contentTypeGuidance,
						instructions: instructionsContent,
						resources: resourcesResult.resources,
						uriTemplate: resourcesResult.uriTemplate,
						pagination: resourcesResult.pagination,
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
			}

			// Handle instructions return type
			if (returnType === 'instructions') {
				// Delegate to provider for detailed instructions
				const instructionsContent = dsConnectionToLoad.provider.getDetailedInstructions(instructionFilters);

				const toolResultContentParts: LLMMessageContentPartTextBlock[] = [{
					'type': 'text',
					'text':
						`Data source: ${dsConnectionToLoad.id}\nName: ${dsConnectionToLoad.name}\nType: ${dsConnectionToLoad.providerType}\n\n${instructionsContent}`,
				}];

				const toolResults = toolResultContentParts;
				const toolResponse = `Retrieved detailed editing instructions for data source: ${dsConnectionToLoadId}`;
				const bbResponse = {
					data: {
						instructions: instructionsContent,
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
			}

			// Handle metadata return type
			if (returnType === 'metadata' || returnType === 'both') {
				// Get the resource accessor to call getMetadata on it
				const resourceAccessor = await dsConnectionToLoad.getResourceAccessor();
				const metadata = await resourceAccessor.getMetadata();

				// Get content type guidance from the provider
				const contentTypeGuidance = dsConnectionToLoad.provider.getContentTypeGuidance();

				// For 'both' mode, also get a sample of resources
				let sampleResources;
				if (returnType === 'both') {
					// Use recommended page size from metadata or default to 15
					const sampleSize = metadata.filesystem?.practicalLimits?.recommendedPageSize || 15;
					const resourcesResult = await resourceAccessor.listResources({
						path,
						depth: depth || 1,
						pageSize: Math.min(sampleSize, 20), // Cap at 20 for 'both' mode
						pageToken,
					});
					sampleResources = resourcesResult;
				}

				// Generate the result content for metadata
				const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];

				const dsConnectionStatus = notFound.length > 0
					? `Could not find data source for: [${notFound.join(', ')}]`
					: `Data source: ${dsConnectionToLoad.id}\nName: ${dsConnectionToLoad.name}\nType: ${dsConnectionToLoad.providerType}`;

				// Add header information
				toolResultContentParts.push({
					'type': 'text',
					'text': dsConnectionStatus,
				});

				// Format metadata using the accessor's method
				const metadataText = resourceAccessor.formatMetadata(metadata);
				toolResultContentParts.push({
					'type': 'text',
					'text': `\nMetadata:\n${metadataText}`,
				});

				// Add content type guidance
				toolResultContentParts.push({
					'type': 'text',
					'text': this.formatContentTypeGuidance(contentTypeGuidance),
				});

				// Add sample resources if in 'both' mode
				if (returnType === 'both' && sampleResources) {
					const resources = sampleResources.resources;
					const uriTemplate = sampleResources.uriTemplate ||
						dsConnectionToLoad.getUriForResource('file:./{path}');

					if (resources.length > 0) {
						const resourcesWithMetadata = resources.map((r) => {
							const uriExpression = 'path';
							let entry = `- ${uriExpression}: "${r.uriTerm || r.uri || r.uriTemplate}"`;
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
							'text': `\nSample Resources (${resources.length} of ${
								metadata.totalResources || 'unknown'
							}):\nURI Template: ${uriTemplate}\n<resources>\n${resourcesWithMetadata}\n</resources>`,
						});

						if (sampleResources.pagination?.nextPageToken) {
							toolResultContentParts.push({
								'type': 'text',
								'text':
									`\nMore resources available. Use returnType='resources' with pageToken: ${sampleResources.pagination.nextPageToken}`,
							});
						}
					} else {
						toolResultContentParts.push({
							'type': 'text',
							'text': '\nNo resources found in sample.',
						});
					}
				}

				const toolResults = toolResultContentParts;
				const toolResponse = returnType === 'both'
					? `Retrieved metadata and sample resources for data source: ${dsConnectionToLoadId}`
					: `Retrieved metadata for data source: ${dsConnectionToLoadId}`;
				const bbResponse = {
					data: {
						metadata,
						contentTypeGuidance,
						...(sampleResources && {
							resources: sampleResources.resources,
							uriTemplate: sampleResources.uriTemplate,
							pagination: sampleResources.pagination,
						}),
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
			}

			// Handle resources return type (existing logic)
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
