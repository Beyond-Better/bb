import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolLoadResourcesResponseData } from '../types.ts';
import { isLoadResourcesResponse } from './tool.test.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

/**
 * Content Format tests for LoadResources tool
 * Tests the contentFormat parameter functionality across different data source types
 */

Deno.test({
	name: 'LoadResourcesTool - ContentFormat - Filesystem ignores contentFormat parameter',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			// Create test resource
			const testContent = 'Hello from filesystem!';
			await Deno.writeTextFile(join(testProjectRoot, 'format-test.txt'), testContent);

			// Test with different contentFormat values - all should behave the same for filesystem
			const contentFormats = ['plainText', 'structured', 'both'] as const;

			for (const contentFormat of contentFormats) {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: `test-filesystem-${contentFormat}`,
					toolName: 'load_resources',
					toolInput: {
						mode: 'template',
						uriTemplate: 'file:./{path}',
						templateResources: [{ path: 'format-test.txt' }],
						contentFormat,
					},
				};

				const interaction = await projectEditor.initInteraction(
					'test-collaboration-id',
					'test-interaction-id',
				);
				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify filesystem behavior is consistent regardless of contentFormat
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					`bbResponse should be an object for ${contentFormat}`,
				);
				assert(
					isLoadResourcesResponse(result.bbResponse),
					`bbResponse should have correct structure for ${contentFormat}`,
				);

				if (isLoadResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesAdded.length,
						1,
						`Should have 1 resource for ${contentFormat}`,
					);
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						0,
						`Should have no errors for ${contentFormat}`,
					);
				}

				assertStringIncludes(
					result.toolResponse,
					'Added resources to the conversation',
					`Should indicate success for ${contentFormat}`,
				);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
