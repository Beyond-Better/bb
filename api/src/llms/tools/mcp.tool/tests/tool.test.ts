import { assert, assertEquals, assertThrows } from 'api/tests/deps.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { MockMCPManager } from './mocks/mockMCPManager.ts';

// Type guard for MCP response
function isMCPToolResponse(
	response: unknown,
): response is { data: { toolName: string; serverId: string; result: unknown } } {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;

	return (
		data !== null &&
		typeof data === 'object' &&
		'toolName' in data &&
		typeof data.toolName === 'string' &&
		'serverId' in data &&
		typeof data.serverId === 'string' &&
		'result' in data
	);
}

// Mock MCP manager setup for tool tests
async function setupMockMCPManager() {
	const mockManager = new MockMCPManager();

	// Setup weather tool response
	mockManager.setToolResponse('test-server', 'weather', {
		temperature: 72,
		condition: 'Sunny',
		location: 'New York',
	});

	//   // Create global access for the tool
	//   globalThis.bb = {
	//     async getMCPManager() {
	//       return mockManager;
	//     }
	//   };

	return mockManager;
}

// Tool config for tests
const toolConfig = {
	serverId: 'test-server',
	toolName: 'weather',
	inputSchema: {
		type: 'object',
		properties: {
			location: {
				type: 'string',
				description: 'The location to get weather for',
			},
		},
		required: ['location'],
	},
};

// Deno.test({
//   name: 'MCPTool - Execute successfully',
//   fn: async () => {
//     await withTestProject(async (testProjectId) => {
//       const projectEditor = await getProjectEditor(testProjectId);
//       const mockManager = await setupMockMCPManager();
//
//       const toolManager = await getToolManager(projectEditor, 'mcp', toolConfig);
//       const tool = await toolManager.getTool('mcp');
//       assert(tool, 'Failed to get MCP tool');
//
//       const toolUse: LLMAnswerToolUse = {
//         toolValidation: { validated: true, results: '' },
//         toolUseId: 'test-id',
//         toolName: 'mcp',
//         toolInput: { location: "New York" }
//       };
//
//       const conversation = await projectEditor.initCollaboration('test-conversation-id');
//       const result = await tool.runTool(conversation, toolUse, projectEditor);
//
//       // Verify tool returned the MCP result directly
//       assertEquals(result.toolResults, {
//         temperature: 72,
//         condition: "Sunny",
//         location: "New York"
//       });
//
//       // Verify bbResponse structure
//       assert(
//         result.bbResponse && typeof result.bbResponse === 'object',
//         'bbResponse should be an object'
//       );
//       assert(
//         isMCPToolResponse(result.bbResponse),
//         'bbResponse should have the correct structure for MCPTool'
//       );
//
//       if (isMCPToolResponse(result.bbResponse)) {
//         assertEquals(result.bbResponse.data.toolName, "weather");
//         assertEquals(result.bbResponse.data.serverId, "test-server");
//         assertEquals(result.bbResponse.data.result, {
//           temperature: 72,
//           condition: "Sunny",
//           location: "New York"
//         });
//       }
//     });
//   },
//   sanitizeResources: false,
//   sanitizeOps: false
// });
//
// Deno.test({
//   name: 'MCPTool - Handle errors properly',
//   fn: async () => {
//     await withTestProject(async (testProjectId) => {
//       const projectEditor = await getProjectEditor(testProjectId);
//       const mockManager = await setupMockMCPManager();
//
//       // Setup error for test
//       mockManager.setToolError("test-server", "weather", new Error("Weather API unavailable"));
//
//       const toolManager = await getToolManager(projectEditor, 'mcp', toolConfig);
//       const tool = await toolManager.getTool('mcp');
//       assert(tool, 'Failed to get MCP tool');
//
//       const toolUse: LLMAnswerToolUse = {
//         toolValidation: { validated: true, results: '' },
//         toolUseId: 'test-id',
//         toolName: 'mcp',
//         toolInput: { location: "New York" }
//       };
//
//       const conversation = await projectEditor.initCollaboration('test-conversation-id');
//
//       // Error should be thrown and handled by the tool manager
//       await assertThrows(
//         async () => await tool.runTool(conversation, toolUse, projectEditor),
//         Error,
//         "Failed to execute MCP tool weather"
//       );
//     });
//   },
//   sanitizeResources: false,
//   sanitizeOps: false
// });
