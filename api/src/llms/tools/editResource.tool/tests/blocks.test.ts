import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestProvider,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';
import { isEditResourceResponse } from '../types.ts';

/**
 * Block editing tests for EditResource tool
 * Tests structured content editing functionality
 */

Deno.test({
	name: 'EditResourceTool - Blocks - Block capability validation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
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
				// Test block editing on filesystem datasource (should fail)
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-block-capability',
					toolName: 'edit_resource',
					toolInput: {
						// No dataSourceId means primary (filesystem)
						resourcePath: 'test.txt',
						operations: [
							{
								editType: 'blocks',
								blocks_operationType: 'update',
								blocks_index: 0,
								blocks_content: {
									_type: 'block',
									style: 'normal',
									children: [{ _type: 'span', text: 'test', marks: [] }],
								},
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Blocks - Block capability validation - bbResponse:', result.bbResponse);
				// console.log('Blocks - Block capability validation - toolResponse:', result.toolResponse);
				// console.log('Blocks - Block capability validation - toolResults:', result.toolResults);

				// Verify structured bbResponse
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isEditResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for EditResource',
				);

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcePath,
						'test.txt',
						`Response resourcePath should be "test.txt"`,
					);
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'blocks',
						'Response editType should be "blocks"',
					);
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.message,
						'Filesystem does not support block operations',
						'message should be indicate lack of blocks support',
					);
					assertEquals(
						result.bbResponse.data.operationsApplied,
						1,
						'Response operationsApplied should be 1',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						0,
						'Response operationsSuccessful should be 0',
					);
				}

				// Check that both delete operations were processed
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				// Should have: datasource info + summary + 2 operation results
				assert(result.toolResults.length >= 3, 'toolResults should have at least 3 elements for 1 operations');

				// Verify operation count
				const summaryResult = result.toolResults[1] as LLMMessageContentPartTextBlock;
				assertStringIncludes(summaryResult.text, 'Some operations skipped or failed. 0/1 operations succeeded');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
