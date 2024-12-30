//import type { JSX } from 'preact';
import { basename, dirname, join } from '@std/path';
import { ensureDir, exists } from '@std/fs';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { FileHandlingErrorOptions, ToolHandlingErrorOptions } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';

import type {
	LLMToolRemoveFilesConfig,
	LLMToolRemoveFilesInput,
	LLMToolRemoveFilesResponseData,
	RemoveFilesAcknowledgement,
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

export default class LLMToolRemoveFiles extends LLMTool {
	private config: LLMToolRemoveFilesConfig;

	constructor(name: string, description: string, toolConfig: LLMToolRemoveFilesConfig) {
		super(name, description, toolConfig);
		this.config = {
			dangerouslyDeletePermanently: false,
			trashDir: '.trash',
			maxFilesPerOperation: 50,
			protectedPaths: ['node_modules'],
			trashNamingStrategy: 'increment',
			...toolConfig,
		};
	}

	get inputSchema(): LLMToolInputSchema {
		const schema: {
			type: 'object';
			properties: { sources: unknown; acknowledgement?: unknown };
			required: string[];
		} = {
			type: 'object',
			properties: {
				sources: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of file or directory paths to remove. Important notes:\n' +
						'* For files: The individual file will be removed\n' +
						'* For directories: The directory AND ALL ITS CONTENTS will be removed recursively\n' +
						'* All paths must be relative to project root and within the project directory\n' +
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
					fileCount: {
						type: 'number',
						description: 'Must exactly match the number of items in the sources array.',
					},
					files: {
						type: 'array',
						items: { type: 'string' },
						description:
							'Must exactly match the files/directories listed in the sources array, in any order.',
					},
					hasDirectories: {
						type: 'boolean',
						description:
							'Must be true if any of the sources are directories. Requires special acknowledgement text.',
					},
					acknowledgement: {
						type: 'string',
						description: 'Must be exactly one of:\n' +
							'* For files only: "I confirm permanent deletion of {fileCount} files with no recovery possible"\n' +
							'* When directories included: "I confirm permanent deletion of {fileCount} files/directories and all contents with no recovery possible"\n' +
							'where {fileCount} matches the number of items.',
					},
				},
				required: ['fileCount', 'files', 'hasDirectories', 'acknowledgement'],
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
			? formatLogEntryToolUseConsole(toolInput as LLMToolRemoveFilesInput)
			: formatLogEntryToolUseBrowser(toolInput as LLMToolRemoveFilesInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	private async checkIsDirectory(projectRoot: string, path: string): Promise<boolean> {
		try {
			const stat = await Deno.stat(join(projectRoot, path));
			return stat.isDirectory;
		} catch {
			return false;
		}
	}

	private async validateAcknowledgement(
		acknowledgement: RemoveFilesAcknowledgement,
		sources: string[],
		projectRoot: string,
	): Promise<void> {
		// Validate file count
		if (acknowledgement.fileCount !== sources.length) {
			throw createError(
				ErrorType.ToolHandling,
				`File count mismatch: acknowledgement specifies ${acknowledgement.fileCount} items but ${sources.length} items were provided`,
				{
					name: 'remove-files',
					toolName: 'remove_files',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		// Validate file list matches exactly
		const sourcesSet = new Set(sources);
		const acknowledgedSet = new Set(acknowledgement.files);

		if (sourcesSet.size !== acknowledgedSet.size) {
			throw createError(
				ErrorType.ToolHandling,
				'File list mismatch: acknowledged items do not match source items',
				{
					name: 'remove-files',
					toolName: 'remove_files',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		for (const file of sourcesSet) {
			if (!acknowledgedSet.has(file)) {
				throw createError(
					ErrorType.ToolHandling,
					`File list mismatch: ${file} is in sources but not in acknowledgement`,
					{
						name: 'remove-files',
						toolName: 'remove_files',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}
		}

		// Check if any sources are directories
		const hasDirectories = await Promise.all(
			sources.map((source) => this.checkIsDirectory(projectRoot, source)),
		).then((results) => results.some(Boolean));

		// Validate hasDirectories flag
		if (hasDirectories !== acknowledgement.hasDirectories) {
			throw createError(
				ErrorType.ToolHandling,
				hasDirectories
					? 'Directory detected but hasDirectories is false. Directories require explicit acknowledgement.'
					: 'hasDirectories is true but no directories were found in sources.',
				{
					name: 'remove-files',
					toolName: 'remove_files',
					operation: 'tool-input',
				} as ToolHandlingErrorOptions,
			);
		}

		// Validate acknowledgement text
		const expectedText = hasDirectories
			? `I confirm permanent deletion of ${acknowledgement.fileCount} files/directories and all contents with no recovery possible`
			: `I confirm permanent deletion of ${acknowledgement.fileCount} files with no recovery possible`;

		if (acknowledgement.acknowledgement.trim() !== expectedText) {
			throw createError(
				ErrorType.ToolHandling,
				`Invalid acknowledgement text. Must be exactly:\n"${expectedText}"`,
				{
					name: 'remove-files',
					toolName: 'remove_files',
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
		projectRoot: string,
		originalPath: string,
	): Promise<string> {
		const trashDir = this.config.trashDir || '.trash';
		const fileName = basename(originalPath);
		const baseTrashPath = join(trashDir, fileName);

		// this.config.trashNamingStrategy === 'timestamp'
		// timestamp strategy always gets suffix
		// If there's a conflict, use the configured naming strategy
		if (this.config.trashNamingStrategy === 'timestamp') {
			const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace(/T/g, '_');
			const [name, ...extensions] = fileName.split('.');
			const newName = extensions.length > 0
				? `${name}_${timestamp}.${extensions.join('.')}`
				: `${name}_${timestamp}`;
			return join(trashDir, newName);
		}

		// this.config.trashNamingStrategy === 'increment'
		// First try the original name - only for increment strategy
		if (!await exists(join(projectRoot, baseTrashPath))) {
			return baseTrashPath;
		}

		// Increment strategy
		let index = 1;
		let trashPath = baseTrashPath;
		while (await exists(join(projectRoot, trashPath))) {
			const [name, ...extensions] = fileName.split('.');
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
		const { sources, acknowledgement } = toolInput as LLMToolRemoveFilesInput;

		try {
			// Validate number of files
			if (sources.length > (this.config.maxFilesPerOperation || 50)) {
				throw createError(
					ErrorType.ToolHandling,
					`Too many items: ${sources.length} exceeds maximum of ${this.config.maxFilesPerOperation}`,
					{
						name: 'remove-files',
						toolName: 'remove_files',
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
							name: 'remove-files',
							toolName: 'remove_files',
							operation: 'tool-input',
						} as ToolHandlingErrorOptions,
					);
				}
				await this.validateAcknowledgement(acknowledgement, sources, projectEditor.projectRoot);
			} else if (acknowledgement) {
				// If permanent deletion is disabled, acknowledgement should not be provided
				throw createError(
					ErrorType.ToolHandling,
					'Acknowledgement provided but permanent deletion is not enabled in tool configuration',
					{
						name: 'remove-files',
						toolName: 'remove_files',
						operation: 'tool-input',
					} as ToolHandlingErrorOptions,
				);
			}

			// Ensure trash directory exists if needed
			if (!this.config.dangerouslyDeletePermanently) {
				const trashDir = join(projectEditor.projectRoot, this.config.trashDir || '.trash');
				try {
					await ensureDir(trashDir);
				} catch (error) {
					throw createError(
						ErrorType.FileHandling,
						`Failed to create trash directory: ${(error as Error).message}`,
						{
							name: 'remove-files',
							filePath: trashDir,
							operation: 'create-dir',
						} as FileHandlingErrorOptions,
					);
				}
			}

			const toolResultContentParts = [];
			const removedSuccess: LLMToolRemoveFilesResponseData['data']['filesRemoved'] = [];
			const removedError: LLMToolRemoveFilesResponseData['data']['filesError'] = [];

			// Process each file
			for (const source of sources) {
				try {
					// Validate path
					if (!await isPathWithinProject(projectEditor.projectRoot, source)) {
						throw new Error('Path is outside the project directory');
					}

					// Check if path is protected
					if (this.isProtectedPath(source)) {
						throw new Error('Path is protected from deletion');
					}

					const fullSourcePath = join(projectEditor.projectRoot, source);
					const isDirectory = await this.checkIsDirectory(projectEditor.projectRoot, source);

					if (this.config.dangerouslyDeletePermanently) {
						// Permanent deletion
						await Deno.remove(fullSourcePath, { recursive: true });
						removedSuccess.push({ name: source, isDirectory });
						toolResultContentParts.push({
							'type': 'text',
							'text': `File/Directory removed: ${source}`,
						} as LLMMessageContentPartTextBlock);
					} else {
						// Move to trash
						const trashPath = await this.generateTrashPath(projectEditor.projectRoot, source);
						const fullTrashPath = join(projectEditor.projectRoot, trashPath);

						// Create parent directory in trash if needed
						await ensureDir(dirname(fullTrashPath));

						// Move file to trash
						await Deno.rename(fullSourcePath, fullTrashPath);
						removedSuccess.push({ name: source, isDirectory, destination: trashPath });
						toolResultContentParts.push({
							'type': 'text',
							'text': `File/Directory removed: ${source}`,
						} as LLMMessageContentPartTextBlock);
					}
				} catch (error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error removing file ${source}: ${(error as Error).message}`,
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
					removedSuccess.map((f) => f.name),
					removedSuccess.map((f) => {
						const type = f.isDirectory ? 'directory' : 'file';
						return `${f.name} (${type}) ${operation}${f.destination ? ` (${f.destination})` : ''}`;
					}),
				);
			}

			// Prepare response
			const toolResults = toolResultContentParts;
			const toolResponse =
				`${removedSuccess.length} items ${
					this.config.dangerouslyDeletePermanently ? 'deleted' : 'moved to trash'
				}` +
				(removedError.length > 0 ? `, ${removedError.length} failed` : '');
			const bbResponse = {
				data: {
					filesRemoved: removedSuccess,
					filesError: removedError,
					// filesRemoved: removedSuccess.map((f) => f.name),
					// filesError: removedError.map((f) => f.name),
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
			};
		} catch (error) {
			logger.error(`LLMToolRemoveFiles: ${(error as Error).message}`);
			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to remove files. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to remove files. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
