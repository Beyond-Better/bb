import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { ensureDir, ensureFile, exists } from '@std/fs';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolRemoveResourcesResponseData } from '../types.ts';

// Type guard function
function isRemoveResourcesResponse(
	response: unknown,
): response is LLMToolRemoveResourcesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resourcesRemoved' in data &&
		Array.isArray(data.resourcesRemoved) &&
		'resourcesError' in data &&
		Array.isArray(data.resourcesError)
	);
}

// Default config for trash mode
const defaultConfig = {
	dangerouslyDeletePermanently: false,
	trashDir: '.trash',
	maxResourcesPerOperation: 50,
	protectedPaths: ['node_modules'],
	trashNamingStrategy: 'increment',
};

// Config for permanent deletion mode
const permanentDeleteConfig = {
	...defaultConfig,
	dangerouslyDeletePermanently: true,
};

// Config with timestamp naming strategy
const timestampConfig = {
	...defaultConfig,
	trashNamingStrategy: 'timestamp',
};

// Config with custom trash directory
const customTrashConfig = {
	...defaultConfig,
	trashDir: 'custom_trash',
};

// Config with lower resource limit
const lowLimitConfig = {
	...defaultConfig,
	maxResourcesPerOperation: 3,
};

// Config with custom protected paths
const customProtectedConfig = {
	...defaultConfig,
	protectedPaths: ['node_modules', 'config', 'secrets'],
};

