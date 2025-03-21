import type { LLMToolRunBbResponse, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMToolConfig, LLMToolInputSchema } from 'api/llms/llmTool.ts';

export interface LLMToolMCPInput {
	serverId: string;
	toolName: string;
	[key: string]: unknown; // Additional parameters defined by the MCP tool
}

export interface LLMToolMCPConfig extends LLMToolConfig {
	serverId: string; // set in config as mcpServer[x].id
	toolId: string; // `mcp:${serverId}:${mcpTool.name}` - mcpTool.name is server's internal tool name
	toolName: string; // set in config as mcpServer[x].name (use id if name not set) - this is name the LLM sees
	inputSchema: LLMToolInputSchema;
	description: string;
}

export interface LLMToolMCPResultData {
	toolName: string;
	serverId: string;
	result: unknown;
}

export interface LLMToolMCPResponseData {
	data: LLMToolMCPResultData;
}

export interface LLMToolMCPResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolMCPResponseData & LLMToolRunBbResponse;
}
