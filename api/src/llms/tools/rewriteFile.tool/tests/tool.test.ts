import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';

//import LLMToolRewriteFile from '../tool.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import { FileHandlingError } from 'api/errors/error.ts';

const VALID_ACKNOWLEDGEMENT = 'I confirm this is the complete file content with no omissions or placeholders';

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'Rewrite File Tool - rewrite existing file',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB rewrote file test.txt with new contents (1 lines)');
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB created file new-test.txt with new contents (1 lines)');
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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
				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB created file empty.txt with new contents (0 lines)');

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
				assert(isString(result2.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result2.bbResponse, 'BB rewrote file empty.txt with new contents (0 lines)');

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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(
					result.bbResponse,
					'BB created file test.txt with new contents (3 lines).\nLine count mismatch. Content has 3 lines but expected 5 lines.',
				);
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
/*  // TODO Either LLM or the tool is having trouble counting lines in real usage, so line count checks in tool have been changed to warnings rather than throwing errors.
    // Either use this test for throwing exception, or test above for warning string
Deno.test({
	name: 'Rewrite File Tool - line count mismatch',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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