Deno.test({
	name: 'RemoveResourcesTool - Move single resource to trash',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource = join(testProjectRoot, 'source.txt');
				const trashDir = join(testProjectRoot, '.trash');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', defaultConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['source.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Move single resource to trash - bbResponse:', result.bbResponse);
				console.log('Move single resource to trash - toolResponse:', result.toolResponse);
				console.log('Move single resource to trash - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 1, 'Should have 1 successful removal');
					const resourcesRemovedResult = result.bbResponse.data.resourcesRemoved[0];
					assertEquals(resourcesRemovedResult.name, 'source.txt', 'Should be source.txt');
					assert(!resourcesRemovedResult.isDirectory, 'Should not be marked as directory');
					assert(resourcesRemovedResult.destination?.startsWith('.trash/'), 'Should be moved to trash');
				}

				assertStringIncludes(result.toolResponse, 'moved to trash');

				// Verify resource moved to trash
				assert(!(await exists(sourceResource)), 'Source resource should not exist');
				assert(await exists(trashDir), 'Trash directory should exist');
				const trashResources = [];
				for await (const entry of Deno.readDir(trashDir)) {
					trashResources.push(entry.name);
				}
				assertEquals(trashResources.length, 1, 'Should have one resource in trash');
				assert(trashResources[0].startsWith('source'), 'Trash resource should start with original name');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Move directory to trash',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test directory with resources
				const sourceDir = join(testProjectRoot, 'test_dir');
				await ensureDir(sourceDir);
				await ensureDir(join(sourceDir, 'subdir'));
				await Deno.writeTextFile(join(sourceDir, 'file1.txt'), 'content 1');
				await Deno.writeTextFile(join(sourceDir, 'subdir', 'file2.txt'), 'content 2');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', defaultConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['test_dir'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 1, 'Should have 1 successful removal');
					const resourcesRemovedResult = result.bbResponse.data.resourcesRemoved[0];
					assertEquals(resourcesRemovedResult.name, 'test_dir', 'Should be test_dir');
					assert(resourcesRemovedResult.isDirectory, 'Should be marked as directory');
					assert(resourcesRemovedResult.destination?.startsWith('.trash/'), 'Should be moved to trash');
				}

				assertStringIncludes(result.toolResponse, 'moved to trash');

				// Verify directory structure in trash
				const trashDir = join(testProjectRoot, '.trash');
				assert(await exists(trashDir), 'Trash directory should exist');

				// Find the moved directory in trash
				let movedDirName = '';
				for await (const entry of Deno.readDir(trashDir)) {
					if (entry.name.startsWith('test_dir')) {
						movedDirName = entry.name;
						break;
					}
				}
				assert(movedDirName, 'Should find moved directory in trash');

				const movedDir = join(trashDir, movedDirName);
				assert(await exists(join(movedDir, 'file1.txt')), 'file1.txt should exist in trash');
				assert(await exists(join(movedDir, 'subdir', 'file2.txt')), 'subdir/file2.txt should exist in trash');

				// Verify original directory is gone
				assert(!(await exists(sourceDir)), 'Source directory should not exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Permanently delete directory',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test directory with resources
				const sourceDir = join(testProjectRoot, 'perm_dir');
				await ensureDir(sourceDir);
				await Deno.writeTextFile(join(sourceDir, 'file1.txt'), 'content 1');
				await Deno.writeTextFile(join(sourceDir, 'file2.txt'), 'content 2');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['perm_dir'],
						acknowledgement: {
							resourceCount: 1,
							resources: ['perm_dir'],
							hasDirectories: true,
							acknowledgement:
								'I confirm permanent deletion of 1 files/directories and all contents with no recovery possible',
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 1, 'Should have 1 successful removal');
					const resourcesRemovedResult = result.bbResponse.data.resourcesRemoved[0];
					assertEquals(resourcesRemovedResult.name, 'perm_dir', 'Should be perm_dir');
					assert(resourcesRemovedResult.isDirectory, 'Should be marked as directory');
					assertEquals(
						resourcesRemovedResult.destination,
						undefined,
						'Should not have destination (permanent delete)',
					);
				}

				assertStringIncludes(result.toolResponse, 'deleted');

				// Verify directory is gone
				assert(!(await exists(sourceDir)), 'Source directory should not exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Directory without proper acknowledgement',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test directory
				const sourceDir = join(testProjectRoot, 'bad_ack_dir');
				await ensureDir(sourceDir);
				await Deno.writeTextFile(join(sourceDir, 'file.txt'), 'content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['bad_ack_dir'],
						acknowledgement: {
							resourceCount: 1,
							resources: ['bad_ack_dir'],
							hasDirectories: false, // Wrong! Should be true
							acknowledgement: 'I confirm permanent deletion of 1 files with no recovery possible', // Wrong! Missing directory acknowledgement
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(result.toolResponse, 'Failed to remove resources');
				assertStringIncludes(result.toolResults as string, 'Directory detected but hasDirectories is false');

				// Verify directory still exists
				assert(await exists(sourceDir), 'Source directory should still exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Mixed files and directories',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test files and directory
				const sourceDir = join(testProjectRoot, 'mixed_dir');
				await ensureDir(sourceDir);
				await Deno.writeTextFile(join(sourceDir, 'dir_file.txt'), 'dir content');
				await Deno.writeTextFile(join(testProjectRoot, 'single_file.txt'), 'file content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['mixed_dir', 'single_file.txt'],
						acknowledgement: {
							resourceCount: 2,
							resources: ['mixed_dir', 'single_file.txt'],
							hasDirectories: true,
							acknowledgement:
								'I confirm permanent deletion of 2 files/directories and all contents with no recovery possible',
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 2, 'Should have 2 successful removals');

					const dirResult = result.bbResponse.data.resourcesRemoved.find((r) => r.name === 'mixed_dir');
					assert(dirResult, 'Should have result for mixed_dir');
					assert(dirResult.isDirectory, 'mixed_dir should be marked as directory');

					const resourceResult = result.bbResponse.data.resourcesRemoved.find((r) => r.name === 'single_file.txt');
					assert(resourceResult, 'Should have result for single_file.txt');
					assert(!resourceResult.isDirectory, 'single_file.txt should not be marked as directory');
				}

				assertStringIncludes(result.toolResponse, 'deleted');

				// Verify everything is gone
				assert(!(await exists(sourceDir)), 'Source directory should not exist');
				assert(!(await exists(join(testProjectRoot, 'single_file.txt'))), 'Single file should not exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Protected directory',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test resource in .git directory
				const gitDir = join(testProjectRoot, '.git');
				await ensureDir(gitDir);
				await Deno.writeTextFile(join(gitDir, 'test.txt'), 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['.git'],
						acknowledgement: {
							resourceCount: 1,
							resources: ['.git'],
							hasDirectories: true,
							acknowledgement:
								'I confirm permanent deletion of 1 files/directories and all contents with no recovery possible',
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Protected directory - bbResponse:', result.bbResponse);
				// console.log('Protected directory - toolResponse:', result.toolResponse);
				// console.log('Protected directory - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 0, 'Should have no successes');
					assertEquals(result.bbResponse.data.resourcesError.length, 1, 'Should have one error');
					const resourcesErrorResult = result.bbResponse.data.resourcesError[0];
					assertEquals(resourcesErrorResult.name, '.git', 'Should be .git');
					assertStringIncludes(resourcesErrorResult.error, 'protected', 'Should mention protection');
				}

				assertStringIncludes(result.toolResponse, '0 items deleted, 1 failed');

				// Verify directory still exists
				assert(await exists(gitDir), '.git directory should still exist');
				assert(await exists(join(gitDir, 'test.txt')), 'Resource in .git should still exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Increment naming collision',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test resources
				const sourceResource1 = join(testProjectRoot, 'collision.txt');
				const trashDir = join(testProjectRoot, '.trash');
				await ensureDir(trashDir);
				await ensureFile(sourceResource1);
				await Deno.writeTextFile(sourceResource1, 'content 1');

				// Create existing resource in trash
				await Deno.writeTextFile(join(trashDir, 'collision.txt'), 'existing content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', defaultConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				// Move first resource
				const toolUse1: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['collision.txt'],
					},
				};

				const result1 = await tool.runTool(interaction, toolUse1, projectEditor);
				// console.log('Increment naming collision (1) - running tool for:', toolUse1);
				// const trashEntries1 = await Deno.readDir(trashDir);
				// const trashResources1 = [];
				// for await (const entry of trashEntries1) {
				// 	trashResources1.push(entry.name);
				// }
				// console.log('Increment naming collision (1) - trashResources:', trashResources1);
				// console.log('Increment naming collision (1) - bbResponse:', result1.bbResponse);
				// console.log('Increment naming collision (1) - toolResponse:', result1.toolResponse);
				// console.log('Increment naming collision (1) - toolResults:', result1.toolResults);

				assert(
					isRemoveResourcesResponse(result1.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result1.bbResponse)) {
					assertEquals(result1.bbResponse.data.resourcesRemoved.length, 1, 'Should have 1 successful removal');
					const resourcesRemovedResult = result1.bbResponse.data.resourcesRemoved[0];
					assert(resourcesRemovedResult.destination?.endsWith('collision_1.txt'), 'Should use increment naming');
				}

				const sourceResource2 = join(testProjectRoot, 'collision.txt');
				await ensureFile(sourceResource2);
				await Deno.writeTextFile(sourceResource2, 'content 2');

				// Move second resource
				const toolUse2: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-2',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['collision.txt'],
					},
				};

				const result2 = await tool.runTool(interaction, toolUse2, projectEditor);
				// console.log('Increment naming collision (2) - running tool for:', toolUse2);
				// const trashEntries2 = await Deno.readDir(trashDir);
				// const trashResources2 = [];
				// for await (const entry of trashEntries2) {
				// 	trashResources2.push(entry.name);
				// }
				// console.log('Increment naming collision (2) - trashResources:', trashResources2);
				// console.log('Increment naming collision (2) - bbResponse:', result2.bbResponse);
				// console.log('Increment naming collision (2) - toolResponse:', result2.toolResponse);
				// console.log('Increment naming collision (2) - toolResults:', result2.toolResults);

				if (isRemoveResourcesResponse(result2.bbResponse)) {
					assertEquals(result2.bbResponse.data.resourcesRemoved.length, 1, 'Should have 1 successful removal');
					const resourcesRemovedResult = result2.bbResponse.data.resourcesRemoved[0];
					assert(resourcesRemovedResult.destination?.endsWith('collision_2.txt'), 'Should use next increment');
				}

				// Verify resources in trash
				assert(await exists(join(trashDir, 'collision.txt')), 'Original collision.txt should exist in trash');
				assert(await exists(join(trashDir, 'collision_1.txt')), 'collision_1.txt should exist in trash');
				assert(await exists(join(trashDir, 'collision_2.txt')), 'collision_2.txt should exist in trash');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Timestamp naming collision',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test resources
				const trashDir = join(testProjectRoot, '.trash');
				const sourceResource1 = join(testProjectRoot, 'timecoll.txt');
				await ensureFile(sourceResource1);
				await Deno.writeTextFile(sourceResource1, 'content 1');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', timestampConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				// Move first resource
				const toolUse1: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['timecoll.txt'],
					},
				};

				const _result1 = await tool.runTool(interaction, toolUse1, projectEditor);
				// console.log('Increment naming collision (1) - running tool for:', toolUse1);
				// const trashEntries1 = await Deno.readDir(trashDir);
				// const trashResources1 = [];
				// for await (const entry of trashEntries1) {
				// 	trashResources1.push(entry.name);
				// }
				// console.log('Increment naming collision (1) - trashResources:', trashResources1);
				// console.log('Timestamp naming collision (1) - bbResponse:', result1.bbResponse);
				// console.log('Timestamp naming collision (1) - toolResponse:', result1.toolResponse);
				// console.log('Timestamp naming collision (1) - toolResults:', result1.toolResults);

				// Small delay to ensure different timestamps
				await new Promise((resolve) => setTimeout(resolve, 1000));

				const sourceResource2 = join(testProjectRoot, 'timecoll.txt');
				await ensureFile(sourceResource2);
				await Deno.writeTextFile(sourceResource2, 'content 2');

				// Move second resource
				const toolUse2: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-2',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['timecoll.txt'],
					},
				};

				const _result2 = await tool.runTool(interaction, toolUse2, projectEditor);
				// console.log('Increment naming collision (2) - running tool for:', toolUse2);
				// const trashEntries2 = await Deno.readDir(trashDir);
				// const trashResources2 = [];
				// for await (const entry of trashEntries2) {
				// 	trashResources2.push(entry.name);
				// }
				// console.log('Increment naming collision (2) - trashResources:', trashResources2);
				// console.log('Timestamp naming collision (2) - bbResponse:', result2.bbResponse);
				// console.log('Timestamp naming collision (2) - toolResponse:', result2.toolResponse);
				// console.log('Timestamp naming collision (2) - toolResults:', result2.toolResults);

				// Verify resources have different timestamps
				const trashResources = [];
				for await (const entry of Deno.readDir(trashDir)) {
					if (entry.name.startsWith('timecoll_')) {
						trashResources.push(entry.name);
					}
				}
				assertEquals(trashResources.length, 2, 'Should have two resources in trash');
				assert(trashResources[0] !== trashResources[1], 'Resources should have different timestamps');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Special characters in resource names',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test resources with special characters
				const specialNames = [
					'file with spaces.txt',
					'file-with-dashes.txt',
					'file_with_underscores.txt',
					'file.with.dots.txt',
					'file(with)parentheses.txt',
				];

				for (const name of specialNames) {
					await ensureFile(join(testProjectRoot, name));
					await Deno.writeTextFile(join(testProjectRoot, name), `content of ${name}`);
				}

				const toolManager = await getToolManager(projectEditor, 'remove_resources', defaultConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: specialNames,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Special characters in resource names - bbResponse:', result.bbResponse);
				// console.log('Special characters in resource names - toolResponse:', result.toolResponse);
				// console.log('Special characters in resource names - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesRemoved.length,
						specialNames.length,
						'Should move all resources',
					);
					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no errors');
				}

				// Verify resources moved to trash
				const trashDir = join(testProjectRoot, '.trash');
				for (const name of specialNames) {
					assert(!(await exists(join(testProjectRoot, name))), `${name} should not exist in source`);
					assert(await exists(join(trashDir, name)), `${name} should exist in trash`);
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
	name: 'RemoveResourcesTool - Timestamp naming strategy',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test resources
				const sourceResource = join(testProjectRoot, 'timestamp.txt');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', timestampConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['timestamp.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Timestamp naming strategy - bbResponse:', result.bbResponse);
				console.log('Timestamp naming strategy - toolResponse:', result.toolResponse);
				console.log('Timestamp naming strategy - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 1, 'Should have 1 successful removal');
					const resourcesRemovedResult = result.bbResponse.data.resourcesRemoved[0];
					assert(resourcesRemovedResult.destination?.includes('timestamp_'), 'Should include timestamp in name');
					assert(
						/\d{8}_\d{6}/.test(resourcesRemovedResult.destination || ''),
						'Should have timestamp format YYYYMMDD_HHMMSS',
					);
				}

				// Verify resource moved to trash with timestamp
				assert(!(await exists(sourceResource)), 'Source resource should not exist');
				const trashDir = join(testProjectRoot, '.trash');
				let foundTimestampResource = false;
				for await (const entry of Deno.readDir(trashDir)) {
					if (entry.name.startsWith('timestamp_') && /\d{8}_\d{6}\.txt$/.test(entry.name)) {
						foundTimestampResource = true;
						break;
					}
				}
				assert(foundTimestampResource, 'Should find resource with timestamp in trash');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Custom trash directory',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource = join(testProjectRoot, 'custom.txt');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', customTrashConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['custom.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Custom trash directory - bbResponse:', result.bbResponse);
				// console.log('Custom trash directory - toolResponse:', result.toolResponse);
				// console.log('Custom trash directory - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 1, 'Should have 1 successful removal');
					const resourcesRemovedResult = result.bbResponse.data.resourcesRemoved[0];
					assert(
						resourcesRemovedResult.destination?.startsWith('custom_trash/'),
						'Should use custom trash directory',
					);
				}

				// Verify resource moved to custom trash
				assert(!(await exists(sourceResource)), 'Source resource should not exist');
				const customTrashDir = join(testProjectRoot, 'custom_trash');
				assert(await exists(customTrashDir), 'Custom trash directory should exist');
				assert(await exists(join(customTrashDir, 'custom.txt')), 'Resource should exist in custom trash');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Exceed resource limit',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create 4 test resources (over the limit of 3)
				const resources = ['limit1.txt', 'limit2.txt', 'limit3.txt', 'limit4.txt'];
				for (const resource of resources) {
					await ensureFile(join(testProjectRoot, resource));
					await Deno.writeTextFile(join(testProjectRoot, resource), `content of ${resource}`);
				}

				const toolManager = await getToolManager(projectEditor, 'remove_resources', lowLimitConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: resources,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Exceed resource limit - bbResponse:', result.bbResponse);
				// console.log('Exceed resource limit - toolResponse:', result.toolResponse);
				// console.log('Exceed resource limit - toolResults:', result.toolResults);

				assertStringIncludes(result.toolResponse, 'Failed to remove resources');
				assertStringIncludes(result.toolResults as string, 'Too many items: 4 exceeds maximum of 3');

				// Verify no resources were removed
				for (const resource of resources) {
					assert(await exists(join(testProjectRoot, resource)), `${resource} should still exist`);
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
	name: 'RemoveResourcesTool - At resource limit',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create exactly 3 test resources (at the limit)
				const resources = ['at_limit1.txt', 'at_limit2.txt', 'at_limit3.txt'];
				for (const resource of resources) {
					await ensureFile(join(testProjectRoot, resource));
					await Deno.writeTextFile(join(testProjectRoot, resource), `content of ${resource}`);
				}

				const toolManager = await getToolManager(projectEditor, 'remove_resources', lowLimitConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: resources,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('At resource limit - bbResponse:', result.bbResponse);
				// console.log('At resource limit - toolResponse:', result.toolResponse);
				// console.log('At resource limit - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 3, 'Should have 3 successful removals');
					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no errors');
				}

				// Verify all resources were moved to trash
				for (const resource of resources) {
					assert(!(await exists(join(testProjectRoot, resource))), `${resource} should not exist in source`);
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
	name: 'RemoveResourcesTool - Custom protected paths',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				// Create test resources in protected directories
				const configDir = join(testProjectRoot, 'config');
				const secretsDir = join(testProjectRoot, 'secrets');
				await ensureDir(configDir);
				await ensureDir(secretsDir);
				await Deno.writeTextFile(join(configDir, 'test.txt'), 'config content');
				await Deno.writeTextFile(join(secretsDir, 'test.txt'), 'secret content');

				const toolManager = await getToolManager(projectEditor, 'remove_resources', customProtectedConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['config', 'secrets'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Custom protected paths - bbResponse:', result.bbResponse);
				// console.log('Custom protected paths - toolResponse:', result.toolResponse);
				// console.log('Custom protected paths - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 0, 'Should have no successes');
					assertEquals(result.bbResponse.data.resourcesError.length, 2, 'Should have two errors');
					for (const resourcesError of result.bbResponse.data.resourcesError) {
						assertStringIncludes(resourcesError.error, 'protected', 'Should mention protection');
					}
				}

				// Verify protected directories still exist
				assert(await exists(configDir), 'Config directory should still exist');
				assert(await exists(secretsDir), 'Secrets directory should still exist');
				assert(await exists(join(configDir, 'test.txt')), 'Config resource should still exist');
				assert(await exists(join(secretsDir, 'test.txt')), 'Secret resource should still exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveResourcesTool - Non-existent resources',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const toolManager = await getToolManager(projectEditor, 'remove_resources', defaultConfig);
				const tool = await toolManager.getTool('remove_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_resources',
					toolInput: {
						sources: ['does_not_exist1.txt', 'does_not_exist2.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Non-existent resources - bbResponse:', result.bbResponse);
				// console.log('Non-existent resources - toolResponse:', result.toolResponse);
				// console.log('Non-existent resources - toolResults:', result.toolResults);

				assert(
					isRemoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveResourcesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.resourcesRemoved.length, 0, 'Should have no successes');
					assertEquals(result.bbResponse.data.resourcesError.length, 2, 'Should have two errors');
					for (const resourcesError of result.bbResponse.data.resourcesError) {
						assertStringIncludes(
							resourcesError.error,
							'No such file or directory',
							'Should mention resource not found',
						);
					}
				}

				assertStringIncludes(result.toolResponse, '0 items moved to trash, 2 failed');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
