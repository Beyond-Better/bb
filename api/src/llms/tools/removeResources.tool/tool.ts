//import type { JSX } from 'preact';
import { basename, dirname, join } from '@std/path';
import { ensureDir, exists } from '@std/fs';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type {
	DataSourceHandlingErrorOptions,
	ResourceHandlingErrorOptions,
	ToolHandlingErrorOptions,
} from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

import type {
	LLMToolRemoveResourcesConfig,
	LLMToolRemoveResourcesInput,
	LLMToolRemoveResourcesResponseData,
	RemoveResourcesAcknowledgement,
} from './types.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';

// Hardcoded protected paths that cannot be deleted
const PROTECTED_PATHS = ['.trash', '.git'];

export default class LLMToolRemoveResources extends LLMTool {
	private config: LLMToolRemoveResourcesConfig;

	constructor(name: string, description: string, toolConfig: LLMToolRemoveResourcesConfig) {
		super(name, description, toolConfig);
		this.config = {
			dangerouslyDeletePermanently: false,
			trashDir: '.trash',
			maxResourcesPerOperation: 50,
			protectedPaths: ['node_modules'],
			trashNamingStrategy: 'increment',
			...toolConfig,
		};
	}

	get inputSchema(): LLMToolInputSchema {
		const schema: {
			type: 'object';
			properties: { dataSourceId?: unknown; sources: unknown; acknowledgement?: unknown };
			required: string[];
		} = {
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
					description: 'Array of resource paths to remove. Important notes:\n' +
						'* For files: The individual file will be removed\n' +
						'* For directories: The directory AND ALL ITS CONTENTS will be removed recursively\n' +
						'* All paths must be relative to data source root and within the data source directory\n' +
						'* Protected paths (.trash, .git, etc.) cannot be removed',
				},
			},
			required: ['sources'],
		};

		// Only add acknowledgement requirement if permanent deletion is enabled
		if (this.config.dangerouslyDeletePermanently) {
			schema.properties.acknowledgement = {
				type: 'object',
				description: 'Required for permanent deletion. Must include exact count and list matching sources.',
				properties: {
					resourceCount: {
						type: 'number',
						description: 'Must exactly match the number of items in the sources array.',
					},
					resources: {
						type: 'array',
						items: { type: 'string' },
						description: 'Must exactly match the resources listed in the sources array, in any order.',
					},
					hasDirectories: {
						type: 'boolean',
						description:
							'Must be true if any of the sources are directories. Requires special acknowledgement text.',
					},
					acknowledgement: {
						type: 'string',
						description: 'Must be exactly one of:\n' +
							'* For files only: "I confirm permanent deletion of {resourceCount} files with no recovery possible"\n' +
							'* When directories included: "I confirm permanent deletion of {resourceCount} files/directories and all contents with no recovery possible"\n' +
							'where {resourceCount} matches the number of items.',
					},
				},
				required: ['resourceCount', 'resources', 'hasDirectories', 'acknowledgement'],
			};
			schema.required.push('acknowledgement');
		}

		return schema as LLMToolInputSchema;
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolUseConsole(toolInput as LLMToolRemoveResourcesInput)
			: formatLogEntryToolUseBrowser(toolInput as LLMToolRemoveResourcesInput);
	}

	formatLogEntryToolResult(
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	private async checkIsDirectory(dataSourceRoot: string, path: string): Promise<boolean> {
		try {
			const stat = await Deno.stat(join(dataSourceRoot, path));
			return stat.isDirectory;
		} catch {
			return false;
		}
	}

	private async validateAcknowledgement(
		acknowledgement: RemoveResourcesAcknowledgement,
		sources: string[],
		dataSourceRoot: string,
	): Promise<void> {
		// Validate resource count
		if (acknowledgement.resourceCount !== sources.length) {
			throw createError(
				ErrorType.ToolHandling,
				`Resource count mismatch: acknowledgement specifies ${acknowledgement.resourceCount} items but ${sources.length} items were provided`,
				{
					name: 'remove-resources',
					toolName: 'remove_resources',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		// Validate resource list matches exactly
		const sourcesSet = new Set(sources);
		const acknowledgedSet = new Set(acknowledgement.resources);

		if (sourcesSet.size !== acknowledgedSet.size) {
			throw createError(
				ErrorType.ToolHandling,
				'Resource list mismatch: acknowledged items do not match source items',
				{
					name: 'remove-resources',
					toolName: 'remove_resources',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		for (const resource of sourcesSet) {
			if (!acknowledgedSet.has(resource)) {
				throw createError(
					ErrorType.ToolHandling,
					`Resource list mismatch: ${resource} is in sources but not in acknowledgement`,
					{
						name: 'remove-resources',
						toolName: 'remove_resources',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}
		}

		// Check if any sources are directories
		const hasDirectories = await Promise.all(
			sources.map((source) => this.checkIsDirectory(dataSourceRoot, source)),
		).then((results) => results.some(Boolean));

		// Validate hasDirectories flag
		if (hasDirectories !== acknowledgement.hasDirectories) {
			throw createError(
				ErrorType.ToolHandling,
				hasDirectories
					? 'Directory detected but hasDirectories is false. Directories require explicit acknowledgement.'
					: 'hasDirectories is true but no directories were found in sources.',
				{
					name: 'remove-resources',
					toolName: 'remove_resources',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		// Validate acknowledgement text
		const expectedText = hasDirectories
			? `I confirm permanent deletion of ${acknowledgement.resourceCount} files/directories and all contents with no recovery possible`
			: `I confirm permanent deletion of ${acknowledgement.resourceCount} files with no recovery possible`;

		if (acknowledgement.acknowledgement.trim() !== expectedText) {
			throw createError(
				ErrorType.ToolHandling,
				`Invalid acknowledgement text. Must be exactly:\n"${expectedText}"`,
				{
					name: 'remove-resources',
					toolName: 'remove_resources',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}
	}

	private isProtectedPath(path: string): boolean {
		const normalizedPath = path.toLowerCase();
		// Check hardcoded protected paths
		for (const protectedPath of PROTECTED_PATHS) {
			if (normalizedPath === protectedPath || normalizedPath.startsWith(`${protectedPath}/`)) {
				return true;
			}
		}
		// Check configured protected paths
		for (const protectedPath of this.config.protectedPaths || []) {
			if (normalizedPath === protectedPath || normalizedPath.startsWith(`${protectedPath}/`)) {
				return true;
			}
		}
		return false;
	}

	private async generateTrashPath(
		dataSourceRoot: string,
		originalPath: string,
	): Promise<string> {
		const trashDir = this.config.trashDir || '.trash';
		const resourceName = basename(originalPath);
		const baseTrashPath = join(trashDir, resourceName);

		// this.config.trashNamingStrategy === 'timestamp'
		// timestamp strategy always gets suffix
		// If there's a conflict, use the configured naming strategy
		if (this.config.trashNamingStrategy === 'timestamp') {
			const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace(/T/g, '_');
			const [name, ...extensions] = resourceName.split('.');
			const newName = extensions.length > 0
				? `${name}_${timestamp}.${extensions.join('.')}`
				: `${name}_${timestamp}`;
			return join(trashDir, newName);
		}

		// this.config.trashNamingStrategy === 'increment'
		// First try the original name - only for increment strategy
		if (!await exists(join(dataSourceRoot, baseTrashPath))) {
			return baseTrashPath;
		}

		// Increment strategy
		let index = 1;
		let trashPath = baseTrashPath;
		while (await exists(join(dataSourceRoot, trashPath))) {
			const [name, ...extensions] = resourceName.split('.');
			const newName = extensions.length > 0 ? `${name}_${index}.${extensions.join('.')}` : `${name}_${index}`;
			trashPath = join(trashDir, newName);
			index++;
		}
		return trashPath;
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { sources, acknowledgement, dataSourceId = undefined } = toolInput as LLMToolRemoveResourcesInput;

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

		const dataSourceRoot = dsConnectionToUse.getDataSourceRoot();
		if (!dataSourceRoot) {
			throw createError(ErrorType.DataSourceHandling, `No data source root`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}
		// [TODO] check that dsConnectionToUse is type filesystem

		try {
			// Validate number of resources
			if (sources.length > (this.config.maxResourcesPerOperation || 50)) {
				throw createError(
					ErrorType.ToolHandling,
					`Too many items: ${sources.length} exceeds maximum of ${this.config.maxResourcesPerOperation}`,
					{
						name: 'remove-resources',
						toolName: 'remove_resources',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}

			// Check if permanent deletion is enabled and validate acknowledgement
			if (this.config.dangerouslyDeletePermanently) {
				if (!acknowledgement) {
					throw createError(
						ErrorType.ToolHandling,
						'Acknowledgement required for permanent deletion',
						{
							name: 'remove-resources',
							toolName: 'remove_resources',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				await this.validateAcknowledgement(acknowledgement, sources, dataSourceRoot);
			} else if (acknowledgement) {
				// If permanent deletion is disabled, acknowledgement should not be provided
				throw createError(
					ErrorType.ToolHandling,
					'Acknowledgement provided but permanent deletion is not enabled in tool configuration',
					{
						name: 'remove-resources',
						toolName: 'remove_resources',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}

			// Ensure trash directory exists if needed
			if (!this.config.dangerouslyDeletePermanently) {
				const trashDir = join(dataSourceRoot, this.config.trashDir || '.trash');
				try {
					await ensureDir(trashDir);
				} catch (error) {
					throw createError(
						ErrorType.ResourceHandling,
						`Failed to create trash directory: ${(error as Error).message}`,
						{
							name: 'remove-resources',
							filePath: trashDir,
							operation: 'create-dir',
						} as ResourceHandlingErrorOptions,
					);
				}
			}

			const toolResultContentParts: LLMMessageContentParts = [];
			const removedSuccess: LLMToolRemoveResourcesResponseData['data']['resourcesRemoved'] = [];
			const removedError: LLMToolRemoveResourcesResponseData['data']['resourcesError'] = [];

			// Process each resource
			for (const source of sources) {
				try {
					// Validate path
					const resourceUri = dsConnectionToUse.getUriForResource(`file:./${source}`);
					if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
						throw new Error('Path is outside the data source');
					}

					// Check if path is protected
					if (this.isProtectedPath(source)) {
						throw new Error('Path is protected from deletion');
					}

					const fullSourcePath = join(dataSourceRoot, source);
					const isDirectory = await this.checkIsDirectory(dataSourceRoot, source);

					if (this.config.dangerouslyDeletePermanently) {
						// Permanent deletion
						await Deno.remove(fullSourcePath, { recursive: true });
						removedSuccess.push({ name: source, isDirectory });
						toolResultContentParts.push({
							'type': 'text',
							'text': `Resource removed: ${source}`,
						} as LLMMessageContentPartTextBlock);
					} else {
						// Move to trash
						const trashPath = await this.generateTrashPath(dataSourceRoot, source);
						const fullTrashPath = join(dataSourceRoot, trashPath);

						// Create parent directory in trash if needed
						await ensureDir(dirname(fullTrashPath));

						// Move resource to trash
						await Deno.rename(fullSourcePath, fullTrashPath);
						removedSuccess.push({ name: source, isDirectory, destination: trashPath });
						toolResultContentParts.push({
							'type': 'text',
							'text': `Resource removed: ${source}`,
						} as LLMMessageContentPartTextBlock);
					}
				} catch (error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error removing resource ${source}: ${(error as Error).message}`,
					} as LLMMessageContentPartTextBlock);
					removedError.push({
						name: source,
						error: (error as Error).message,
					});
				}
			}

			// Log changes
			if (removedSuccess.length > 0) {
				const operation = this.config.dangerouslyDeletePermanently ? 'deleted' : 'moved to trash';
				await projectEditor.orchestratorController.logChangeAndCommit(
					interaction,
					dataSourceRoot,
					removedSuccess.map((f) => f.name),
					removedSuccess.map((f) => {
						const type = f.isDirectory ? 'directory' : 'file';
						return `${f.name} (${type}) ${operation}${f.destination ? ` (${f.destination})` : ''}`;
					}),
				);
			}

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`;
			toolResultContentParts.unshift({
				type: 'text',
				text: `Used data source: ${dsConnectionToUse.name}`,
			});

			// Prepare response
			const toolResults = toolResultContentParts;
			const toolResponse =
				`${dsConnectionStatus}\n${removedSuccess.length} items ${
					this.config.dangerouslyDeletePermanently ? 'deleted' : 'moved to trash'
				}` +
				(removedError.length > 0 ? `, ${removedError.length} failed` : '');
			const bbResponse = {
				data: {
					resourcesRemoved: removedSuccess,
					resourcesError: removedError,
					// resourcesRemoved: removedSuccess.map((f) => f.name),
					// resourcesError: removedError.map((f) => f.name),
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
			logger.error(`LLMToolRemoveResources: ${(error as Error).message}`);
			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to remove resources. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to remove resources. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
