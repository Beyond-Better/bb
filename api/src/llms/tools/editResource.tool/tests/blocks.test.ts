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
import { MockGoogleDocsClient, MockNotionClient } from 'api/tests/mockClients.ts';

/**
 * Block editing tests for EditResource tool
 * Tests structured content editing functionality
 */

Deno.test({
	name: 'EditResourceTool - Blocks - Basic block operations',
	fn: async () => {
		const extraDatasources = ['notion'] as DataSourceProviderType[];
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
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-block-edit',
					toolName: 'edit_resource',
					toolInput: {
						dataSourceId: 'test-notion-connection',
						resourcePath: 'page/minimal-page-101',
						operations: [
							{
								editType: 'blocks',
								blocks_operationType: 'update',
								blocks_index: 0,
								blocks_content: {
									_type: 'block',
									style: 'h1',
									children: [{
										_type: 'span',
										text: 'Updated Header',
										marks: [],
									}],
								},
							},
							{
								editType: 'blocks',
								blocks_operationType: 'insert',
								blocks_position: 1,
								blocks_block: {
									_type: 'block',
									style: 'normal',
									children: [{
										_type: 'span',
										text: 'New paragraph inserted',
										marks: [],
									}],
								},
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Blocks - Basic block operations - bbResponse:', result.bbResponse);
				// console.log('Blocks - Basic block operations - toolResponse:', result.toolResponse);
				// console.log('Blocks - Basic block operations - toolResults:', result.toolResults);

				// Verify successful block operations
				assertStringIncludes(result.toolResponse, 'operations succeeded');

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
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'blocks',
						'editType should be block-edit',
					);
					assertEquals(
						result.bbResponse.data.operationsApplied,
						2,
						'operationsApplied should be 2',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						2,
						'operationsSuccessful should be 2',
					);
				}

				// Check toolResults structure
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length >= 2, 'toolResults should have at least 2 elements');

				// Verify first result is data source info
				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, 'Operated on data source:');

				// Verify second result is operation summary
				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Edit operations applied to resource: page/minimal-page-101',
				);
				assertStringIncludes(
					secondResult.text,
					'All operations succeeded. 2/2 operations succeeded',
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

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

Deno.test({
	name: 'EditResourceTool - Blocks - Multiple block operations',
	fn: async () => {
		const extraDatasources = ['notion'] as DataSourceProviderType[];
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
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-multiple-block-ops',
					toolName: 'edit_resource',
					toolInput: {
						dataSourceId: 'test-notion-connection',
						resourcePath: 'page/simple-page-123',
						operations: [
							{
								editType: 'blocks',
								blocks_operationType: 'update',
								blocks_index: 0,
								blocks_content: {
									_type: 'block',
									style: 'h1',
									children: [{ _type: 'span', text: 'Main Title', marks: [] }],
								},
							},
							{
								editType: 'blocks',
								blocks_operationType: 'insert',
								blocks_position: 1,
								blocks_block: {
									_type: 'block',
									style: 'h2',
									children: [{ _type: 'span', text: 'Subtitle', marks: [] }],
								},
							},
							{
								editType: 'blocks',
								blocks_operationType: 'insert',
								blocks_position: 2,
								blocks_block: {
									_type: 'block',
									style: 'normal',
									children: [{ _type: 'span', text: 'Content paragraph', marks: [] }],
								},
							},
							{
								editType: 'blocks',
								blocks_operationType: 'move',
								blocks_from: 2,
								blocks_to: 1,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Blocks - Multiple block operations - bbResponse:', result.bbResponse);
				// console.log('Blocks - Multiple block operations - toolResponse:', result.toolResponse);
				// console.log('Blocks - Multiple block operations - toolResults:', result.toolResults);

				// Verify successful execution
				assertStringIncludes(result.toolResponse, 'operations succeeded');

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
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'blocks',
						'editType should be block-edit',
					);
					assertEquals(
						result.bbResponse.data.operationsApplied,
						4,
						'operationsApplied should be 4',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						4,
						'operationsSuccessful should be 4',
					);
				}

				// Verify all operations were processed
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				// Should have: datasource info + summary + 4 operation results
				assert(result.toolResults.length >= 6, 'toolResults should have at least 6 elements for 4 operations');

				// Check operation count in summary
				const summaryResult = result.toolResults[1] as LLMMessageContentPartTextBlock;
				assertStringIncludes(summaryResult.text, '4/4 operations succeeded');
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Blocks - Delete operations',
	fn: async () => {
		const extraDatasources = ['notion'] as DataSourceProviderType[];
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
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-delete-operations',
					toolName: 'edit_resource',
					toolInput: {
						dataSourceId: 'test-notion-connection',
						resourcePath: 'page/simple-page-123',
						operations: [
							{
								editType: 'blocks',
								blocks_operationType: 'delete',
								blocks_index: 1,
							},
							{
								editType: 'blocks',
								blocks_operationType: 'delete',
								blocks_key: 'block-4',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Blocks - Delete operations - bbResponse:', result.bbResponse);
				// console.log('Blocks - Delete operations - toolResponse:', result.toolResponse);
				// console.log('Blocks - Delete operations - toolResults:', result.toolResults);

				// Verify successful deletion operations
				assertStringIncludes(result.toolResponse, 'operations succeeded');

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
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'blocks',
						'editType should be block-edit',
					);
					assertEquals(
						result.bbResponse.data.operationsApplied,
						2,
						'operationsApplied should be 2',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						2,
						'operationsSuccessful should be 2',
					);
				}

				// Check that both delete operations were processed
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				// Should have: datasource info + summary + 2 operation results
				assert(result.toolResults.length >= 4, 'toolResults should have at least 4 elements for 2 operations');

				// Verify operation count
				const summaryResult = result.toolResults[1] as LLMMessageContentPartTextBlock;
				assertStringIncludes(summaryResult.text, '2/2 operations succeeded');
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
