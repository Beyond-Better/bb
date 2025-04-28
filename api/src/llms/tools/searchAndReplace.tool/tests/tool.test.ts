import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
//import { existsSync } from '@std/fs';

//import LLMToolSearchAndReplace from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'SearchAndReplaceTool - Basic functionality',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'world', replace: 'Deno' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Basic functionality - bbResponse:', result.bbResponse);
				// console.log('Basic functionality - toolResponse:', result.toolResponse);
				// console.log('Basic functionality - toolResults:', result.toolResults);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(secondResult.text, 'Search and replace operations applied to resource: test.txt');
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(thirdResult.text, '✅  Operation 1 completed successfully');

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
	name: 'SearchAndReplaceTool - Multiple operations on new resource',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const newResource = 'multi_op_test.txt';
				const newResourcePath = getTestFilePath(testProjectRoot, newResource);
				console.log(`testing with resource: ${newResourcePath}`);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: newResource,
						operations: [
							{ search: '', replace: 'Hello, world!' },
							{ search: 'world', replace: 'Deno' },
							{ search: 'Hello', replace: 'Greetings' },
						],
						createIfMissing: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log(`created resource: ${newResourcePath}`);
				// console.log('Multiple operations on new resource - bbResponse:', result.bbResponse);
				// console.log('Multiple operations on new resource - toolResponse:', result.toolResponse);
				// console.log('Multiple operations on new resource - toolResults:', result.toolResults);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 5, 'toolResults should have 5 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Resource created and search and replace operations applied to resource: multi_op_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(operationResult.text, `✅  Operation ${i} completed successfully`);
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
	name: 'SearchAndReplaceTool - Attempt to create resource outside project root',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = '../outside_project.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: '', replace: 'This should not be created' },
						],
						createIfMissing: true,
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
	name: 'SearchAndReplaceTool - Empty operations array',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [],
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'No changes were made to the resource',
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
	name: 'SearchAndReplaceTool - Unicode characters',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: '世界', replace: '🌍' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: unicode_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(thirdResult.text, '✅  Operation 1 completed successfully');

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
	name: "SearchAndReplaceTool - Create new resource if it doesn't exist",
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: newResource,
						operations: [
							{ search: '', replace: 'Hello, new file!' },
						],
						createIfMissing: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Resource created and search and replace operations applied to resource: new_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(thirdResult.text, '✅  Operation 1 completed successfully');

				const resourceContent = await Deno.readTextFile(newResourcePath);
				assertEquals(resourceContent, 'Hello, new file!');

				// Verify that the resource is added to changedResources and changeContents
				// [TODO] the changedResources and changedContents get cleared after saving to conversation
				// So change assertions to check the changed resources in persisted conversation
				//assert(projectEditor.changedResources.has(newResource));
				//assert(projectEditor.changeContents.has(newResource));
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchAndReplaceTool - No changes when search string not found',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'Deno', replace: 'TypeScript' },
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

