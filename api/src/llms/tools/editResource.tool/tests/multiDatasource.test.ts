import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';
import { isEditResourceResponse } from '../types.ts';

/**
 * Multi-datasource tests for EditResource tool
 * Tests functionality across different data source types using extraDatasources parameter
 */

Deno.test({
	name: 'EditResourceTool - MultiDatasource - Search and replace on filesystem',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get edit_resource tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file in filesystem datasource
				const testResource = 'multi-ds-filesystem-test.txt';
				const testResourcePath = `${testProjectRoot}/${testResource}`;
				await Deno.writeTextFile(testResourcePath, 'Hello from filesystem!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-multi-ds-filesystem',
					toolName: 'edit_resource',
					toolInput: {
						// No dataSourceId means primary (filesystem)
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'filesystem',
								searchReplace_replace: 'local storage',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify search and replace worked on filesystem
				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Verify structured bbResponse
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isEditResourceResponse(result.bbResponse),
					'bbResponse should have the correct EditResource structure',
				);

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				// Verify the file was actually changed
				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Hello from local storage!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
