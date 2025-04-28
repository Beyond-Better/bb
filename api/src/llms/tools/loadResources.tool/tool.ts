//import type { JSX } from 'preact';
import { StdUriTemplate } from '@std-uritemplate/std-uritemplate';

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
import type { LLMToolLoadResourcesInput } from './types.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { DataSourceHandlingErrorOptions, ToolHandlingErrorOptions } from 'api/errors/error.ts';
import { isToolHandlingError } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
//import type { ResourceType } from 'api/types.ts';
//import { extractResourceName } from 'api/utils/resource.ts';
import { logger } from 'shared/logger.ts';

export default class LLMToolLoadResources extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				mode: {
					type: 'string',
					enum: ['template', 'direct'],
					description:
						"Resource identification mode based on load_datasource results. Use 'template' when the data source provides URI templates, or 'direct' for complete URIs.",
					default: 'template',
				},
				uriTemplate: {
					type: 'string',
					description:
						"The URI template to use, as provided by load_datasource results. Required when mode is 'template'. Example: 'file://{path}' or 'database://{schema}{?query}'.",
				},
				templateResources: {
					type: 'array',
					items: {
						type: 'object',
						additionalProperties: true,
					},
					description:
						"Array of resource specifications using template variables from load_datasource results. Used when mode is 'template'. Each object's properties should match the variables in the URI template.",
				},
				directUris: {
					type: 'array',
					items: {
						type: 'string',
					},
					description:
						"Array of complete URIs from load_datasource results. Used when mode is 'direct'. Each string should be a complete resource URI as provided by load_datasource.",
				},
			},
			description: `Load resources using information returned from a previous load_datasource call.

IMPORTANT: Use load_datasource to learn about the resources available and their format before using the load_resources tool.

Two modes are supported based on the data source's capability:

1. TEMPLATE MODE (set mode: 'template'):
   - Used when load_datasource returns URI templates
   - Specify uriTemplate parameter if multiple templates are available
   - Provide templateResources matching the template variables
   
   Examples:
   
   For a file system with template 'filesystem-local:./{path}':
   {
     "mode": "template",
     "uriTemplate": "filesystem-local:./{path}",
     "templateResources": [
       { "path": "src/config.ts" },
       { "path": "tests/config.test.ts" }
     ]
   }
   
   For a database with template 'mcp-supabase://{schema}{?query}':
   {
     "mode": "template",
     "uriTemplate": "mcp-supabase://{schema}{?query}",
     "templateResources": [
       { "schema": "public", "query": "SELECT * FROM users LIMIT 10" },
       { "schema": "auth", "query": "SELECT * FROM users WHERE role='admin'" }
     ]
   }
   
   For an API with template 'api-service://{service}/{endpoint}{.format}':
   {
     "mode": "template",
     "uriTemplate": "api-service://{service}/{endpoint}{.format}",
     "templateResources": [
       { "service": "auth", "endpoint": "users", "format": "json" },
       { "service": "data", "endpoint": "metrics", "format": "csv" }
     ]
   }

2. DIRECT MODE (set mode: 'direct'):
   - Used when load_datasource returns complete resource URIs
   - Provide directUris exactly as returned by load_datasource
   
   Examples:
   
   For a collection of files:
   {
     "mode": "direct",
     "directUris": [
       "filesystem-local:./src/config.ts", 
       "filesystem-local:./package.json"
     ]
   }
   
   For mixed resource types:
   {
     "mode": "direct",
     "directUris": [
       "mcp-supabase://public?query=SELECT%20*%20FROM%20users",
       "api-service://auth/users.json",
       "filesystem-local:./config/database.yml"
     ]
   }

## Use relative paths for filesystem data sources.

# CORRECT filesystem URIs:
filesystem-local:./path/to/file.ts
filesystem-local:./project/site/routes/_middleware.ts
filesystem-local:./docs/readme.md

# When using the template pattern:
uriTemplate: "filesystem-local:./{path}"
templateResources: [{ "path": "project/site/routes/_middleware.ts" }]

# INCORRECT - Using web URI format with double slash:
filesystem-local://path/to/file.ts        ❌ Will try to access absolute path /path/to/file.ts
filesystem-local://project/site/file.ts   ❌ Will fail with "File not found: /project/site/file.ts"

# INCORRECT - Missing the dot in relative path:
filesystem-local:/path/to/file.ts         ❌ Missing the dot for relative paths
filesystem-local:/project/site/file.ts    ❌ Will also be treated as absolute

### Understanding Path Errors

When you see errors like:
"Failed to load resource: File not found: /site/routes/_middleware.ts"

Note the leading slash (/) indicates the system is trying to use an absolute path 
from the root directory. This typically means your URI format is incorrect.

Correct: filesystem-local:./project/site/routes/_middleware.ts
Incorrect: filesystem-local://project/site/routes/_middleware.ts


Always use load_datasource first to discover available resources and their URI formats.
Then use this tool to request specific resources to be added to the conversation.`,
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
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { mode, uriTemplate, templateResources, directUris, dataSourceId = undefined } =
			toolInput as LLMToolLoadResourcesInput;
		// 	dataSource?: string;
		// 	mode: 'template' | 'direct';
		// 	uriTemplate?: string;
		// 	templateResources?: Array<Record<string, string>>;
		// 	directUris?: string[];

		try {
			const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
				projectEditor,
				dataSourceId ? [dataSourceId] : undefined,
			);
			if (!primaryDsConnection) {
				throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
					name: 'data-source',
					dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
				} as DataSourceHandlingErrorOptions);
			}

			const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
			const dsConnectionToUseId = dsConnectionToUse.id;
			if (!dsConnectionToUseId) {
				throw createError(ErrorType.DataSourceHandling, `No data source id`, {
					name: 'data-source',
					dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
				} as DataSourceHandlingErrorOptions);
			}

			if (mode !== 'template' && mode !== 'direct') {
				throw createError(ErrorType.ToolHandling, `No mode`, {
					toolName: 'load_resources',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions);
			}
			//if (mode === 'template' && ((!uriTemplate && !dsConnectionToUse.uriTemplate) || !templateResources)) {
			if (mode === 'template' && (!uriTemplate || !templateResources)) {
				throw createError(
					ErrorType.ToolHandling,
					`Mode is template and no uriTemplate or templateResources provided`,
					{
						toolName: 'load_resources',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}
			if (mode === 'direct' && !directUris) {
				throw createError(ErrorType.ToolHandling, `Mode is direct and No directUris`, {
					toolName: 'load_resources',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions);
			}

			// logger.error(`LLMToolLoadResources: Tool Input: ${dataSourceId}`, {
			// 	mode,
			// 	uriTemplate,
			// 	templateResources,
			// 	directUris,
			// });
			const resourceUris = (mode === 'template'
				? templateResources!.map((data) => (decodeURIComponent(StdUriTemplate.expand(uriTemplate!, data))))
				: mode === 'direct'
				? (directUris || [])
				: []).map((uri) =>
					dsConnectionToUse.getUriForResource(uri)
				);
			//logger.error(`LLMToolLoadResources: resourceUris for: ${dataSourceId}`, { resourceUris });
			const resourcesAdded = await projectEditor.prepareResourcesForConversation(
				resourceUris,
			);

			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
			const resourcesSuccess: Array<{ name: string; uri: string }> = [];
			const resourcesError: Array<{ name: string; uri: string; error: string }> = [];
			let allResourcesFailed = true;

			for (const resourceToAdd of resourcesAdded) {
				if (resourceToAdd.metadata.error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error adding resource ${resourceToAdd.resourceUri}: ${resourceToAdd.metadata.error}`,
					});
					resourcesError.push({
						name: resourceToAdd.metadata.name || resourceToAdd.metadata.uri || resourceToAdd.resourceUri,
						uri: resourceToAdd.resourceUri,
						error: resourceToAdd.metadata.error,
					});
				} else {
					toolResultContentParts.push({
						'type': 'text',
						//'text': `Resource added: ${resourceToAdd.metadata.uri}`,
						'text': `Resource added: <${resourceToAdd.resourceUri}>`,
					});
					resourcesSuccess.push({
						name: resourceToAdd.metadata.name || resourceToAdd.metadata.uri || resourceToAdd.resourceUri,
						uri: resourceToAdd.resourceUri,
					});
					allResourcesFailed = false;
				}
			}

			const toolResponses = [];
			if (resourcesSuccess.length > 0) {
				toolResponses.push(
					`Added resources to the conversation:\n${resourcesSuccess.map((f) => `- ${f.name}`).join('\n')}`,
				);
			}
			if (resourcesError.length > 0) {
				toolResponses.push(
					`Failed to add resources to the conversation:\n${
						resourcesError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
					}`,
				);
			}

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`;
			toolResultContentParts.unshift({
				type: 'text',
				text: `Used data source: ${dsConnectionToUse.name}`,
			});

			const toolResults = toolResultContentParts;
			const toolResponse = dsConnectionStatus + '\n\n' + (allResourcesFailed ? 'No resources added\n' : '') +
				toolResponses.join('\n\n');
			const bbResponse = {
				data: {
					resourcesAdded: resourcesSuccess.map((f) => f.name),
					resourcesError: resourcesError.map((f) => f.name),

					dataSource: {
						dsConnectionId: dsConnectionToUse.id,
						dsConnectionName: dsConnectionToUse.name,
						dsProviderType: dsConnectionToUse.providerType,
					},
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
				finalizeCallback: (messageId) => {
					interaction.addResourcesForMessage(
						resourcesAdded,
						messageId,
						toolUse.toolUseId,
					);
				},
			};
		} catch (error) {
			let errorMessage: string;
			let toolInput: Record<string, unknown> | undefined;
			if (error instanceof Deno.errors.NotFound) {
				errorMessage = `Resource not found: ${error.message}`;
			} else if (error instanceof Deno.errors.PermissionDenied) {
				errorMessage = `Permission denied: ${error.message}`;
			} else if (isToolHandlingError(error)) {
				errorMessage = error.message;
				toolInput = error.options.toolInput;
			} else {
				errorMessage = (error as Error).message;
			}
			logger.error(`LLMToolLoadResources: Error adding resources to conversation: ${errorMessage}`, toolInput);

			const toolResults = `⚠️  ${errorMessage}`;
			const bbResponse = `BB failed to add resources. Error: ${errorMessage}`;
			const toolResponse = `Failed to add resources. Error: ${errorMessage}`;
			return { toolResults, toolResponse, bbResponse };

			// 			logger.error(`LLMToolLoadResources: Error adding resources to conversation: ${error.message}`);
			//
			// 			throw createError(
			// 				ErrorType.ResourceHandling,
			// 				`Error adding resources to conversation: ${error.message}`,
			// 				{
			// 					name: 'load-resources',
			// 					resourcePath: dataSourceRoot,
			// 					operation: 'load-resources',
			// 				},
			// 			);
		}
	}
}
