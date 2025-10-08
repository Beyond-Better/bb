import LLMTool from 'api/llms/llmTool.ts';
import type {
	//LLMToolConfig,
	LLMToolInputSchema,
	LLMToolLogEntryFormattedResult,
	LLMToolRunResult,
} from 'api/llms/llmTool.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
import type {
	LLMToolMCPConfig,
	//LLMToolMCPInput
} from './types.ts';

import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';

export default class LLMToolMCP extends LLMTool {
	private _toolName!: string; // server's internal tool name (same across server instances)
	private _serverId!: string;
	private _mcpManager!: MCPManager;
	private _inputSchema!: LLMToolInputSchema;

	constructor(name: string, description: string, toolConfig: LLMToolMCPConfig) {
		super(name, description, toolConfig);
	}

	// deno-lint-ignore require-await
	override async init() {
		// Get the MCP manager (this would be replaced with proper injection mechanism)
		//logger.debug(`LLMToolMCP: Initialized MCP tool ${this.name} for server ${this._serverId}`);
		logger.debug(`LLMToolMCP: Initialized MCP tool ${this.name}`);
		return this;
	}

	get inputSchema(): LLMToolInputSchema {
		return this._inputSchema;
	}
	set inputSchema(inputSchema: LLMToolInputSchema) {
		this._inputSchema = inputSchema;
	}

	// server's internal tool name (same across server instances)
	get toolName(): string {
		return this._toolName;
	}
	set toolName(toolName: string) {
		this._toolName = toolName;
	}

	get serverId(): string {
		return this._serverId;
	}
	set serverId(serverId: string) {
		this._serverId = serverId;
	}

	get mcpManager(): MCPManager {
		return this._mcpManager;
	}
	set mcpManager(mcpManager: MCPManager) {
		this._mcpManager = mcpManager;
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolUseConsole(toolInput, this.name)
			: formatLogEntryToolUseBrowser(toolInput, this.name);
	}

	formatLogEntryToolResult(
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent, this.name)
			: formatLogEntryToolResultBrowser(resultContent, this.name);
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		//const { toolInput } = toolUse;

		try {
			logger.info(`LLMToolMCP: Executing MCP tool ${this._toolName} for BB tool ${this.name}`);

			// Execute the tool through MCPManager
			const mcpResult = await this._mcpManager.executeMCPTool(
				this._serverId,
				this._toolName,
				toolUse,
				projectEditor, // Pass project context for sampling support
				interaction.id, // Pass interaction id for sampling support
			);

			// Build tool response, appending MCP toolResponse if available
			let toolResponse = `MCP tool ${this.name} executed successfully`;
			if (mcpResult.toolResponse) {
				toolResponse += `: ${mcpResult.toolResponse}`;
			}

			// Return the actual MCP result as toolResults
			return {
				toolResults: mcpResult.content,
				toolResponse: toolResponse,
				bbResponse: {
					data: {
						toolName: this.name,
						serverId: this._serverId,
						response: mcpResult.toolResponse,
						result: mcpResult.content,
					},
				},
			};
		} catch (error) {
			logger.error(`LLMToolMCP: Error executing tool ${this._toolName}:`, error);

			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to execute MCP tool ${this.name}: ${(error as Error).message}`,
				{
					name: 'mcp-tool-execution-error',
					service: 'mcp',
					action: 'execute-tool',
					toolName: this.name,
					serverId: this._serverId,
				},
			);
		}
	}
}
