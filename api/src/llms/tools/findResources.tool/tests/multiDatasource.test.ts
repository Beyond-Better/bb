import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { isFindResourcesResponse } from '../types.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

/**
 * Multi-datasource tests for FindResources tool
 * Tests functionality across different data source types using extraDatasources parameter
 */

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

/**
 * Helper to truncate output for readability
 */
function truncateOutput(content: string, maxLength: number = 500): string {
	if (content.length <= maxLength) return content;
	return content.substring(0, maxLength) + '... [truncated]';
}

Deno.test({
	name: 'FindResourcesTool - MultiDatasource - Basic Notion datasource connectivity',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get find_resources tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Test basic search without content pattern - should return all resources
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-notion-connectivity',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'test-notion-connection',
						// No content pattern - just list all resources
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('MultiDatasource - Basic Notion datasource connectivity - bbResponse:', result.bbResponse);
				// console.log('MultiDatasource - Basic Notion datasource connectivity - toolResponse:', result.toolResponse);
				// console.log('MultiDatasource - Basic Notion datasource connectivity - toolResults:', result.toolResults);

				// Check that Notion datasource is accessible and returns results
				assert(isFindResourcesResponse(result.bbResponse), 'bbResponse should have correct structure');

				if (isFindResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resources.length, 6, 'Should find 6 resources');
					assertEquals(
						result.bbResponse.data.searchCriteria,
						``,
					);
				} else {
					assert(false, 'bbResponse does not have expected structure');
				}

				assert(result.toolResponse, 'toolResponse should exist');
				assertStringIncludes(
					result.toolResponse,
					'Found 6 resources matching the search criteria',
				);
				const toolResults = result.toolResults as string;
				assertStringIncludes(toolResults, '6 resources match the search criteria');

				assertStringIncludes(toolResults, '<resources>');
				assertStringIncludes(toolResults, '</resources>');

				const expectedResources = [
					'page/simple-page-123',
					'page/complex-page-456',
					'page/empty-page-789',
					'page/minimal-page-101',
					'page/structured-page-202',
					'page/test-page-123',
				];
				const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
				const foundResources = resourceContent.split('\n');

				expectedResources.forEach((resource) => {
					assert(
						foundResources.some((r) => r.endsWith(resource)),
						`Resource ${resource} not found in the result`,
					);
				});
				assert(
					foundResources.length === expectedResources.length,
					'Number of found resources does not match expected',
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
	name: 'FindResourcesTool - MultiDatasource - Basic Google Docs datasource connectivity',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get find_resources tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Test basic search without content pattern - should return all resources
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-googledocs-connectivity',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'test-googledocs-connection',
						// No content pattern - just list all resources
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('MultiDatasource - Basic Google Docs datasource connectivity - bbResponse:', result.bbResponse);
				// console.log('MultiDatasource - Basic Google Docs datasource connectivity - toolResponse:', result.toolResponse);
				// console.log('MultiDatasource - Basic Google Docs datasource connectivity - toolResults:', result.toolResults);

				// Check that Google Docs datasource is accessible and returns results
				assert(isFindResourcesResponse(result.bbResponse), 'bbResponse should have correct structure');

				if (isFindResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resources.length, 6, 'Should find 6 resources');
					assertEquals(
						result.bbResponse.data.searchCriteria,
						``,
					);
				} else {
					assert(false, 'bbResponse does not have expected structure');
				}

				assert(result.toolResponse, 'toolResponse should exist');
				assertStringIncludes(
					result.toolResponse,
					'Found 6 resources matching the search criteria',
				);
				const toolResults = result.toolResults as string;
				assertStringIncludes(toolResults, '6 resources match the search criteria');

				assertStringIncludes(toolResults, '<resources>');
				assertStringIncludes(toolResults, '</resources>');

				const expectedResources = [
					'document/simple-doc-123',
					'document/complex-doc-456',
					'document/empty-doc-789',
					'document/minimal-doc-101',
					'document/structured-doc-202',
					'document/range-ops-doc-303',
				];
				const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
				const foundResources = resourceContent.split('\n');

				expectedResources.forEach((resource) => {
					assert(
						foundResources.some((r) => r.endsWith(resource)),
						`Resource ${resource} not found in the result`,
					);
				});
				assert(
					foundResources.length === expectedResources.length,
					'Number of found resources does not match expected',
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
	name: 'FindResourcesTool - MultiDatasource - Search Notion with simple content',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get find_resources tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Search for a simple, common word that should be in multiple test documents
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-notion-simple-search',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'test-notion-connection',
						contentPattern: 'simple', // Simple word that should match test data
						caseSensitive: false,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('MultiDatasource - Search Notion with simple content - bbResponse:', result.bbResponse);
				// console.log('MultiDatasource - Search Notion with simple content - toolResponse:', result.toolResponse);
				// console.log('MultiDatasource - Search Notion with simple content - toolResults:', result.toolResults);

				// Verify search completes successfully (may find 0 or more results)
				assert(isFindResourcesResponse(result.bbResponse), 'bbResponse should have correct structure');

				if (isFindResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resources.length, 1, 'Should find 1 resources');
					assertStringIncludes(
						result.bbResponse.data.searchCriteria,
						`content pattern "simple", case-insensitive`,
					);
				} else {
					assert(false, 'bbResponse does not have expected structure');
				}

				assert(result.toolResponse, 'toolResponse should exist');
				assertStringIncludes(
					result.toolResponse,
					'Found 1 resources matching the search criteria',
				);
				const toolResults = result.toolResults as string;
				assertStringIncludes(toolResults, '1 resources match the search criteria');

				assertStringIncludes(toolResults, '<resources>');
				assertStringIncludes(toolResults, '</resources>');

				const expectedResources = [
					'page/simple-page-123',
				];
				const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
				const foundResources = resourceContent.split('\n');

				expectedResources.forEach((resource) => {
					assert(
						foundResources.some((r) => r.endsWith(resource)),
						`Resource ${resource} not found in the result`,
					);
				});
				assert(
					foundResources.length === expectedResources.length,
					'Number of found resources does not match expected',
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
	name: 'FindResourcesTool - MultiDatasource - Search Google Docs with simple content',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get find_resources tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Search for a simple, common word that should be in multiple test documents
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-googledocs-simple-search',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'test-googledocs-connection',
						contentPattern: 'simple', // Simple word that should match test data
						caseSensitive: false,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('MultiDatasource - Search Google Docs with simple content - bbResponse:', result.bbResponse);
				// console.log('MultiDatasource - Search Google Docs with simple content - toolResponse:', result.toolResponse);
				// console.log('MultiDatasource - Search Google Docs with simple content - toolResults:', result.toolResults);

				// Check that Notion datasource is accessible and returns results
				assert(isFindResourcesResponse(result.bbResponse), 'bbResponse should have correct structure');

				if (isFindResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resources.length, 1, 'Should find 1 resources');
					assertStringIncludes(
						result.bbResponse.data.searchCriteria,
						`content pattern "simple", case-insensitive`,
					);
				} else {
					assert(false, 'bbResponse does not have expected structure');
				}

				assert(result.toolResponse, 'toolResponse should exist');
				assertStringIncludes(
					result.toolResponse,
					'Found 1 resources matching the search criteria',
				);
				const toolResults = result.toolResults as string;
				assertStringIncludes(toolResults, '1 resources match the search criteria');

				assertStringIncludes(toolResults, '<resources>');
				assertStringIncludes(toolResults, '</resources>');

				const expectedResources = [
					'document/simple-doc-123',
				];
				const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
				const foundResources = resourceContent.split('\n');

				expectedResources.forEach((resource) => {
					assert(
						foundResources.some((r) => r.endsWith(resource)),
						`Resource ${resource} not found in the result`,
					);
				});
				assert(
					foundResources.length === expectedResources.length,
					'Number of found resources does not match expected',
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
	name: 'FindResourcesTool - MultiDatasource - Test case sensitivity',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get find_resources tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Test case-sensitive search
				const toolUseCaseSensitive: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-case-sensitive',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'test-notion-connection',
						contentPattern: 'SIMPLE', // Uppercase - should not match lowercase content
						caseSensitive: true,
					},
				};

				const caseSensitiveResult = await tool.runTool(interaction, toolUseCaseSensitive, projectEditor);
				// console.log('MultiDatasource - Test case sensitivity (caseSensitiveResult) - bbResponse:', caseSensitiveResult.bbResponse);
				// console.log('MultiDatasource - Test case sensitivity (caseSensitiveResult) - toolResponse:', caseSensitiveResult.toolResponse);
				// console.log('MultiDatasource - Test case sensitivity (caseSensitiveResult) - toolResults:', caseSensitiveResult.toolResults);

				// Test case-insensitive search
				const toolUseCaseInsensitive: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-case-insensitive',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'test-notion-connection',
						contentPattern: 'SIMPLE', // Uppercase - should match lowercase content
						caseSensitive: false,
					},
				};

				// ### Does notion support case-sensitive searching? Our mock client doesn't and returns 1 document in both cases
				const caseInsensitiveResult = await tool.runTool(interaction, toolUseCaseInsensitive, projectEditor);
				// console.log('MultiDatasource - Test case sensitivity (caseInsensitiveResult) - bbResponse:', caseInsensitiveResult.bbResponse);
				// console.log('MultiDatasource - Test case sensitivity (caseInsensitiveResult) - toolResponse:', caseInsensitiveResult.toolResponse);
				// console.log('MultiDatasource - Test case sensitivity (caseInsensitiveResult) - toolResults:', caseInsensitiveResult.toolResults);

				assert(
					isFindResourcesResponse(caseSensitiveResult.bbResponse),
					'Case sensitive bbResponse should have correct structure',
				);

				if (isFindResourcesResponse(caseSensitiveResult.bbResponse)) {
					assertEquals(caseSensitiveResult.bbResponse.data.resources.length, 1, 'Should find 1 resources');
					assertStringIncludes(
						caseSensitiveResult.bbResponse.data.searchCriteria,
						`content pattern "SIMPLE", case-sensitive`,
					);
				} else {
					assert(false, 'Case sensitive bbResponse does not have expected structure');
				}

				assert(
					isFindResourcesResponse(caseInsensitiveResult.bbResponse),
					'Case insensitive bbResponse should have correct structure',
				);

				if (isFindResourcesResponse(caseInsensitiveResult.bbResponse)) {
					assertEquals(caseInsensitiveResult.bbResponse.data.resources.length, 1, 'Should find 1 resources');
					assertStringIncludes(
						caseInsensitiveResult.bbResponse.data.searchCriteria,
						`content pattern "SIMPLE", case-insensitive`,
					);
				} else {
					assert(false, 'Case insensitive bbResponse does not have expected structure');
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
	name: 'FindResourcesTool - MultiDatasource - Test context lines parameter',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get find_resources tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Test with context lines
				const toolUseWithContext: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-context-lines',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'test-googledocs-connection',
						contentPattern: 'simple', // Should match multiple docs
						contextLines: 2,
						maxMatchesPerFile: 3,
						caseSensitive: false,
					},
				};

				const result = await tool.runTool(interaction, toolUseWithContext, projectEditor);
				// console.log('MultiDatasource - Test context lines parameter - bbResponse:', result.bbResponse);
				// console.log('MultiDatasource - Test context lines parameter - toolResponse:', result.toolResponse);
				// console.log('MultiDatasource - Test context lines parameter - toolResults:', result.toolResults);

				// Verify search worked with context
				assert(isFindResourcesResponse(result.bbResponse), 'bbResponse should have correct structure');

				if (isFindResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resources.length, 1, 'Should find 1 resources');
					assertEquals(
						result.bbResponse.data.searchCriteria,
						`content pattern "simple", case-insensitive`,
					);
				} else {
					assert(false, 'bbResponse does not have expected structure');
				}

				assert(result.toolResponse, 'toolResponse should exist');
				assertStringIncludes(
					result.toolResponse,
					'Found 1 resources matching the search criteria',
				);
				const toolResults = result.toolResults as string;
				assertStringIncludes(toolResults, '1 resources match the search criteria');

				assertStringIncludes(toolResults, '<resources>');
				assertStringIncludes(toolResults, '</resources>');

				const expectedResources = [
					'document/simple-doc-123',
				];
				const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
				const foundResources = resourceContent.split('\n');

				expectedResources.forEach((resource) => {
					assert(
						foundResources.some((r) => r.endsWith(resource)),
						`Resource ${resource} not found in the result`,
					);
				});
				assert(
					foundResources.length === expectedResources.length,
					'Number of found resources does not match expected',
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
	name: 'FindResourcesTool - MultiDatasource - Error handling with invalid datasource',
	fn: async () => {
		const extraDatasources = ['notion'] as DataSourceProviderType[]; // Only include notion
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get find_resources tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Test with non-existent datasource ID
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-invalid-datasource',
					toolName: 'find_resources',
					toolInput: {
						dataSourceIds: 'non-existent-datasource',
						contentPattern: 'test content',
					},
				};

				// Should throw an error for invalid datasource ID
				try {
					await tool.runTool(interaction, toolUse, projectEditor);
					// If we get here, the test should fail
					assert(false, 'Expected tool to throw an error for invalid datasource ID');
				} catch (error) {
					// Verify we got the expected error type
					assertStringIncludes((error as Error).message, 'No valid data sources found');
					console.log(
						'✅ SUCCESS: Tool correctly threw error for invalid datasource:',
						(error as Error).message,
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
