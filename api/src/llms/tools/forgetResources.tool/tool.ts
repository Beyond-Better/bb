//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions, ResourceHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { generateResourceRevisionKey } from 'shared/dataSource.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolForgetResourcesInput, LLMToolForgetResourcesResponseData } from './types.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';

export default class LLMToolForgetResources extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				resources: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							resourcePath: {
								type: 'string',
								description:
									'The path of the resource to be removed from the conversation context. When prompt caching is enabled, the resource remains in the cached context but should be mentally excluded from consideration.',
							},
							revision: {
								type: 'string',
								description:
									'The revision of the resource to be removed. This helps track which version of a resource is being excluded, especially important when resources have been modified during the conversation.',
							},
						},
						required: ['resourcePath', 'revision'],
					},
					description:
						`Array of resources to remove from the conversation context. Behavior depends on prompt caching:

1. When prompt caching is ENABLED:
   * Resources physically remain in the cached context
   * Mark resources as "Ignored" in your mental tracking
   * Do not reference or use ignored resources
   * Continue to track resource status changes
   Example: When asked to ignore tools_manifest.ts, maintain awareness that it exists but don't use its contents

2. When prompt caching is DISABLED:
   * Resources are physically removed from the context
   * Reduces token usage and context size
   * Resources can be re-added later if needed
   Example: Removing large resources that are no longer relevant to the current task`,
				},
			},
			required: ['resources'],
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
		const { resources, dataSourceId = undefined } = toolUse.toolInput as LLMToolForgetResourcesInput;
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

		try {
			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
			const resourcesSuccess: Array<{ resourceUri: string; resourcePath: string; revision: string }> = [];
			const resourcesError: Array<
				{ resourceUri: string; resourcePath: string; revision: string; error: string }
			> = [];
			let allResourcesFailed = true;

			for (const { resourcePath, revision } of resources) {
				const resourceUri = dsConnectionToUse.getUriForResource(`file:./${resourcePath}`);

				if (interaction.getResourceRevisionMetadata(generateResourceRevisionKey(resourceUri, revision))) {
					interaction.removeResource(generateResourceRevisionKey(resourceUri, revision));
					toolResultContentParts.push({
						'type': 'text',
						'text': `Resource removed: ${resourcePath} (Revision: ${revision})`,
					} as LLMMessageContentPartTextBlock);
					resourcesSuccess.push({ resourceUri, resourcePath, revision });
					allResourcesFailed = false;
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error removing resource ${resourcePath}: Resource is not in the conversation history`,
					} as LLMMessageContentPartTextBlock);
					resourcesError.push({
						resourceUri,
						resourcePath,
						revision,
						error: 'Resource is not in the conversation history',
					});
				}
			}

			const toolResponses = [];
			if (resourcesSuccess.length > 0) {
				toolResponses.push(
					`Removed resources from the conversation:\n${
						resourcesSuccess.map((f) => `- ${f.resourcePath} (Revision: ${f.revision})`).join('\n')
					}`,
				);
			}
			if (resourcesError.length > 0) {
				toolResponses.push(
					`Failed to remove resources from the conversation:\n${
						resourcesError.map((f) => `- ${f.resourcePath} (${f.revision}): ${f.error}`).join('\n')
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
			const toolResponse = `${dsConnectionStatus}\n\n` + (allResourcesFailed ? 'No resources removed\n' : '') +
				toolResponses.join('\n\n');
			const bbResponse: LLMToolForgetResourcesResponseData = {
				data: {
					resourcesSuccess,
					resourcesError,
					dataSource: {
						dsConnectionId: dsConnectionToUse.id,
						dsConnectionName: dsConnectionToUse.name,
						dsProviderType: dsConnectionToUse.providerType,
					},
				},
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(
				`LLMToolForgetResources: Error removing resources from conversation: ${(error as Error).message}`,
			);

			throw createError(
				ErrorType.ResourceHandling,
				`Error removing resources from conversation: ${(error as Error).message}`,
				{
					name: 'forget-resources',
					operation: 'forget-resources',
				} as ResourceHandlingErrorOptions,
			);
		}
	}
}
