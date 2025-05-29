//import type { JSX } from 'preact';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type {
	DataSourceHandlingErrorOptions,
	ResourceHandlingErrorOptions,
	ToolHandlingErrorOptions,
} from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
import type { LLMToolMoveResourcesInput } from './types.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';

export default class LLMToolMoveResources extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				sources: {
					type: 'array',
					items: { type: 'string' },
					description: `Array of resources to move, relative to data source root. Important notes:

1. Path Requirements:
   * All paths must be relative to data source root
   * Sources must exist and be within data source
   * Resource names are preserved during move
   Examples:
   * ["src/utils/old-location/helper.ts"]
   * ["tests/fixtures/data.json"]
   * ["docs/old-location"]

2. Common Move Patterns:
   * Move related resources together:
     ["src/components/Button.tsx", "src/components/Button.test.tsx"]
   * Move directory with contents:
     ["src/legacy-utils"]
   * Move multiple resources to new location:
     ["src/types/interfaces.ts", "src/types/constants.ts"]

3. Safety Considerations:
   * Check for import/require statements that reference moved resources
   * Update any relative imports in moved resources
   * Consider impact on data source structure
   * Move related resources together (source + test resources)`,
				},
				destination: {
					type: 'string',
					description: `Target directory for moved resources, relative to data source root. Important notes:

1. Directory Behavior:
   * Must be a directory path, not a file path
   * Resources maintain their original names
   * Creates nested path if createMissingDirectories is true
   Examples:
   * "src/utils/new-location"
   * "tests/new-fixtures"
   * "docs/archive"

2. Path Requirements:
   * Must be within data source
   * Parent directory must exist (unless createMissingDirectories is true)
   * Must have write permission`,
				},
				overwrite: {
					type: 'boolean',
					description:
						'When true, allows overwriting existing resources at destination. Use with caution as this can cause data loss. Example: If "utils/helper.ts" exists at destination, moving another "helper.ts" with overwrite:true will replace it.',
					default: false,
				},
				createMissingDirectories: {
					type: 'boolean',
					description:
						'When true, creates any missing directories in the destination path. Useful when moving resources to a new data source structure. Example: Moving to "new/nested/dir" will create all parent directories.',
					default: false,
				},
			},
			required: ['sources', 'destination'],
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
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const {
			sources,
			destination,
			overwrite = false,
			createMissingDirectories = false,
			dataSourceId = undefined,
		} = toolInput as LLMToolMoveResourcesInput;

		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		//logger.info(`LLMToolMoveResources: getDsConnections`, { primaryDsConnection, dsConnections, notFound });
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

		const dataSourceRoot = dsConnectionToUse.getDataSourceRoot();
		if (!dataSourceRoot) {
			throw createError(ErrorType.DataSourceHandling, `No data source root`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}
		//logger.info(`LLMToolMoveResources: dataSourceRoot: ${dataSourceRoot}`);
		// [TODO] check that dsConnectionToUse is type filesystem

		try {
			// Validate paths
			const destinationResourceUri = dsConnectionToUse.getUriForResource(`file:./${destination}`);
			if (!await dsConnectionToUse.isResourceWithinDataSource(destinationResourceUri)) {
				throw createError(
					ErrorType.ResourceHandling,
					`Access denied: ${destination} is outside the data source`,
					{
						name: 'move-resource',
						filePath: destination,
						operation: 'move',
					} as ResourceHandlingErrorOptions,
				);
			}

			const toolResultContentParts: LLMMessageContentParts = [];
			const movedSuccess: Array<{ name: string }> = [];
			const movedError: Array<{ name: string; error: string }> = [];
			let noResourcesMoved = true;

			const resourceAccessor = await dsConnectionToUse.getResourceAccessor();
			if (!resourceAccessor.moveResource) {
				throw createError(ErrorType.ToolHandling, `No moveResource method on resourceAccessor`, {
					toolName: 'move_resources',
					operation: 'tool-run',
				} as ToolHandlingErrorOptions);
			}

			for (const source of sources) {
				const sourceDesourceUri = dsConnectionToUse.getUriForResource(`file:./${source}`);
				if (!await dsConnectionToUse.isResourceWithinDataSource(sourceDesourceUri)) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error moving resource ${source}: Source path is outside the data source`,
					} as LLMMessageContentPartTextBlock);
					movedError.push({ name: source, error: 'Source path is outside the data source.' });
					continue;
				}

				try {
					const results = await resourceAccessor.moveResource(sourceDesourceUri, destinationResourceUri, {
						overwrite,
						createMissingDirectories,
					});
					// success: true,
					// sourceUri,
					// destinationUri,
					// metadata: resourceMetadata,
					if (!results.success) {
						throw createError(
							ErrorType.ResourceHandling,
							`Moving resource failed for ${source}`,
							{
								name: 'move-resource',
								filePath: source,
								operation: 'move',
							} as ResourceHandlingErrorOptions,
						);
					}

					toolResultContentParts.push({
						'type': 'text',
						'text': `Resource moved: ${source}`,
					} as LLMMessageContentPartTextBlock);
					movedSuccess.push({ name: source });
					noResourcesMoved = false;
				} catch (error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `${source}: ${(error as Error).message}`,
					} as LLMMessageContentPartTextBlock);
					movedError.push({ name: source, error: (error as Error).message });
				}
			}

			const movedResources = [];
			const movedContent = [];
			for (const moved of movedSuccess) {
				movedResources.push(moved.name);
				movedContent.push(`${moved.name} moved to ${destination}`);
			}
			await projectEditor.orchestratorController.logChangeAndCommit(
				interaction,
				dataSourceRoot,
				movedResources,
				movedContent,
			);

			const toolResponses = [];
			if (movedSuccess.length > 0) {
				toolResponses.push(
					`Moved resources to ${destination}:\n${movedSuccess.map((f) => `- ${f.name}`).join('\n')}`,
				);
			}
			if (movedError.length > 0) {
				toolResponses.push(
					`Failed to move resources to ${destination}:\n${
						movedError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
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
			const toolResponse = dsConnectionStatus + '\n\n' + (noResourcesMoved ? 'No resources moved\n' : '') +
				toolResponses.join('\n\n');
			const bbResponse = {
				data: {
					resourcesMoved: movedSuccess.map((f) => f.name),
					resourcesError: movedError.map((f) => f.name),
					destination,
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
			};
		} catch (error) {
			logger.error(`LLMToolMoveResources: Error moving resources: ${(error as Error).message}`);
			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to move resources. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to move resources. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
