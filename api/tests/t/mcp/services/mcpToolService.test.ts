/**
 * Tests for MCPToolService
 *
 * Tests the tool-related functionality extracted from MCPManager to ensure
 * proper tool listing, execution, and cache management.
 */

import { assert, assertEquals, assertRejects } from '@std/assert';
import { MCPToolService } from 'api/mcp/services/mcpToolService.ts';
import type { McpServerInfo } from 'api/types/mcp.ts';
import type { MCPServerConfig } from 'shared/config/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { MCPConnectionService } from 'api/mcp/connection/mcpConnectionService.ts';
import { SessionRegistry } from 'api/auth/sessionRegistry.ts';
import { //createTestInteraction,
	getProjectEditor,
	withTestProject,
} from 'api/tests/testSetup.ts';

// Mock server configuration
function createMockServerConfig(serverId: string): MCPServerConfig {
	return {
		id: serverId,
		name: `Test Server ${serverId}`,
		url: 'https://example.com/mcp',
		transport: 'http',
	};
}

// Mock MCP client with tool operations
// deno-lint-ignore no-explicit-any
function createMockMCPClient(tools?: any[], shouldThrow = false) {
	return {
		// deno-lint-ignore require-await
		listTools: async () => {
			if (shouldThrow) {
				throw new Error('MCP client error');
			}
			return {
				tools: tools || [
					{ name: 'test_tool_1', description: 'Test Tool 1', inputSchema: {} },
					{ name: 'test_tool_2', description: 'Test Tool 2', inputSchema: {} },
				],
			};
		},
		// deno-lint-ignore require-await no-explicit-any
		callTool: async ({ name, arguments: args, _meta }: any) => {
			if (shouldThrow) {
				throw new Error('Tool execution failed');
			}
			return {
				content: [{ type: 'text', text: `Tool ${name} executed with args: ${JSON.stringify(args)}` }],
				_meta: { toolResponse: `Response from ${name}\n${JSON.stringify(_meta)}` },
			};
		},
		close: async () => {},
	};
}

// Mock server info
// deno-lint-ignore no-explicit-any
function createMockServerInfo(serverId: string, tools?: any[], shouldThrowTools = false): McpServerInfo {
	return {
		server: createMockMCPClient(tools, shouldThrowTools),
		config: createMockServerConfig(serverId),
		capabilities: ['read', 'list'],
		connectionState: 'connected',
		reconnectAttempts: 0,
		maxReconnectAttempts: 5,
		reconnectDelay: 1000,
		tools: undefined, // Will be populated during tests
	} as unknown as McpServerInfo;
}

// Mock connection service
function createMockConnectionService(serverAvailability: Map<string, boolean> = new Map()): MCPConnectionService {
	return {
		// deno-lint-ignore require-await
		isServerAvailable: async (serverId: string) => {
			return serverAvailability.get(serverId) ?? true; // Default to available
		},
		recordActivity: (_serverId: string) => {
			// Mock: do nothing
		},
		isSessionError: (_error: Error) => {
			return false; // Mock: no session errors in tests
		},
		isAuthError: (_error: Error) => {
			return false; // Mock: no auth errors in tests
		},
		forceReconnect: async (_serverId: string) => {
			// Mock: do nothing
		},
	} as MCPConnectionService;
}

// Mock project editor
function createMockProjectEditor(): ProjectEditor {
	SessionRegistry.getInstance().registerSession('test-user');
	const userContext = SessionRegistry.getInstance().getUserContext('test-user');
	return {
		projectId: 'test-project-123',
		userContext,
		// deno-lint-ignore no-explicit-any
	} as any;
}

Deno.test({
	name: 'MCPToolService - listTools - Returns cached tools when available',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');

		// Pre-populate cache
		serverInfo.tools = [
			{ name: 'cached_tool', description: 'Cached Tool', inputSchema: {} },
		];
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test cached tools
		const tools = await toolService.listTools('test-server-1');

		assertEquals(tools.length, 1);
		assertEquals(tools[0].name, 'cached_tool');
		assertEquals(tools[0].description, 'Cached Tool');
	},
});

Deno.test({
	name: 'MCPToolService - listTools - Fetches and caches tools when not cached',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test fresh tool fetch
		const tools = await toolService.listTools('test-server-1');

		assertEquals(tools.length, 2);
		assertEquals(tools[0].name, 'test_tool_1');
		assertEquals(tools[1].name, 'test_tool_2');

		// Verify tools were cached
		const cachedServerInfo = servers.get('test-server-1')!;
		assert(cachedServerInfo.tools);
		assertEquals(cachedServerInfo.tools.length, 2);
	},
});

Deno.test({
	name: 'MCPToolService - listTools - Server not found error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test with non-existent server
		await assertRejects(
			async () => {
				await toolService.listTools('non-existent-server');
			},
			Error,
			'MCP server non-existent-server not found',
		);
	},
});

Deno.test({
	name: 'MCPToolService - listTools - Server unavailable error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		// Mock server as unavailable
		const serverAvailability = new Map([['test-server-1', false]]);
		const connectionService = createMockConnectionService(serverAvailability);
		const toolService = new MCPToolService(servers, connectionService);

		// Test server unavailable
		await assertRejects(
			async () => {
				await toolService.listTools('test-server-1');
			},
			Error,
			'MCP server test-server-1 is not available',
		);
	},
});

