import { assert, assertEquals, assertRejects, assertStringIncludes, assertThrows } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';

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
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('rewrite existing file - bbResponse:', result.bbResponse);
				// console.log('rewrite existing file - toolResponse:', result.toolResponse);
				// console.log('rewrite existing file - toolResults:', result.toolResults);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB rewrote file test.txt with new contents',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, `Rewrote existing file`);
				assertStringIncludes(result.toolResults as string, `File ${testFile} rewritten with new contents`);

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
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');

				if (isString(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse,
						'BB created file new-test.txt with new contents',
					);
				} else {
					assert(false, 'bbResponse is not a string as expected');
				}

				assertStringIncludes(result.toolResponse, `Created a new file`);
				assertStringIncludes(result.toolResults as string, `File ${testFile} created with new contents`);

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
					},
				};

				assertRejects(
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
