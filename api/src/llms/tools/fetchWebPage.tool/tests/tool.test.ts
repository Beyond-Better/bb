import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolFetchWebPageResponseData } from '../types.ts';

// Type guard function
function isFetchWebPageResponse(
	response: unknown,
): response is LLMToolFetchWebPageResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'url' in data &&
		typeof data.url === 'string' &&
		'html' in data &&
		typeof data.html === 'string'
	);
}

Deno.test({
	name: 'FetchWebPageTool - successful fetch',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_page');
			assert(tool, 'Failed to get tool');

			const url = 'https://google.com';
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'fetch_web_page',
				toolInput: {
					url,
				},
			};

			const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');
			const result = await tool.runTool(interaction, toolUse, projectEditor);
			console.log('successful fetch - bbResponse:', result.bbResponse);
			// console.log('successful fetch - toolResponse:', result.toolResponse);
			// console.log('successful fetch - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'string');

			assert(
				isFetchWebPageResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isFetchWebPageResponse(result.bbResponse)) {
				assert(result.bbResponse.data.html.startsWith('<style>'), 'HTML should start with <style>');
				assertEquals(result.bbResponse.data.url, 'https://google.com', 'URL should be google.com');
			} else {
				assert(false, 'bbResponse does not have the expected structure for MultiModelQueryTool');
			}

			assertStringIncludes(result.toolResponse, `Successfully fetched and cleaned content from ${url}`);

			const content = result.toolResults as string;
			assertStringIncludes(content, 'Google');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FetchWebPageTool - invalid URL',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_page');
			assert(tool, 'Failed to get tool');
			try {
				const url = 'https://googlezzz.com';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'fetch_web_page',
					toolInput: {
						url,
					},
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');
				const result = await tool.runTool(interaction, toolUse, projectEditor);
			} catch (error) {
				assertStringIncludes((error as Error).message, 'Failed to fetch web page');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FetchWebPageTool - non-existent page',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('fetch_web_page');
			assert(tool, 'Failed to get tool');
			try {
				const url = 'https://google.com/ttt';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'fetch_web_page',
					toolInput: {
						url,
					},
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');
				const result = await tool.runTool(interaction, toolUse, projectEditor);
			} catch (error) {
				assertStringIncludes((error as Error).message, 'Failed to fetch web page');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
