import type ProjectEditor from 'api/editor/projectEditor.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';

import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunBbResponse, LLMToolRunResultContent, LLMToolRunToolResponse } from 'api/llms/llmTool.ts';

import { createError, ErrorType } from 'api/utils/error.ts';
import type { LLMValidationErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import type { ProjectConfig } from 'shared/config/v2/types.ts';
import { getBbDir, getGlobalConfigDir } from 'shared/dataDir.ts';

import { compare as compareVersions, parse as parseVersion } from '@std/semver';
import { isAbsolute, join } from '@std/path';
import { exists } from '@std/fs';

import { CORE_TOOLS } from './tools_manifest.ts';

export interface ToolUsageStats {
	toolCounts: Map<string, number>; // Track usage count per tool
	toolResults: Map<string, { // Track success/failure per tool
		success: number;
		failure: number;
	}>;
	lastToolUse: string; // Name of last tool used
	lastToolSuccess: boolean; // Success status of last tool
}

export interface ToolMetadata {
	name: string;
	version: string;
	author: string;
	license: string;
	description: string;
	path?: string; // is set by code, not part of manifest
	toolSets?: string | string[]; //defaults to 'core'
	category?: string | string[];
	enabled?: boolean; //defaults to true
	mutates?: boolean; //defaults to true
	error?: string;
	config?: unknown;
	examples?: Array<{ description: string; input: unknown }>;
}

export type LLMToolManagerToolSetType = 'core' | 'coding' | 'research' | 'creative';

class LLMToolManager {
	private toolMetadata: Map<string, ToolMetadata> = new Map();
	private loadedTools: Map<string, LLMTool> = new Map();
	private projectConfig: ProjectConfig;
	private bbDir: string | undefined;
	private globalConfigDir: string | undefined;
	public toolSet: LLMToolManagerToolSetType | LLMToolManagerToolSetType[];

	constructor(
		projectConfig: ProjectConfig,
		toolSet: LLMToolManagerToolSetType | LLMToolManagerToolSetType[] = 'core',
	) {
		this.projectConfig = projectConfig;
		this.toolSet = toolSet;
	}

	async init() {
		this.bbDir = await getBbDir(this.projectConfig.projectId);
		this.globalConfigDir = await getGlobalConfigDir();
		await this.loadToolMetadata(this.projectConfig.settings.api?.userToolDirectories || []);

		return this;
	}

	private async loadToolMetadata(directories: string[]) {
		for (const coreTool of CORE_TOOLS) {
			const toolNamePath = join('tools', coreTool.toolNamePath);
			coreTool.metadata.path = toolNamePath;
			logger.debug(`LLMToolManager: Setting metadata for CORE tool ${coreTool.toolNamePath}`);
			this.toolMetadata.set(coreTool.metadata.name, coreTool.metadata);
		}

		for (const directory of directories) {
			// For each directory, check both project root and global config locations
			const dirsToCheck: string[] = [];

			if (isAbsolute(directory)) {
				dirsToCheck.push(directory);
			} else {
				// Add project bb path if available
				if (this.bbDir) {
					dirsToCheck.push(join(this.bbDir, directory));
				}
				// Add global config path if available
				if (this.globalConfigDir) {
					dirsToCheck.push(join(this.globalConfigDir, directory));
				}
			}

			// Process each resolved directory
			for (const resolvedDir of dirsToCheck) {
				//logger.info(`LLMToolManager: Checking ${resolvedDir} for tools`);
				try {
					if (!await exists(resolvedDir)) {
						//logger.info(`LLMToolManager: Skipping ${resolvedDir} as it does not exist`);
						continue;
					}
					const directoryInfo = await Deno.stat(resolvedDir);
					if (!directoryInfo.isDirectory) {
						//logger.info(`LLMToolManager: Skipping ${resolvedDir} as it is not a directory`);
						continue;
					}

					for await (const entry of Deno.readDir(resolvedDir)) {
						if (entry.isDirectory && entry.name.endsWith('.tool')) {
							try {
								const toolPath = join(resolvedDir, entry.name);
								const metadataInfoPath = join(toolPath, 'info.json');
								const metadata: ToolMetadata = JSON.parse(await Deno.readTextFile(metadataInfoPath));
								metadata.path = toolPath;

								if (this.isToolInSet(metadata)) {
									//logger.info(`LLMToolManager: Tool ${metadata.name} is available in tool set`);
									if (this.toolMetadata.has(metadata.name)) {
										const existingMetadata = this.toolMetadata.get(metadata.name)!;
										if (this.shouldReplaceExistingTool(existingMetadata, metadata)) {
											this.toolMetadata.set(metadata.name, metadata);
										} else {
											logger.warn(
												`LLMToolManager: Tool ${metadata.name} has already been loaded and shouldn't be replaced`,
											);
										}
									} else {
										this.toolMetadata.set(metadata.name, metadata);
									}
								} else {
									logger.warn(
										`LLMToolManager: Tool ${entry.name} is not in tool set ${
											Array.isArray(this.toolSet) ? this.toolSet.join(', ') : this.toolSet
										}`,
									);
								}
							} catch (error) {
								logger.error(
									`LLMToolManager: Error loading tool metadata for ${entry.name}: ${
										(error as Error).message
									}`,
								);
							}
						}
					}
				} catch (error) {
					logger.error(
						`LLMToolManager: Error processing directory ${directory}: ${(error as Error).message}`,
					);
				}
			}
		}
	}

	private isToolInSet(metadata: ToolMetadata): boolean {
		const metadataSets = metadata.toolSets
			? (Array.isArray(metadata.toolSets) ? metadata.toolSets : [metadata.toolSets])
			: ['core'];
		const requestedSets = Array.isArray(this.toolSet) ? this.toolSet : [this.toolSet];
		return metadataSets.some((set) => requestedSets.includes(set as LLMToolManagerToolSetType));
	}

	private isToolEnabled(metadata: ToolMetadata): boolean {
		// enabled may not be set in metadata, so default to true
		return metadata.enabled !== false;
	}

	private shouldReplaceExistingTool(existing: ToolMetadata, newMetadata: ToolMetadata): boolean {
		// Prefer user-supplied tools
		if (
			(this.projectConfig.settings.api?.userToolDirectories || []).some((dir) =>
				newMetadata.path!.startsWith(dir)
			)
		) {
			if (compareVersions(parseVersion(existing.version), parseVersion(newMetadata.version)) > 0) {
				logger.warn(
					`LLMToolManager: User-supplied tool ${newMetadata.name} (${newMetadata.version}) is older than built-in tool (${existing.version})`,
				);
			}
			return true;
		}
		return false;
	}

	async getTool(name: string): Promise<LLMTool | undefined> {
		if (this.loadedTools.has(name)) {
			//logger.info(`LLMToolManager: Returning cached ${name} tool`);
			return this.loadedTools.get(name);
		}

		const metadata = this.toolMetadata.get(name);
		if (!metadata) {
			logger.warn(`LLMToolManager: Tool ${name} not found`);
			return undefined;
		}

		if (!this.isToolEnabled(metadata)) {
			logger.warn(`LLMToolManager: Tool ${name} is disabled`);
			return undefined;
		}

		try {
			const toolPath = isAbsolute(metadata.path!)
				? join(metadata.path!, 'tool.ts')
				: join('.', metadata.path!, 'tool.ts');
			logger.debug(`LLMToolManager: Tool ${name} is loading from ${toolPath}`);
			const module = await import(new URL(toolPath, import.meta.url).href);
			const tool = await new module.default(
				metadata.name,
				metadata.description,
				this.projectConfig.settings.api?.toolConfigs?.[name] || {},
			).init();
			logger.debug(`LLMToolManager: Loaded Tool ${tool.name}`);
			this.loadedTools.set(name, tool);
			return tool;
		} catch (error) {
			logger.error(`LLMToolManager: Error loading tool ${name}: ${(error as Error).message}`);
			metadata.error = (error as Error).message;
			return undefined;
		}
	}

	getToolFileName(name: string): string | undefined {
		const metadata = this.toolMetadata.get(name);
		return metadata ? `${metadata.path}/tool.ts` : undefined;
	}

	async getAllTools(enabledOnly = true): Promise<LLMTool[]> {
		const tools: LLMTool[] = [];
		for (const metadata of this.toolMetadata.values()) {
			if (enabledOnly && this.isToolEnabled(metadata)) {
				const tool = await this.getTool(metadata.name);
				if (tool) {
					tools.push(tool);
				}
			}
		}
		return tools;
	}

	getAllToolsMetadata(): Map<string, ToolMetadata> {
		return this.toolMetadata;
	}

	getToolMetadata(): ToolMetadata[] {
		return Array.from(this.toolMetadata.values());
	}

	async handleToolUse(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<
		{
			messageId: string;
			toolResults: LLMToolRunResultContent;
			toolResponse: LLMToolRunToolResponse;
			bbResponse: LLMToolRunBbResponse;
			isError: boolean;
		}
	> {
		const tool = await this.getTool(toolUse.toolName);
		if (!tool) {
			logger.warn(`llmToolManager: Unknown tool used: ${toolUse.toolName}`);
			throw new Error(`Unknown tool used: ${toolUse.toolName}`);
		}
		try {
			if (!toolUse.toolValidation.validated && !tool.validateInput(toolUse.toolInput)) {
				throw createError(ErrorType.LLMValidation, `Invalid input for ${toolUse.toolName} tool`, {
					name: `tool_use-${toolUse.toolName}`,
					validation_type: 'input_schema',
					validation_error: 'Input does not match the required schema',
				} as LLMValidationErrorOptions);
			} else {
				logger.info(
					`llmToolManager: handleToolUse - Tool ${toolUse.toolName} validated with results: ${toolUse.toolValidation.results}`,
				);
			}

			const { toolResults, toolResponse, bbResponse, finalizeCallback } = await tool.runTool(
				interaction,
				toolUse,
				projectEditor,
			);

			const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, toolResults, false) || '';

			if (finalizeCallback) {
				logger.info(
					`llmToolManager: handleToolUse - Tool ${toolUse.toolName} is being finalized for messageId: ${messageId}`,
				);
				finalizeCallback(messageId);
			}

			// Update tool usage stats
			interaction.updateToolStats(toolUse.toolName, true);

			// Resource tracking is now handled directly by tools using the interaction

			return {
				messageId,
				toolResults,
				toolResponse,
				bbResponse,
				isError: false,
			};
		} catch (error) {
			logger.error(`llmToolManager: Error executing tool ${toolUse.toolName}: ${(error as Error).message}`);

			const messageId = interaction.addMessageForToolResult(toolUse.toolUseId, (error as Error).message, true) ||
				'';

			// Update tool usage stats
			interaction.updateToolStats(toolUse.toolName, false);

			return {
				messageId,
				toolResults: [],
				toolResponse: `Error with ${toolUse.toolName}: ${(error as Error).message}`,
				bbResponse: 'BB could not run the tool',
				isError: true,
			};
		}
	}
}

export default LLMToolManager;
