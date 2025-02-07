import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolFetchWebScreenshotResponseData } from '../types.ts';

function isFetchWebScreenshotResponse(
	response: unknown,
): response is LLMToolFetchWebScreenshotResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'url' in data &&
		typeof data.url === 'string'
	);
}

Deno.test({
	name: 'LLMToolFetchWebScreenshot - successful fetch',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_screenshot');
			assert(tool, 'Failed to get tool');

			const url = 'https://google.com';
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'fetch_web_screenshot',
				toolInput: {
					url,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('successful fetch - bbResponse:', result.bbResponse);
			// console.log('successful fetch - toolResponse:', result.toolResponse);
			// console.log('successful fetch - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');

			assertStringIncludes(result.toolResponse, `Successfully captured screenshot of ${url}`);
			assert(
				isFetchWebScreenshotResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isFetchWebScreenshotResponse(result.bbResponse)) {
				assertEquals(result.bbResponse.data.url, 'https://google.com', 'URL should be google.com');
			} else {
				assert(false, 'bbResponse does not have the expected structure for MultiModelQueryTool');
			}

			// Check toolResults
			//assertEquals(typeof result.toolResults, 'object');
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length === 1, 'toolResults should have 1 element');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'image', 'First result should be of type image');
			assertStringIncludes(firstResult.source.type, 'base64', 'Image source should be of type base64');
			assertStringIncludes(
				firstResult.source.media_type,
				'image/png',
				'Image source should have media_type image/png',
			);
			// Check if the result is a valid base64 string
			const base64Regex = /^[A-Za-z0-9+/=]+$/;
			assertEquals(
				base64Regex.test(firstResult.source.data),
				true,
				'Screenshot should be a valid base64 string',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolFetchWebScreenshot - invalid URL',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_screenshot');
			assert(tool, 'Failed to get tool');
			try {
				const url = 'https://googlezzz.com';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'fetch_web_screenshot',
					toolInput: {
						url,
					},
				};

				const conversation = await projectEditor.initConversation('test-conversation-id');
				await tool.runTool(conversation, toolUse, projectEditor);
			} catch (error) {
				assertStringIncludes((error as Error).message, 'Failed to capture screenshot');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
