import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';

//import LLMToolRewriteFile from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import { FileHandlingError } from 'api/errors/error.ts';
import type { LLMToolRewriteFileResponseData } from '../types.ts';

//const VALID_ACKNOWLEDGEMENT = 'I confirm this is the complete file content with no omissions or placeholders';
const VALID_ACKNOWLEDGEMENT =
	'I have checked for existing file contents and confirm this is the complete file content with no omissions or placeholders';

// Type guard function
function isRunCommandResponse(
	response: unknown,
): response is LLMToolRewriteFileResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'filePath' in data &&
		typeof data.filePath === 'string' &&
		'lineCount' in data &&
		typeof data.lineCount === 'number' &&
		'isNewFile' in data &&
		typeof data.isNewFile === 'boolean' &&
		'lineCountError' in data &&
		(typeof data.lineCountError === 'string' ||
			typeof data.lineCountError === 'undefined')
	);
}

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'Rewrite File Tool - rewrite existing file',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file
				const testFile = 'test.txt';
				const testFilePath = getTestFilePath(testProjectRoot, testFile);
				await Deno.writeTextFile(testFilePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'New content',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 1,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('rewrite existing file - bbResponse:', result.bbResponse);
				// console.log('rewrite existing file - toolResponse:', result.toolResponse);
				// console.log('rewrite existing file - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isRunCommandResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRunCommandResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filePath,
						'test.txt',
						'Test response filePath should be "test.txt"',
					);
					assertEquals(
						result.bbResponse.data.lineCount,
						1,
						'Test response lineCount should be 1',
					);

					assertEquals(result.bbResponse.data.isNewFile, false, 'Test response isNewFile should be false');

					assertEquals(
						result.bbResponse.data.lineCountError,
						undefined,
						'Test response assertEquals should be undefined',
					);
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Rewrote test.txt with 1 lines of content');
				if (isString(result.toolResults)) {
					assertStringIncludes(result.toolResults, 'File test.txt rewritten with new contents (1 lines)');
				} else {
					assert(false, 'toolResults is not a string as expected');
				}

				const newContent = await Deno.readTextFile(testFilePath);
				assertEquals(newContent, 'New content');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Rewrite File Tool - create new file',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file
				const testFile = 'new-test.txt';
				const testFilePath = getTestFilePath(testProjectRoot, testFile);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'New file content',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 1,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('create new file - bbResponse:', result.bbResponse);
				// console.log('create new file - toolResponse:', result.toolResponse);
				// console.log('create new file - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isRunCommandResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRunCommandResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filePath,
						testFile,
						'Test response filePath should be "new-test.txt"',
					);
					assertEquals(
						result.bbResponse.data.lineCount,
						1,
						'Test response lineCount should be 1',
					);

					assertEquals(result.bbResponse.data.isNewFile, true, 'Test response isNewFile should be true');

					assertEquals(
						result.bbResponse.data.lineCountError,
						undefined,
						'Test response assertEquals should be undefined',
					);
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Created new-test.txt with 1 lines of content');
				if (isString(result.toolResults)) {
					assertStringIncludes(result.toolResults, 'File new-test.txt created with new contents (1 lines)');
				} else {
					assert(false, 'toolResults is not a string as expected');
				}

				assert(await Deno.stat(testFilePath));
				const newContent = await Deno.readTextFile(testFilePath);
				assertEquals(newContent, 'New file content');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Rewrite File Tool - invalid acknowledgement string',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testFile = 'test.txt';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'New content',
						acknowledgement: 'I verify this is complete',
						expectedLineCount: 1,
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					FileHandlingError,
					'Invalid acknowledgement string',
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
	name: 'Rewrite File Tool - empty file handling',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testFile = 'empty.txt';
				//const testFilePath = getTestFilePath(testProjectRoot, testFile);

				// Test empty content
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: '',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 0,
						allowEmptyContent: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('empty file handling - bbResponse:', result.bbResponse);
				// console.log('empty file handling - toolResponse:', result.toolResponse);
				// console.log('empty file handling - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isRunCommandResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRunCommandResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filePath,
						testFile,
						'Test response filePath should be "empty.txt"',
					);
					assertEquals(
						result.bbResponse.data.lineCount,
						0,
						'Test response lineCount should be 0',
					);

					assertEquals(result.bbResponse.data.isNewFile, true, 'Test response isNewFile should be true');

					assertEquals(
						result.bbResponse.data.lineCountError,
						undefined,
						'Test response assertEquals should be undefined',
					);
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				// Test single empty line (should be treated same as empty file)
				const toolUse2: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-2',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: '\n',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 0,
						allowEmptyContent: true,
					},
				};

				const result2 = await tool.runTool(interaction, toolUse2, projectEditor);
				//console.log('empty file handling-2 - bbResponse:', result2.bbResponse);
				//console.log('empty file handling-2 - toolResponse:', result2.toolResponse);
				//console.log('empty file handling-2 - toolResults:', result2.toolResults);

				assert(
					result2.bbResponse && typeof result2.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isRunCommandResponse(result2.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRunCommandResponse(result2.bbResponse)) {
					assertEquals(
						result2.bbResponse.data.filePath,
						testFile,
						'Test response filePath should be "empty.txt"',
					);
					assertEquals(
						result2.bbResponse.data.lineCount,
						0,
						'Test response lineCount should be 0',
					);

					assertEquals(result2.bbResponse.data.isNewFile, false, 'Test response isNewFile should be false');

					assertEquals(
						result2.bbResponse.data.lineCountError,
						undefined,
						'Test response assertEquals should be undefined',
					);
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				// Test empty content rejection when allowEmptyContent is false
				const toolUse3: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-3',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: '',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 0,
						allowEmptyContent: false, // default behavior
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse3, projectEditor),
					FileHandlingError,
					'The content is empty and allowEmptyContent is false',
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

// TODO Either LLM or the tool is having trouble counting lines in real usage, so line count checks in tool have been changed to warnings rather than throwing errors.
// Test to check for exceptions is commented out below
Deno.test({
	name: 'Rewrite File Tool - line count mismatch',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testFile = 'test.txt';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'Line 1\nLine 2\nLine 3',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 5, // Actual is 3
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('line count mismatch - bbResponse:', result.bbResponse);
				// console.log('line count mismatch - toolResponse:', result.toolResponse);
				// console.log('line count mismatch - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isRunCommandResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRunCommandResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filePath,
						testFile,
						'Test response filePath should be "empty.txt"',
					);
					assertEquals(
						result.bbResponse.data.lineCount,
						3,
						'Test response lineCount should be 3',
					);

					assertEquals(result.bbResponse.data.isNewFile, true, 'Test response isNewFile should be true');

					assertEquals(
						result.bbResponse.data.lineCountError,
						'Line count mismatch. Content has 3 lines but expected 5 lines.',
						'Test response lineCountError should be Line count mismatch',
					);
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Created test.txt with 3 lines of content');
				if (isString(result.toolResults)) {
					assertStringIncludes(result.toolResults, 'File test.txt created with new contents (3 lines)');
				} else {
					assert(false, 'toolResults is not a string as expected');
				}
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
/*
    // TODO Either LLM or the tool is having trouble counting lines in real usage, so line count checks in tool have been changed to warnings rather than throwing errors.
    // Either use this test for throwing exception, or test above for warning string
Deno.test({
	name: 'Rewrite File Tool - line count mismatch',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testFile = 'test.txt';
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: 'Line 1\nLine 2\nLine 3',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 5, // Actual is 3
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					FileHandlingError,
					'Line count mismatch',
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
 */

Deno.test({
	name: 'Rewrite File Tool - line count tolerance',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testFile = 'test.txt';
				//const testFilePath = getTestFilePath(testProjectRoot, testFile);

				// Test small file (exact match required)
				const smallFileContent = 'Line 1\nLine 2\nLine 3';
				const toolUse1: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: smallFileContent,
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 3,
					},
				};

				const result1 = await tool.runTool(interaction, toolUse1, projectEditor);
				if (isString(result1.toolResults)) {
					assertStringIncludes(result1.toolResults, '3 lines');
				} else {
					assert(false, 'toolResults is not a string as expected');
				}

				// Test medium file (±2 lines tolerance)
				let mediumFileContent = '';
				for (let i = 1; i <= 50; i++) {
					mediumFileContent += `Line ${i}\n`;
				}
				const toolUse2: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-2',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: mediumFileContent,
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 51, // Actual is 50, but within tolerance
					},
				};

				const result2 = await tool.runTool(interaction, toolUse2, projectEditor);
				if (isString(result2.toolResults)) {
					assertStringIncludes(result2.toolResults, '50 lines');
				} else {
					assert(false, 'toolResults is not a string as expected');
				}

				// Test large file (5% tolerance)
				let largeFileContent = '';
				for (let i = 1; i <= 200; i++) {
					largeFileContent += `Line ${i}\n`;
				}
				const toolUse3: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-3',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFile,
						content: largeFileContent,
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 208, // Within 5% of 200
					},
				};

				const result3 = await tool.runTool(interaction, toolUse3, projectEditor);
				if (isString(result3.toolResults)) {
					assertStringIncludes(result3.toolResults, '200 lines');
				} else {
					assert(false, 'toolResults is not a string as expected');
				}
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Rewrite File Tool - throw error for file outside project',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('rewrite_file');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Create a test file
				const testFilePath = '/tmp/outside_project.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rewrite_file',
					toolInput: {
						filePath: testFilePath,
						content: 'New content',
						acknowledgement: VALID_ACKNOWLEDGEMENT,
						expectedLineCount: 1,
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					FileHandlingError,
					`Access denied: ${testFilePath} is outside the project directory`,
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
