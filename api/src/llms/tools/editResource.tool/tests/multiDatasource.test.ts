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
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
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
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - MultiDatasource - Block editing on Notion',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
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
					toolUseId: 'test-multi-ds-notion',
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
									children: [{ _type: 'span', text: 'Multi-Datasource Notion Test', marks: [] }],
								},
							},
							{
								editType: 'blocks',
								blocks_operationType: 'insert',
								blocks_position: 1,
								blocks_block: {
									_type: 'block',
									style: 'normal',
									children: [
										{
											_type: 'span',
											text: 'This content should work across all structured datasources.',
											marks: [],
										},
									],
								},
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify block operations worked on Notion
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
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'blocks');
					assertEquals(result.bbResponse.data.operationsApplied, 2);
					assertEquals(result.bbResponse.data.operationsSuccessful, 2);
				}

				// Verify datasource information
				// Check toolResults structure
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length >= 1, 'toolResults should have at least 1 element');

				const firstResult = result.toolResults[0] as LLMMessageContentPartTextBlock;
				assertStringIncludes(firstResult.text, 'test-notion-connection');
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - MultiDatasource - Range editing on Google Docs',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
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
					toolUseId: 'test-multi-ds-googledocs',
					toolName: 'edit_resource',
					toolInput: {
						dataSourceId: 'test-googledocs-connection',
						resourcePath: 'document/simple-doc-123',
						operations: [
							// Insert heading text at the beginning of the document
							{
								editType: 'range',
								range_rangeType: 'insertText',
								range_location: { index: 1 },
								range_text: 'Google Docs Integration Test\n\n',
							},
							// Apply heading 2 style to the title
							{
								editType: 'range',
								range_rangeType: 'updateParagraphStyle',
								range_range: { startIndex: 1, endIndex: 30 }, // Length of 'Google Docs Integration Test'
								range_paragraphStyle: {
									namedStyleType: 'HEADING_2',
								},
								range_fields: 'namedStyleType',
							},
							// Apply bold formatting to the title
							{
								editType: 'range',
								range_rangeType: 'updateTextStyle',
								range_range: { startIndex: 1, endIndex: 30 },
								range_textStyle: {
									bold: true,
								},
								range_fields: 'bold',
							},
							// Insert body paragraph
							{
								editType: 'range',
								range_rangeType: 'insertText',
								range_location: { index: 32 }, // After the heading and newlines
								range_text:
									'Testing range-based content editing across multiple datasource providers using Google Docs API.',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify range operations worked on Google Docs
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
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'range');
					assertEquals(result.bbResponse.data.operationsApplied, 4);
					assertEquals(result.bbResponse.data.operationsSuccessful, 4);
				}

				// Verify datasource information
				// Check toolResults structure
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length >= 1, 'toolResults should have at least 1 element');

				const firstResult = result.toolResults[0] as LLMMessageContentPartTextBlock;
				assertStringIncludes(firstResult.text, 'test-googledocs-connection');
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - MultiDatasource - Mixed operations across datasources',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
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
				// First: Edit a filesystem file
				const testFile = 'mixed-operations-test.txt';
				const testFilePath = `${testProjectRoot}/${testFile}`;
				await Deno.writeTextFile(testFilePath, 'Original filesystem content');

				const filesystemEdit: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-mixed-filesystem',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testFile,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'Original',
								searchReplace_replace: 'Updated',
							},
						],
					},
				};

				const filesystemResult = await tool.runTool(interaction, filesystemEdit, projectEditor);
				assertStringIncludes(filesystemResult.toolResponse, 'All operations succeeded');

				// Verify filesystem edit worked
				const updatedContent = await Deno.readTextFile(testFilePath);
				assertEquals(updatedContent, 'Updated filesystem content');

				// Second: Edit a Notion page
				const notionEdit: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-mixed-notion',
					toolName: 'edit_resource',
					toolInput: {
						dataSourceId: 'test-notion-connection',
						resourcePath: 'page/minimal-page-101',
						operations: [
							{
								editType: 'blocks',
								blocks_operationType: 'insert',
								blocks_position: 0,
								blocks_block: {
									_type: 'block',
									style: 'normal',
									children: [{ _type: 'span', text: 'Mixed operation workflow test', marks: [] }],
								},
							},
						],
					},
				};

				const notionResult = await tool.runTool(interaction, notionEdit, projectEditor);
				assertStringIncludes(notionResult.toolResponse, 'operations succeeded');

				// Verify structured bbResponse for Notion
				assert(
					notionResult.bbResponse && typeof notionResult.bbResponse === 'object',
					'notionResult bbResponse should be an object',
				);
				assert(
					isEditResourceResponse(notionResult.bbResponse),
					'notionResult bbResponse should have the correct EditResource structure',
				);

				// Verify different operation types work with same tool
				if (isEditResourceResponse(filesystemResult.bbResponse)) {
					assertEquals(
						filesystemResult.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'Filesystem result should be searchReplace type',
					);
				}
				if (isEditResourceResponse(notionResult.bbResponse)) {
					assertEquals(
						notionResult.bbResponse.data.operationResults?.[0]?.editType,
						'blocks',
						'Notion result should be block-edit type',
					);
				}
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - MultiDatasource - Invalid datasource handling',
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
				// Test with non-existent datasource ID
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-invalid-datasource',
					toolName: 'edit_resource',
					toolInput: {
						dataSourceId: 'non-existent-datasource',
						resourcePath: 'page/simple-page-123',
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'test',
								searchReplace_replace: 'example',
							},
						],
					},
				};

				// Should handle invalid datasource gracefully
				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					// Should reject with appropriate error message
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
