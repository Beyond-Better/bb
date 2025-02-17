import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { encodeBase64 } from '@std/encoding';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolDisplayFileResponseData } from '../types.ts';

// Type guard function
function isDisplayFileResponse(
	response: unknown,
): response is LLMToolDisplayFileResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'type' in data &&
		typeof data.type === 'string' &&
		'content' in data &&
		typeof data.content === 'string' &&
		'metadata' in data &&
		data.metadata !== null &&
		typeof data.metadata === 'object' &&
		'name' in data.metadata &&
		typeof data.metadata.name === 'string' &&
		'size' in data.metadata &&
		typeof data.metadata.size === 'number' &&
		'mimeType' in data.metadata &&
		typeof data.metadata.mimeType === 'string' &&
		'lastModified' in data.metadata &&
		data.metadata.lastModified instanceof Date
	);
}

Deno.test({
	name: 'DisplayFileTool - display text file',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_file');
			assert(tool, 'Failed to get tool');

			// Create a test file
			const testContent = 'Hello, world!';
			const testFile = 'test.txt';
			await Deno.writeTextFile(`${testProjectRoot}/${testFile}`, testContent);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_file',
				toolInput: {
					filePath: testFile,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('display text file - bbResponse:', result.bbResponse);
			// console.log('display text file - toolResponse:', result.toolResponse);
			// console.log('display text file - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'string');

			assert(
				isDisplayFileResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isDisplayFileResponse(result.bbResponse)) {
				const { data: displayResult } = result.bbResponse;
				assertEquals(displayResult.type, 'text');
				assertEquals(displayResult.content, testContent);
				assertEquals(displayResult.metadata.name, testFile);
				assertEquals(displayResult.metadata.mimeType, 'text/plain; charset=UTF-8');
				assert(!displayResult.truncated, 'Content should not be truncated');
			} else {
				assert(false, 'bbResponse does not have the expected structure for DisplayFileTool');
			}

			assertStringIncludes(result.toolResponse, 'Displayed file:');
			const content = result.toolResults as string;
			assertStringIncludes(
				content,
				'File: test.txt - Size: 13 - MimeType: text/plain; charset=UTF-8 - LastModified:',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'DisplayFileTool - display image file',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_file');
			assert(tool, 'Failed to get tool');

			// Create a test image file (1x1 pixel PNG)
			const testImageData = new Uint8Array([
				0x89,
				0x50,
				0x4E,
				0x47,
				0x0D,
				0x0A,
				0x1A,
				0x0A,
				0x00,
				0x00,
				0x00,
				0x0D,
				0x49,
				0x48,
				0x44,
				0x52,
				0x00,
				0x00,
				0x00,
				0x01,
				0x00,
				0x00,
				0x00,
				0x01,
				0x08,
				0x06,
				0x00,
				0x00,
				0x00,
				0x1F,
				0x15,
				0xC4,
				0x89,
				0x00,
				0x00,
				0x00,
				0x0D,
				0x49,
				0x44,
				0x41,
				0x54,
				0x78,
				0x9C,
				0x63,
				0x00,
				0x01,
				0x00,
				0x00,
				0x05,
				0x00,
				0x01,
				0x0D,
				0x0A,
				0x2D,
				0xB4,
				0x00,
				0x00,
				0x00,
				0x00,
				0x49,
				0x45,
				0x4E,
				0x44,
				0xAE,
				0x42,
				0x60,
				0x82,
			]);
			const testFile = 'test.png';
			await Deno.writeFile(`${testProjectRoot}/${testFile}`, testImageData);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_file',
				toolInput: {
					filePath: testFile,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('display text file - bbResponse:', result.bbResponse);
			// console.log('display text file - toolResponse:', result.toolResponse);
			// console.log('display text file - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'string');

			assert(
				isDisplayFileResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isDisplayFileResponse(result.bbResponse)) {
				const { data: displayResult } = result.bbResponse;
				assertEquals(displayResult.type, 'image');
				assertEquals(displayResult.content, encodeBase64(testImageData));
				assertEquals(displayResult.metadata.name, testFile);
				assertEquals(displayResult.metadata.mimeType, 'image/png');
				assert(!displayResult.truncated, 'Content should not be truncated');
			} else {
				assert(false, 'bbResponse does not have the expected structure for DisplayFileTool');
			}

			assertStringIncludes(result.toolResponse, 'Displayed file:');
			const content = result.toolResults as string;
			assertStringIncludes(content, 'File: test.png - Size: 67 - MimeType: image/png - LastModified:');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'DisplayFileTool - file not found',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_file');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_file',
				toolInput: {
					filePath: 'nonexistent.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('file outside project - bbResponse:', result.bbResponse);
			console.log('file outside project - toolResponse:', result.toolResponse);
			console.log('file outside project - toolResults:', result.toolResults);

			assertStringIncludes(result.toolResponse, 'Failed to display file. Error: Failed to read file');
			assertStringIncludes(String(result.toolResults), 'Failed to read file: nonexistent.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'DisplayFileTool - file outside project',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_file');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_file',
				toolInput: {
					filePath: '../outside.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('file outside project - bbResponse:', result.bbResponse);
			console.log('file outside project - toolResponse:', result.toolResponse);
			console.log('file outside project - toolResults:', result.toolResults);

			assertStringIncludes(result.toolResponse, 'Failed to display file');
			assertStringIncludes(
				String(result.toolResults),
				'Failed to read file: ../outside.txt. Failed to get file metadata',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
