import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import { isEditResourceResponse } from '../types.ts';

/**
 * Comprehensive search and replace tests for EditResource tool
 * These tests preserve ALL functionality from the original searchAndReplace.tool
 * CRITICAL: Every test case from searchAndReplace.tool must be maintained here
 */

// Helper to check bbResponse structure
function assertValidEditResourceResponse(result: any, testName: string) {
	assert(
		result.bbResponse && typeof result.bbResponse === 'object',
		`${testName}: bbResponse should be an object`,
	);
	assert(
		isEditResourceResponse(result.bbResponse),
		`${testName}: bbResponse should have the correct EditResource structure`,
	);
}

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Basic functionality',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test resource
				const testResource = 'test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Hello, world!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
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
				// console.log('Basic functionality - bbResponse:', result.bbResponse);
				// console.log('Basic functionality - toolResponse:', result.toolResponse);
				// console.log('Basic functionality - toolResults:', result.toolResults);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Basic functionality');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'editType should be search-replace',
					);
					assertEquals(
						result.bbResponse.data.operationsApplied,
						1,
						'operationsApplied should be 1',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						1,
						'operationsSuccessful should be 1',
					);
					assertEquals(
						result.bbResponse.data.operationsFailed,
						0,
						'operationsFailed should be 0',
					);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(secondResult.text, 'Edit operations applied to resource: test.txt.');
				assertStringIncludes(secondResult.text, 'All operations succeeded');
				assertStringIncludes(secondResult.text, '1/1 operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Third result should be of type text');
				assertStringIncludes(
					thirdResult.text,
					'PASS Operation 1 (searchReplace): Operation 1 completed successfully',
				);

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
	name: 'EditResourceTool - SearchAndReplace - Regex pattern with quantifiers',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'regex_quantifier_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'aaa bbb ccccc dddd');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`\w{3,}`,
								searchReplace_replace: 'X',
								searchReplace_regexPattern: true,
								searchReplace_replaceAll: true,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log(`created resource: ${newResourcePath}`);
				// console.log('Regex pattern with quantifiers - bbResponse:', result.bbResponse);
				// console.log('Regex pattern with quantifiers - toolResponse:', result.toolResponse);
				// console.log('Regex pattern with quantifiers - toolResults:', result.toolResults);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Unicode characters');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'editType should be search-replace',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						1,
						'operationsSuccessful should be 1',
					);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'X X X X');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Regex pattern with character classes',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'regex_character_class_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'a1 b2 c3 d4 e5');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`[a-c][1-3]`,
								searchReplace_replace: 'X',
								searchReplace_regexPattern: true,
								searchReplace_replaceAll: true,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, "Create new resource if it doesn't exist");

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'editType should be search-replace',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						false,
						'isNewResource should be false',
					);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'X X X d4 e5');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Regex pattern with word boundaries',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'regex_word_boundary_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'The cat is in the category');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`\bcat\b`,
								searchReplace_replace: 'dog',
								searchReplace_regexPattern: true,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Multiline search and replace');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'editType should be search-replace',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						1,
						'operationsSuccessful should be 1',
					);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'The dog is in the category');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Case-sensitive literal search with special regex characters',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'literal_regex_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'The (quick) brown [fox] jumps over the {lazy} dog.');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`(quick)`,
								searchReplace_replace: 'fast',
								searchReplace_regexPattern: false,
								searchReplace_caseSensitive: true,
							},
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`[fox]`,
								searchReplace_replace: 'cat',
								searchReplace_regexPattern: false,
								searchReplace_caseSensitive: true,
							},
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`{lazy}`,
								searchReplace_replace: 'active',
								searchReplace_regexPattern: false,
								searchReplace_caseSensitive: true,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Case-sensitive literal search with special regex characters - bbResponse:', result.bbResponse);
				// console.log('Case-sensitive literal search with special regex characters - toolResponse:', result.toolResponse);
				// console.log('Case-sensitive literal search with special regex characters - toolResults:', result.toolResults);

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 5, 'toolResults should have 5 elements');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(
						operationResult.text,
						`PASS Operation ${i} (searchReplace): Operation ${i} completed successfully`,
					);
				}

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'The fast brown cat jumps over the active dog.');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Case-insensitive literal search with special regex characters',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'literal_regex_case_insensitive_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'The (QUICK) brown [FOX] jumps over the {LAZY} dog.');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`(quick)`,
								searchReplace_replace: 'fast',
								searchReplace_regexPattern: false,
								searchReplace_caseSensitive: false,
							},
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`[fox]`,
								searchReplace_replace: 'cat',
								searchReplace_regexPattern: false,
								searchReplace_caseSensitive: false,
							},
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`{lazy}`,
								searchReplace_replace: 'active',
								searchReplace_regexPattern: false,
								searchReplace_caseSensitive: false,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Case-insensitive literal search with special regex characters - bbResponse:', result.bbResponse);
				// console.log('Case-insensitive literal search with special regex characters - toolResponse:', result.toolResponse);
				// console.log('Case-insensitive literal search with special regex characters - toolResults:', result.toolResults);

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 5, 'toolResults should have 5 elements');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(
						operationResult.text,
						`PASS Operation ${i} (searchReplace): Operation ${i} completed successfully`,
					);
				}

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'The fast brown cat jumps over the active dog.');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Multiple non-overlapping replacements',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'multiple_replace_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'The quick brown fox jumps over the lazy dog');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'quick',
								searchReplace_replace: 'slow',
							},
							{
								editType: 'searchReplace',
								searchReplace_search: 'brown',
								searchReplace_replace: 'red',
							},
							{
								editType: 'searchReplace',
								searchReplace_search: 'lazy',
								searchReplace_replace: 'energetic',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Replace with empty string');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'editType should be search-replace',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						3,
						'operationsSuccessful should be 3',
					);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 5, 'toolResults should have 5 elements');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(
						operationResult.text,
						`PASS Operation ${i} (searchReplace): Operation ${i} completed successfully`,
					);
				}

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'The slow red fox jumps over the energetic dog');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Multiple replacements',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'multiple_replace_test2.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'abcdefg');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'abc',
								searchReplace_replace: 'ABC',
							},
							{
								editType: 'searchReplace',
								searchReplace_search: 'efg',
								searchReplace_replace: 'EFG',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Multiple non-overlapping replacements');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsApplied, 2);
					assertEquals(result.bbResponse.data.operationsSuccessful, 2);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'ABCdEFG');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Overlapping replacements',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'overlapping_replace_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'abcdefg');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ editType: 'searchReplace', searchReplace_search: 'abc', searchReplace_replace: 'ABC' },
							{
								editType: 'searchReplace',
								searchReplace_search: 'Cde',
								searchReplace_replace: 'CDE',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Multiple replacements');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsApplied, 2);
					assertEquals(result.bbResponse.data.operationsSuccessful, 2);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'ABCDEfg');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Basic regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'regex_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'The quick brown fox jumps over the lazy dog');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`qu\w+`,
								searchReplace_replace: 'fast',
								searchReplace_regexPattern: true,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Overlapping replacements');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsApplied, 1);
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'The fast brown fox jumps over the lazy dog');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Regex pattern with capture groups',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'regex_capture_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Hello, John! Hello, Jane!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: String.raw`Hello, (\w+)!`,
								searchReplace_replace: 'Hi, $1!',
								searchReplace_regexPattern: true,
								searchReplace_replaceAll: true,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Basic regex pattern');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Hi, John! Hi, Jane!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Multiline search and replace',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'multiline_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'function test() {\n\tconsole.log("Hello");\n}');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'function test() {\n\tconsole.log("Hello");\n}',
								searchReplace_replace: 'function newTest() {\n\tconsole.log("Hello, World!");\n}',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Regex pattern with capture groups');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'function newTest() {\n\tconsole.log("Hello, World!");\n}');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Replace with empty string',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'empty_replace_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Hello, world!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'world',
								searchReplace_replace: '',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Regex pattern with quantifiers');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Hello, !');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Case sensitive search (default)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'case_sensitive_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Hello, World! hello, world!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'World',
								searchReplace_replace: 'Deno',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Case sensitive search (default)');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Hello, Deno! hello, world!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Case insensitive search',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'case_insensitive_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Hello, World! hello, world!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'world',
								searchReplace_replace: 'Deno',
								searchReplace_replaceAll: true,
								searchReplace_caseSensitive: false,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Case insensitive search');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Hello, Deno! hello, Deno!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Multiple operations on new resource',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const newResource = 'multi_op_test.txt';
				const newResourcePath = getTestFilePath(testProjectRoot, newResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: newResource,
						createIfMissing: true,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: '',
								searchReplace_replace: 'Hello, world!',
							},
							{
								editType: 'searchReplace',
								searchReplace_search: 'world',
								searchReplace_replace: 'Deno',
							},
							{
								editType: 'searchReplace',
								searchReplace_search: 'Hello',
								searchReplace_replace: 'Greetings',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Multiple operations on new resource - bbResponse:', result.bbResponse);
				console.log('Multiple operations on new resource - toolResponse:', result.toolResponse);
				console.log('Multiple operations on new resource - toolResults:', result.toolResults);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Multiple operations on new resource');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.operationResults?.[0]?.editType,
						'searchReplace',
						'editType should be search-replace',
					);
					assertEquals(
						result.bbResponse.data.operationsApplied,
						3,
						'operationsApplied should be 3',
					);
					assertEquals(
						result.bbResponse.data.operationsSuccessful,
						3,
						'operationsSuccessful should be 3',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						true,
						'isNewResource should be true',
					);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 5, 'toolResults should have 5 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Resource created and Edit operations applied to resource: multi_op_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(
						operationResult.text,
						`PASS Operation ${i} (searchReplace): Operation ${i} completed successfully`,
					);
				}

				const resourceContent = await Deno.readTextFile(newResourcePath);
				assertEquals(resourceContent, 'Greetings, Deno!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Attempt to create resource outside project root',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = '../outside_project.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						createIfMissing: true,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: '',
								searchReplace_replace: 'This should not be created',
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
	name: 'EditResourceTool - SearchAndReplace - Empty operations array',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'empty_ops_test.txt';
				const testResourcePath = join(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [],
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'operations array cannot be empty',
				);

				const resourceContent = await Deno.readTextFile(testResourcePath);
				assertEquals(resourceContent, 'Original content');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - Unicode characters',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'unicode_test.txt';
				const testResourcePath = join(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Hello, 世界!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ editType: 'searchReplace', searchReplace_search: '世界', searchReplace_replace: '🌍' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Regex pattern with character classes');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				const resourceContent = await Deno.readTextFile(testResourcePath);
				assertEquals(resourceContent, 'Hello, 🌍!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: "EditResourceTool - SearchAndReplace - Create new resource if it doesn't exist",
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const newResource = 'new_test.txt';
				const newResourcePath = getTestFilePath(testProjectRoot, newResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: newResource,
						createIfMissing: true,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: '',
								searchReplace_replace: 'Hello, new file!',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify structured bbResponse
				assertValidEditResourceResponse(result, 'Regex pattern with word boundaries');

				if (isEditResourceResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.operationResults?.[0]?.editType, 'searchReplace');
					assertEquals(result.bbResponse.data.operationsSuccessful, 1);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Resource created and Edit operations applied to resource: new_test.txt',
				);

				const resourceContent = await Deno.readTextFile(newResourcePath);
				assertEquals(resourceContent, 'Hello, new file!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - SearchAndReplace - No changes when search string not found',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('edit_resource');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'test.txt';
				const testResourcePath = join(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'Hello, world!');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'edit_resource',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								editType: 'searchReplace',
								searchReplace_search: 'Deno',
								searchReplace_replace: 'TypeScript',
							},
						],
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'No changes were made to the resource',
				);

				const updatedContent = await Deno.readTextFile(testResourcePath);
				assertEquals(updatedContent, 'Hello, world!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