Deno.test({
	name: 'SearchAndReplaceTool - Multiline search and replace',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								search: 'function test() {\n\tconsole.log("Hello");\n}',
								replace: 'function newTest() {\n\tconsole.log("Hello, World!");\n}',
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: multiline_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(thirdResult.text, '✅  Operation 1 completed successfully');

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
	name: 'SearchAndReplaceTool - Replace with empty string',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'world', replace: '' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: empty_replace_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(thirdResult.text, 'Operation 1 completed successfully');

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
	name: 'SearchAndReplaceTool - Case sensitive search (default)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'World', replace: 'Deno' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: case_sensitive_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(thirdResult.text, '✅  Operation 1 completed successfully');

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
	name: 'SearchAndReplaceTool - Case insensitive search',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'world', replace: 'Deno', replaceAll: true, caseSensitive: false },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Case insensitive search - bbResponse:', result.bbResponse);
				// console.log('Case insensitive search - toolResponse:', result.toolResponse);
				// console.log('Case insensitive search - toolResults:', result.toolResults);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: case_insensitive_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'Second result should be of type text');
				assertStringIncludes(thirdResult.text, '✅  Operation 1 completed successfully');

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
	name: 'SearchAndReplaceTool - Multiple non-overlapping replacements',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'quick', replace: 'slow' },
							{ search: 'brown', replace: 'red' },
							{ search: 'lazy', replace: 'energetic' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 5, 'toolResults should have 5 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: multiple_replace_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(operationResult.text, `✅  Operation ${i} completed successfully`);
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
	name: 'SearchAndReplaceTool - Multiple replacements',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'multiple_replace_test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);
				await Deno.writeTextFile(testResourcePath, 'abcdefg');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'abc', replace: 'ABC' },
							{ search: 'efg', replace: 'EFG' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 4, 'toolResults should have 4 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: multiple_replace_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				for (let i = 1; i <= 2; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(operationResult.text, `✅  Operation ${i} completed successfully`);
				}

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
	name: 'SearchAndReplaceTool - Overlapping replacements',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: 'abc', replace: 'ABC' },
							{ search: 'Cde', replace: 'CDE' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 4, 'toolResults should have 4 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: overlapping_replace_test.txt',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				for (let i = 1; i <= 2; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(operationResult.text, `✅  Operation ${i} completed successfully`);
				}

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
	name: 'SearchAndReplaceTool - Basic regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: String.raw`qu\w+`, replace: 'fast', regexPattern: true },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Basic regex pattern - bbResponse:', result.bbResponse);
				// console.log('Basic regex pattern - toolResponse:', result.toolResponse);
				// console.log('Basic regex pattern - toolResults:', result.toolResults);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assert(Array.isArray(result.toolResults), 'toolResults should be an array');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					`Search and replace operations applied to resource: regex_test.txt. All operations succeeded`,
				);
				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					thirdResult.text,
					`✅  Operation 1 completed successfully`,
				);

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
	name: 'SearchAndReplaceTool - Regex pattern with capture groups',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{
								search: String.raw`Hello, (\w+)!`,
								replace: 'Hi, $1!',
								regexPattern: true,
								replaceAll: true,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assert(Array.isArray(result.toolResults), 'toolResults should be an array');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					`Search and replace operations applied to resource: regex_capture_test.txt. All operations succeeded`,
				);
				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					thirdResult.text,
					`✅  Operation 1 completed successfully`,
				);

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
	name: 'SearchAndReplaceTool - Regex pattern with quantifiers',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: String.raw`\w{3,}`, replace: 'X', regexPattern: true, replaceAll: true },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assert(Array.isArray(result.toolResults), 'toolResults should be an array');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					`Search and replace operations applied to resource: regex_quantifier_test.txt. All operations succeeded`,
				);
				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					thirdResult.text,
					`✅  Operation 1 completed successfully`,
				);

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
	name: 'SearchAndReplaceTool - Regex pattern with character classes',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: String.raw`[a-c][1-3]`, replace: 'X', regexPattern: true, replaceAll: true },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assert(Array.isArray(result.toolResults), 'toolResults should be an array');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					`Search and replace operations applied to resource: regex_character_class_test.txt. All operations succeeded`,
				);
				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					thirdResult.text,
					`✅  Operation 1 completed successfully`,
				);

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
	name: 'SearchAndReplaceTool - Regex pattern with word boundaries',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: String.raw`\bcat\b`, replace: 'dog', regexPattern: true },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB applied search and replace operations.',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assert(Array.isArray(result.toolResults), 'toolResults should be an array');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					`Search and replace operations applied to resource: regex_word_boundary_test.txt. All operations succeeded`,
				);
				const thirdResult = result.toolResults[2];
				assert(thirdResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					thirdResult.text,
					`✅  Operation 1 completed successfully`,
				);

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
	name: 'SearchAndReplaceTool - Case-sensitive literal search with special regex characters',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: String.raw`(quick)`, replace: 'fast', regexPattern: false, caseSensitive: true },
							{ search: String.raw`[fox]`, replace: 'cat', regexPattern: false, caseSensitive: true },
							{ search: String.raw`{lazy}`, replace: 'active', regexPattern: false, caseSensitive: true },
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

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: literal_regex_test.txt. All operations succeeded',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(operationResult.text, `✅  Operation ${i} completed successfully`);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

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
	name: 'SearchAndReplaceTool - Case-insensitive literal search with special regex characters',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_and_replace');
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
					toolName: 'search_and_replace',
					toolInput: {
						resourcePath: testResource,
						operations: [
							{ search: String.raw`(quick)`, replace: 'fast', regexPattern: false, caseSensitive: false },
							{ search: String.raw`[fox]`, replace: 'cat', regexPattern: false, caseSensitive: false },
							{
								search: String.raw`{lazy}`,
								replace: 'active',
								regexPattern: false,
								caseSensitive: false,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 5, 'toolResults should have 5 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Search and replace operations applied to resource: literal_regex_case_insensitive_test.txt. All operations succeeded',
				);
				assertStringIncludes(secondResult.text, 'All operations succeeded');

				for (let i = 1; i <= 3; i++) {
					const operationResult = result.toolResults[i + 1];
					assert(operationResult.type === 'text', `Result ${i} should be of type text`);
					assertStringIncludes(operationResult.text, `✅  Operation ${i} completed successfully`);
				}

				assertStringIncludes(result.toolResponse, 'All operations succeeded');

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

//cleanupTestDirectory();
