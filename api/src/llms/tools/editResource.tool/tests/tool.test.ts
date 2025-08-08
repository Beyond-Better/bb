import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';
import { isEditResourceResponse } from '../types.ts';

/**
 * Core tool functionality tests for EditResource tool
 * Tests validation logic, routing, and general tool behavior
 */

Deno.test({
	name: 'EditResourceTool - Input validation - operations required',
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
				// Test no edit approach provided
				const noEditToolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-no-edit',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: 'test.txt',
						// No edit approaches provided
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, noEditToolUse, projectEditor),
					Error,
					'operations must be an array',
				);

				//// Test multiple edit approaches provided
				//const multipleEditToolUse: LLMAnswerToolUse = {
				//	toolValidation: { validated: true, results: '' },
				//	toolUseId: 'test-multiple-edit',
				//	toolName: 'edit_resource',
				//	toolInput: {
				//		resourcePath: 'test.txt',
				//		operations: [{
				//			editType: 'searchReplace',
				//			searchReplace_search: 'old',
				//			searchReplace_replace: 'new',
				//		}, {
				//			editType: 'blocks',
				//			blocks_operationType: 'update',
				//			blocks_index: 0,
				//		}],
				//	},
				//};
				//
				//await assertRejects(
				//	async () => await tool.runTool(interaction, multipleEditToolUse, projectEditor),
				//	Error,
				//	'Exactly one edit approach must be provided. Found: 2',
				//);
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Search and replace routing',
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
				// Create a test file
				const testResource = 'routing-test.txt';
				const testResourcePath = `${testProjectRoot}/${testResource}`;
				await Deno.writeTextFile(testResourcePath, 'Hello, world!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-search-replace-routing',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'world',
								searchReplace_replace: 'Deno',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify it was routed to search and replace
				assertStringIncludes(result.toolResponse, 'All operations succeeded');

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
						testResource,
						`Response resourcePath should be "${testResource}"`,
					);
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'Response editType should be "searchReplace"',
					);
					assertEquals(
						result.bbResponse.data.operationsApplied,
						1,
						'Response operationsApplied should be 1',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						1,
						'Response operationsSuccessful should be 1',
					);
				}

				// Verify the file was actually changed
				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Hello, Deno!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Structured data editing not yet implemented',
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
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-structured-data',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: 'test.csv',
						operations: [
							{
								editType: 'structuredData',
								structuredData_operation: {
									type: 'update',
									rowIndex: 0,
									data: { name: 'test' },
								},
							},
						],
					},
				};
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Structured data editing not yet implemented - bbResponse:', result.bbResponse);
				console.log('Structured data editing not yet implemented - toolResponse:', result.toolResponse);
				console.log('Structured data editing not yet implemented - toolResults:', result.toolResults);

				// Verify it was routed to search and replace
				assertStringIncludes(result.toolResponse, 'Some operations skipped or failed');

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
						'test.csv',
						`Response resourcePath should be "test.csv"`,
					);
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'structuredData',
						'Response editType should be "structuredData"',
					);
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.message,
						'Filesystem does not support structured data operations',
						'message should be indicate lack of structured data support',
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
	name: 'EditResourceTool - Access control validation',
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
				// Test path outside project
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-access-control',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: '../../../etc/passwd',
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'root',
								searchReplace_replace: 'hacked',
							},
						],
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Access denied:',
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Data source handling',
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
				// Create a test file
				const testResource = 'datasource-test.txt';
				const testResourcePath = `${testProjectRoot}/${testResource}`;
				await Deno.writeTextFile(testResourcePath, 'Testing data source handling');

				// Test with explicit data source ID (should work with primary)
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-datasource',
					toolName: 'edit_resource',
					toolInput: {
						dataSourceId: 'primary', // Use primary data source
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'Testing',
								searchReplace_replace: 'Verified',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify successful operation
				assertStringIncludes(result.toolResponse, 'All operations succeeded');

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
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'Response editType should be "searchReplace"',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						1,
						'Response operationsSuccessful should be 1',
					);
					assertEquals(
						result.bbResponse.data.dataSource.dsConnectionName,
						'primary',
						'Response dataSource name should be "primary"',
					);
				}

				// Verify the file was changed
				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Verified data source handling');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
