import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getTestProvider,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import { ResourceHandlingError, ToolHandlingError } from 'api/errors/error.ts';
import type { LLMToolWriteResourceResponseData } from '../types.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

const VALID_ACKNOWLEDGEMENT =
	'I have checked for existing resource contents and confirm this is the complete resource content with no omissions or placeholders';

// Type guard function
function isWriteResourceResponse(
	response: unknown,
): response is LLMToolWriteResourceResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resourcePath' in data &&
		typeof data.resourcePath === 'string' &&
		'contentType' in data &&
		typeof data.contentType === 'string' &&
		'size' in data &&
		typeof data.size === 'number' &&
		'isNewResource' in data &&
		typeof data.isNewResource === 'boolean'
	);
}

// Type guard to check if toolResults is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'Write Resource Tool - create new plain text resource',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'new-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: 'Hello, world!',
							acknowledgement: VALID_ACKNOWLEDGEMENT,
							expectedLineCount: 1,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('create new plain text resource - bbResponse:', result.bbResponse);
				// console.log('create new plain text resource - toolResponse:', result.toolResponse);
				// console.log('create new plain text resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcePath,
						testResource,
						`Test response resourcePath should be "${testResource}"`,
					);
					assertEquals(
						result.bbResponse.data.contentType,
						'plain-text',
						'Test response contentType should be "plain-text"',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						true,
						'Test response isNewResource should be true',
					);
					assertEquals(
						result.bbResponse.data.lineCount,
						1,
						'Test response lineCount should be 1',
					);
				}

				assertStringIncludes(result.toolResponse, 'Created new-test.txt with plain-text content');
				if (isString(result.toolResults)) {
					assertStringIncludes(result.toolResults, 'Resource new-test.txt created with plain-text content');
				}

				// Verify file was actually created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Hello, world!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - overwrite existing resource',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'existing-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				// Create existing file
				await Deno.writeTextFile(testResourcePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						overwriteExisting: true,
						plainTextContent: {
							content: 'Overwritten content',
							acknowledgement: VALID_ACKNOWLEDGEMENT,
							expectedLineCount: 1,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('overwrite existing resource - bbResponse:', result.bbResponse);
				// console.log('overwrite existing resource - toolResponse:', result.toolResponse);
				// console.log('overwrite existing resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcePath,
						testResource,
						`Test response resourcePath should be "${testResource}"`,
					);
					assertEquals(
						result.bbResponse.data.contentType,
						'plain-text',
						'Test response contentType should be "plain-text"',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						false,
						'Test response isNewResource should be false',
					);
				}

				assertStringIncludes(result.toolResponse, 'Overwrote existing-test.txt with plain-text content');

				// Verify file was overwritten
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Overwritten content');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - fail when file exists and overwrite is false',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'existing-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				// Create existing file
				await Deno.writeTextFile(testResourcePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						overwriteExisting: false, // Default behavior
						plainTextContent: {
							content: 'New content',
							acknowledgement: VALID_ACKNOWLEDGEMENT,
							expectedLineCount: 1,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					'already exists and overwriteExisting is false',
				);

				// Verify original file is unchanged
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Original content');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - no content type provided',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'test.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						// No content type provided
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ToolHandlingError,
					'No content type provided',
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
	name: 'Write Resource Tool - multiple content types provided',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'test.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: 'Some text',
							expectedLineCount: 1,
						},
						structuredContent: {
							blocks: [],
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ToolHandlingError,
					'Multiple content types provided',
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
	name: 'Write Resource Tool - structured content with invalid acknowledgement',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'structured-test.json';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						structuredContent: {
							blocks: [],
							acknowledgement: 'Invalid acknowledgement',
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					'Invalid acknowledgement string for structured content',
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
	name: 'Write Resource Tool - line count mismatch warning',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'line-count-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: 'Line 1\nLine 2\nLine 3',
							expectedLineCount: 5, // Actual is 3
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.lineCount,
						3,
						'Test response lineCount should be 3',
					);
					assertEquals(
						result.bbResponse.data.lineCountError,
						'Line count mismatch. Content has 3 lines but expected 5 lines.',
						'Test response should include line count error',
					);
				}

				// Verify file was still created despite line count mismatch
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Line 1\nLine 2\nLine 3');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - reject empty content by default',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'empty-test.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: '',
							expectedLineCount: 0,
							// allowEmptyContent defaults to false
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					'Empty content provided and allowEmptyContent is false',
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
	name: 'Write Resource Tool - allow empty content when specified',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'empty-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: '',
							expectedLineCount: 0,
							allowEmptyContent: true,
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.lineCount,
						0,
						'Test response lineCount should be 0',
					);
				}

				// Verify empty file was created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, '');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - throw error for resource outside project',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResourcePath = '/tmp/outside_project.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResourcePath,
						plainTextContent: {
							content: 'Content outside project',
							expectedLineCount: 1,
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					`Access denied: ${testResourcePath} is outside the data source directory`,
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
