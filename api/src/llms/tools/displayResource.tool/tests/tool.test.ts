import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { encodeBase64 } from '@std/encoding';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getTestFilePath, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolDisplayResourceResponseData } from '../types.ts';

// Type guard function
function isDisplayResourceResponse(
	response: unknown,
): response is LLMToolDisplayResourceResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'contentType' in data &&
		typeof data.contentType === 'string' &&
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
	name: 'DisplayResourceTool - display text resource',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_resource');
			assert(tool, 'Failed to get tool');

			// Create a test resource
			const testContent = 'Hello, world!';
			const testResource = 'test.txt';
			const testFilePath = getTestFilePath(testProjectRoot, testResource);
			await Deno.writeTextFile(testFilePath, testContent);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_resource',
				toolInput: {
					resourcePath: testResource,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('display text resource - bbResponse:', result.bbResponse);
			// console.log('display text resource - toolResponse:', result.toolResponse);
			// console.log('display text resource - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'string');

			assert(
				isDisplayResourceResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isDisplayResourceResponse(result.bbResponse)) {
				const { data: displayResult } = result.bbResponse;
				assertEquals(displayResult.contentType, 'text');
				assertEquals(displayResult.content, testContent);
				assertEquals(displayResult.metadata.name, testResource);
				assertEquals(displayResult.metadata.mimeType, 'text/plain; charset=UTF-8');
				assert(!displayResult.truncated, 'Content should not be truncated');
			} else {
				assert(false, 'bbResponse does not have the expected structure for DisplayResourceTool');
			}

			assertStringIncludes(result.toolResponse, 'Displayed resource:');
			const content = result.toolResults as string;
			assertStringIncludes(
				content,
				'Resource: test.txt - Size: 13 - MimeType: text/plain; charset=UTF-8 - LastModified:',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'DisplayResourceTool - display image resource',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_resource');
			assert(tool, 'Failed to get tool');

			// Create a test image resource (1x1 pixel PNG)
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
			const testResource = 'test.png';
			await Deno.writeFile(`${testProjectRoot}/${testResource}`, testImageData);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_resource',
				toolInput: {
					resourcePath: testResource,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('display text resource - bbResponse:', result.bbResponse);
			// console.log('display text resource - toolResponse:', result.toolResponse);
			// console.log('display text resource - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'string');

			assert(
				isDisplayResourceResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isDisplayResourceResponse(result.bbResponse)) {
				const { data: displayResult } = result.bbResponse;
				assertEquals(displayResult.contentType, 'image');
				assertEquals(displayResult.content, encodeBase64(testImageData));
				assertEquals(displayResult.metadata.name, testResource);
				assertEquals(displayResult.metadata.mimeType, 'image/png');
				assert(!displayResult.truncated, 'Content should not be truncated');
			} else {
				assert(false, 'bbResponse does not have the expected structure for DisplayResourceTool');
			}

			assertStringIncludes(result.toolResponse, 'Displayed resource:');
			const content = result.toolResults as string;
			assertStringIncludes(content, 'Resource: test.png - Size: 67 - MimeType: image/png - LastModified:');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'DisplayResourceTool - resource not found',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_resource');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_resource',
				toolInput: {
					resourcePath: 'nonexistent.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('resource outside project - bbResponse:', result.bbResponse);
			console.log('resource outside project - toolResponse:', result.toolResponse);
			console.log('resource outside project - toolResults:', result.toolResults);

			assertStringIncludes(result.toolResponse, 'Failed to display resource. Error: Failed to read file');
			assertStringIncludes(String(result.toolResults), 'Failed to read file: nonexistent.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'DisplayResourceTool - resource outside project',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('display_resource');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'display_resource',
				toolInput: {
					resourcePath: '../outside.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('resource outside project - bbResponse:', result.bbResponse);
			console.log('resource outside project - toolResponse:', result.toolResponse);
			console.log('resource outside project - toolResults:', result.toolResults);

			assertStringIncludes(result.toolResponse, 'Failed to display resource');
			assertStringIncludes(
				String(result.toolResults),
				'Failed to read file: ../outside.txt. Access denied: ../outside.txt is outside the data source directory',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
