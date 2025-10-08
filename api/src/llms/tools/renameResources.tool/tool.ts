import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMToolRenameResourcesInput, LLMToolRenameResourcesResult } from './types.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions, ToolHandlingErrorOptions } from 'api/errors/error.ts';
import { isResourceNotFoundError } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { checkDatasourceAccess } from 'api/utils/featureAccess.ts';
import { enhanceDatasourceError } from '../../../utils/datasourceErrorEnhancement.ts';

export default class LLMToolRenameResources extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase'). **IMPORTANT: Different data sources have different path format requirements - use loadDataSource with returnType='instructions' and operations=['utility'] or ['rename'] to get provider-specific rename guidance before using this tool.**",
				},
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							source: {
								type: 'string',
								description:
									'The current path of the resource to rename, relative to data source root. Must exist and be within data source. Examples:\n* "src/old-name.ts"\n* "tests/old_dir"\n* "config/legacy.json"',
							},
							destination: {
								type: 'string',
								description:
									'The new path for the resource, relative to data source root. Must be within data source. Parent directories will be created if createMissingDirectories is true. Examples:\n* "src/new-name.ts"\n* "tests/new_dir"\n* "config/current.json"',
							},
						},
						required: ['source', 'destination'],
					},
					description:
						`Array of rename operations to perform. **CRITICAL: Path format requirements vary by data source provider - load provider instructions first.**

1. **Provider-Specific Path Requirements**:
   * **Filesystem**: Standard relative paths like "src/file.ts", "tests/directory"
   * **Google**: Logical paths like "document/my-file", "spreadsheet/budget-2024"
   * **Notion**: Page paths like "page/meeting-notes", "database/project-tracker"
   * **Other providers**: Check provider documentation for specific formats

2. **General Path Requirements**:
   * All paths must be relative to data source root
   * Both source and destination must be within data source
   * Source must exist (unless overwrite is true)
   * Parent directories in destination path must exist (unless createMissingDirectories is true)

3. **Common Rename Patterns**:
   * File extension update: "file.js" -> "file.ts"
   * Name convention change: "oldName.ts" -> "new-name.ts"
   * Directory restructure: "old/path/file.ts" -> "new/path/file.ts"

4. **Safety Considerations**:
   * **ALWAYS load provider instructions first** using loadDataSource
   * Check for existing resources at destination
   * Consider impact on imports and references
   * Batch related renames together
   * Use overwrite with caution

5. **Examples of Batch Operations**:
   * Rename resource and its test:
     [
       { source: "src/handler.ts", destination: "src/processor.ts" },
       { source: "tests/handler.test.ts", destination: "tests/processor.test.ts" }
     ]
   * Move directory with contents:
     [
       { source: "old/config", destination: "new/config" }
     ]

**🚨 WORKFLOW REMINDER**: Use \`loadDataSource\` with \`returnType='instructions'\` and \`operations=['rename']\` or \`operations=['utility']\` to get detailed, provider-specific path format requirements and rename workflows before using this tool.`,
				},
				overwrite: {
					type: 'boolean',
					description:
						'When true, allows overwriting existing resources at destination paths. Use with caution as this can cause data loss. Default is false for safety.',
					default: false,
				},
				createMissingDirectories: {
					type: 'boolean',
					description:
						'When true, creates any missing parent directories in destination paths. Useful when restructuring data source layout. Example: "new/nested/dir/file.ts" will create all parent directories.',
					default: false,
				},
			},
			required: ['operations'],
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

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const {
			operations,
			overwrite = false,
			createMissingDirectories = false,
			dataSourceId = undefined,
		} = toolInput as LLMToolRenameResourcesInput;

		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		if (!primaryDsConnection) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
		const dsConnectionToUseId = dsConnectionToUse.id;
		if (!dsConnectionToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		// Check datasource write access
		const hasWriteAccess = await checkDatasourceAccess(
			projectEditor.userContext,
			dsConnectionToUse.providerType,
			'write',
		);
		if (!hasWriteAccess) {
			throw createError(
				ErrorType.ToolHandling,
				'Datasource write access not available on your current plan',
				{
					toolName: 'rename_resources',
					operation: 'capability-check',
				} as ToolHandlingErrorOptions,
			);
		}

		// [TODO] check that dsConnectionToUse is type filesystem

		const resourceAccessor = await dsConnectionToUse.getResourceAccessor();
		if (!resourceAccessor.renameResource) {
			throw createError(ErrorType.ToolHandling, `No renameResource method on resourceAccessor`, {
				toolName: 'rename_resources',
				operation: 'tool-run',
			} as ToolHandlingErrorOptions);
		}

		try {
			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
			const renamedSuccess: Array<{ source: string; destination: string }> = [];
			const renamedError: Array<{ source: string; destination: string; error: string }> = [];
			let noResourcesRenamed = true;

			for (const { source, destination } of operations) {
				const sourceResourceUri = dsConnectionToUse.getUriForResource(`file:./${source}`);
				const destinationResourceUri = dsConnectionToUse.getUriForResource(`file:./${destination}`);
				logger.debug(`LLMToolRenameResources: Renaming operation`, {
					source,
					destination,
					sourceResourceUri,
					destinationResourceUri,
					dataSourceType: dsConnectionToUse.providerType,
				});

				// Check source resource validation
				const sourceValid = await dsConnectionToUse.isResourceWithinDataSource(sourceResourceUri);
				const destinationValid = await dsConnectionToUse.isResourceWithinDataSource(destinationResourceUri);

				if (!sourceValid || !destinationValid) {
					let errorMessage = 'Source or destination path is outside the data source';
					if (!sourceValid && !destinationValid) {
						errorMessage =
							`Invalid URI format for both source (${source}) and destination (${destination})`;
					} else if (!sourceValid) {
						errorMessage = `Invalid URI format for source path: ${source}`;
					} else {
						errorMessage = `Invalid URI format for destination path: ${destination}`;
					}

					// Enhance error message with datasource-specific guidance
					const enhancedErrorMessage = enhanceDatasourceError(
						errorMessage,
						dsConnectionToUse.provider,
						'rename',
						source, // resource path for context
						interaction,
					);

					toolResultContentParts.push({
						type: 'text',
						text: `Error renaming resource ${source}: ${enhancedErrorMessage}`,
					} as LLMMessageContentPartTextBlock);
					renamedError.push({
						source,
						destination,
						error: enhancedErrorMessage,
					});
					continue;
				}

				try {
					// Use resource accessor to move/rename resource
					const results = await resourceAccessor.renameResource(sourceResourceUri, destinationResourceUri, {
						overwrite,
						createMissingDirectories,
					});
					if (!results.success) {
						throw new Error(`Move operation failed for ${source}`);
					}

					toolResultContentParts.push({
						type: 'text',
						text: `Resource renamed: ${source} -> ${destination}`,
					} as LLMMessageContentPartTextBlock);
					renamedSuccess.push({ source, destination });
					noResourcesRenamed = false;
				} catch (error) {
					toolResultContentParts.push({
						type: 'text',
						text: `${source}: ${(error as Error).message}`,
					} as LLMMessageContentPartTextBlock);
					renamedError.push({ source, destination, error: (error as Error).message });
				}
			}

			const renamedResources = [];
			const renamedContent = [];
			for (const renamed of renamedSuccess) {
				renamedResources.push(renamed.source);
				renamedContent.push(`${renamed.source} renamed to ${renamed.destination}`);
			}
			await projectEditor.orchestratorController.logChangeAndCommit(
				interaction,
				dsConnectionToUse.getDataSourceRoot(),
				renamedResources,
				renamedContent,
			);

			const toolResponses = [];
			if (renamedSuccess.length > 0) {
				toolResponses.push(
					`Renamed resources:\n${renamedSuccess.map((f) => `- ${f.source} -> ${f.destination}`).join('\n')}`,
				);
			}
			if (renamedError.length > 0) {
				toolResponses.push(
					`Failed to rename resources:\n${
						renamedError.map((f) => `- ${f.source} -> ${f.destination}: ${f.error}`).join('\n')
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
			const toolResponse = dsConnectionStatus + '\n\n' + (noResourcesRenamed ? 'No resources renamed\n' : '') +
				toolResponses.join('\n\n');
			const bbResponse: LLMToolRenameResourcesResult['bbResponse'] = {
				data: {
					resourcesRenamed: renamedSuccess,
					resourcesError: renamedError,
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
			logger.error(`LLMToolRenameResources: Error renaming resources: ${(error as Error).message}`);

			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to rename resources. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to rename resources. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