Deno.test({
	name: 'MCPToolService - listTools - MCP client error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1', [], true); // shouldThrow = true
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test MCP client error
		await assertRejects(
			async () => {
				await toolService.listTools('test-server-1');
			},
			Error,
			'Failed to list MCP tools: MCP client error',
		);
	},
});

Deno.test({
	name: 'MCPToolService - executeMCPTool - Successful execution',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			//const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const servers = new Map<string, McpServerInfo>();
			const serverInfo = createMockServerInfo('test-server-1');
			servers.set('test-server-1', serverInfo);

			const connectionService = createMockConnectionService();
			const toolService = new MCPToolService(servers, connectionService);
			// 		const projectEditor = createMockProjectEditor();

			const toolUse: LLMAnswerToolUse = {
				toolInput: { param1: 'value1', param2: 'value2' },
				toolUseId: 'tool-use-123',
				toolName: 'test_tool_1',
				toolValidation: { validated: true, results: 'valid' },
			};

			// Test tool execution
			const result = await toolService.executeMCPTool(
				'test-server-1',
				'test_tool_1',
				toolUse,
				projectEditor,
				'test-collaboration',
			);

			assert(result.content);
			assert(result.toolResponse);
			assert(
				result.toolResponse.startsWith('Response from test_tool_1'),
				'Tool response starts with correct string',
			);
			assert(Array.isArray(result.content));
			assertEquals(result.content[0].type, 'text');
			// deno-lint-ignore no-explicit-any
			assert((result.content[0] as any).text.includes('test_tool_1 executed'));
		});
	},
});

Deno.test({
	name: 'MCPToolService - executeMCPTool - Tool execution failure',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1', [], true); // shouldThrow = true
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);
		const projectEditor = createMockProjectEditor();

		const toolUse: LLMAnswerToolUse = {
			toolInput: { param1: 'value1' },
			toolUseId: 'tool-use-123',
			toolName: 'test_tool_1',
			toolValidation: { validated: true, results: 'valid' },
		};

		// Test tool execution failure
		await assertRejects(
			async () => {
				await toolService.executeMCPTool(
					'test-server-1',
					'test_tool_1',
					toolUse,
					projectEditor,
					'test-collaboration',
				);
			},
			Error,
			'Failed to execute MCP tool: Tool execution failed',
		);
	},
});

Deno.test({
	name: 'MCPToolService - refreshToolsCache - Successful refresh',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		// Pre-populate with old tools
		serverInfo.tools = [{ name: 'old_tool', description: 'Old Tool', inputSchema: {} }];
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test cache refresh
		await toolService.refreshToolsCache('test-server-1');

		// Verify new tools were cached
		const updatedServerInfo = servers.get('test-server-1')!;
		assert(updatedServerInfo.tools);
		assertEquals(updatedServerInfo.tools.length, 2);
		assertEquals(updatedServerInfo.tools[0].name, 'test_tool_1');
		assertEquals(updatedServerInfo.tools[1].name, 'test_tool_2');
	},
});

Deno.test({
	name: 'MCPToolService - refreshAllToolsCaches - Refresh multiple servers',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();

		// Create multiple servers
		const server1 = createMockServerInfo('server-1');
		const server2 = createMockServerInfo('server-2');
		servers.set('server-1', server1);
		servers.set('server-2', server2);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test refresh all
		await toolService.refreshAllToolsCaches();

		// Verify both servers had tools cached
		const updatedServer1 = servers.get('server-1')!;
		const updatedServer2 = servers.get('server-2')!;

		assert(updatedServer1.tools);
		assertEquals(updatedServer1.tools.length, 2);

		assert(updatedServer2.tools);
		assertEquals(updatedServer2.tools.length, 2);
	},
});

Deno.test({
	name: 'MCPToolService - getAllTools - Get tools from all servers',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();

		// Create servers with different tools
		const server1 = createMockServerInfo('server-1', [
			{ name: 'search', description: 'Search tool', inputSchema: {} },
		]);
		const server2 = createMockServerInfo('server-2', [
			{ name: 'create', description: 'Create tool', inputSchema: {} },
			{ name: 'update', description: 'Update tool', inputSchema: {} },
		]);

		servers.set('server-1', server1);
		servers.set('server-2', server2);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test get all tools
		const allTools = await toolService.getAllTools();

		assertEquals(allTools.length, 3);

		// Verify tool formatting
		const searchTool = allTools.find((tool) => tool.name === 'search_server-1');
		assert(searchTool);
		assertEquals(searchTool.description, 'Search tool');
		assertEquals(searchTool.server, 'Test Server server-1');

		const createTool = allTools.find((tool) => tool.name === 'create_server-2');
		assert(createTool);
		assertEquals(createTool.description, 'Create tool');
		assertEquals(createTool.server, 'Test Server server-2');
	},
});

Deno.test({
	name: 'MCPToolService - getAllTools - Handle server errors gracefully',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();

		// Create one working server and one failing server
		const workingServer = createMockServerInfo('working-server', [
			{ name: 'good_tool', description: 'Working tool', inputSchema: {} },
		]);
		const failingServer = createMockServerInfo('failing-server', [], true); // shouldThrow = true

		servers.set('working-server', workingServer);
		servers.set('failing-server', failingServer);

		const connectionService = createMockConnectionService();
		const toolService = new MCPToolService(servers, connectionService);

		// Test get all tools with one server failing
		const allTools = await toolService.getAllTools();

		// Should only get tools from working server
		assertEquals(allTools.length, 1);
		assertEquals(allTools[0].name, 'good_tool_working-server');
		assertEquals(allTools[0].server, 'Test Server working-server');
	},
});
