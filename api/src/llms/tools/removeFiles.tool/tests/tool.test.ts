import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { ensureDir, ensureFile, exists } from '@std/fs';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolRemoveFilesResponseData } from '../types.ts';

// Type guard function
function isRemoveFilesResponse(
	response: unknown,
): response is LLMToolRemoveFilesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'filesRemoved' in data &&
		Array.isArray(data.filesRemoved) &&
		'filesError' in data &&
		Array.isArray(data.filesError)
	);
}

// Default config for trash mode
const defaultConfig = {
	dangerouslyDeletePermanently: false,
	trashDir: '.trash',
	maxFilesPerOperation: 50,
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

// Config with lower file limit
const lowLimitConfig = {
	...defaultConfig,
	maxFilesPerOperation: 3,
};

// Config with custom protected paths
const customProtectedConfig = {
	...defaultConfig,
	protectedPaths: ['node_modules', 'config', 'secrets'],
};

Deno.test({
	name: 'RemoveFilesTool - Move single file to trash',
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
				const sourceFile = join(testProjectRoot, 'source.txt');
				const trashDir = join(testProjectRoot, '.trash');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_files', defaultConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['source.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Move single file to trash - bbResponse:', result.bbResponse);
				console.log('Move single file to trash - toolResponse:', result.toolResponse);
				console.log('Move single file to trash - toolResults:', result.toolResults);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 1, 'Should have 1 successful removal');
					const filesRemovedResult = result.bbResponse.data.filesRemoved[0];
					assertEquals(filesRemovedResult.name, 'source.txt', 'Should be source.txt');
					assert(!filesRemovedResult.isDirectory, 'Should not be marked as directory');
					assert(filesRemovedResult.destination?.startsWith('.trash/'), 'Should be moved to trash');
				}

				assertStringIncludes(result.toolResponse, 'moved to trash');

				// Verify file moved to trash
				assert(!(await exists(sourceFile)), 'Source file should not exist');
				assert(await exists(trashDir), 'Trash directory should exist');
				const trashFiles = [];
				for await (const entry of Deno.readDir(trashDir)) {
					trashFiles.push(entry.name);
				}
				assertEquals(trashFiles.length, 1, 'Should have one file in trash');
				assert(trashFiles[0].startsWith('source'), 'Trash file should start with original name');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveFilesTool - Move directory to trash',
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
				// Create test directory with files
				const sourceDir = join(testProjectRoot, 'test_dir');
				await ensureDir(sourceDir);
				await ensureDir(join(sourceDir, 'subdir'));
				await Deno.writeTextFile(join(sourceDir, 'file1.txt'), 'content 1');
				await Deno.writeTextFile(join(sourceDir, 'subdir', 'file2.txt'), 'content 2');

				const toolManager = await getToolManager(projectEditor, 'remove_files', defaultConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['test_dir'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 1, 'Should have 1 successful removal');
					const filesRemovedResult = result.bbResponse.data.filesRemoved[0];
					assertEquals(filesRemovedResult.name, 'test_dir', 'Should be test_dir');
					assert(filesRemovedResult.isDirectory, 'Should be marked as directory');
					assert(filesRemovedResult.destination?.startsWith('.trash/'), 'Should be moved to trash');
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
	name: 'RemoveFilesTool - Permanently delete directory',
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
				// Create test directory with files
				const sourceDir = join(testProjectRoot, 'perm_dir');
				await ensureDir(sourceDir);
				await Deno.writeTextFile(join(sourceDir, 'file1.txt'), 'content 1');
				await Deno.writeTextFile(join(sourceDir, 'file2.txt'), 'content 2');

				const toolManager = await getToolManager(projectEditor, 'remove_files', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['perm_dir'],
						acknowledgement: {
							fileCount: 1,
							files: ['perm_dir'],
							hasDirectories: true,
							acknowledgement:
								'I confirm permanent deletion of 1 files/directories and all contents with no recovery possible',
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 1, 'Should have 1 successful removal');
					const filesRemovedResult = result.bbResponse.data.filesRemoved[0];
					assertEquals(filesRemovedResult.name, 'perm_dir', 'Should be perm_dir');
					assert(filesRemovedResult.isDirectory, 'Should be marked as directory');
					assertEquals(
						filesRemovedResult.destination,
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
	name: 'RemoveFilesTool - Directory without proper acknowledgement',
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

				const toolManager = await getToolManager(projectEditor, 'remove_files', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['bad_ack_dir'],
						acknowledgement: {
							fileCount: 1,
							files: ['bad_ack_dir'],
							hasDirectories: false, // Wrong! Should be true
							acknowledgement: 'I confirm permanent deletion of 1 files with no recovery possible', // Wrong! Missing directory acknowledgement
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assertStringIncludes(result.toolResponse, 'Failed to remove files');
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
	name: 'RemoveFilesTool - Mixed files and directories',
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

				const toolManager = await getToolManager(projectEditor, 'remove_files', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['mixed_dir', 'single_file.txt'],
						acknowledgement: {
							fileCount: 2,
							files: ['mixed_dir', 'single_file.txt'],
							hasDirectories: true,
							acknowledgement:
								'I confirm permanent deletion of 2 files/directories and all contents with no recovery possible',
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 2, 'Should have 2 successful removals');

					const dirResult = result.bbResponse.data.filesRemoved.find((r) => r.name === 'mixed_dir');
					assert(dirResult, 'Should have result for mixed_dir');
					assert(dirResult.isDirectory, 'mixed_dir should be marked as directory');

					const fileResult = result.bbResponse.data.filesRemoved.find((r) => r.name === 'single_file.txt');
					assert(fileResult, 'Should have result for single_file.txt');
					assert(!fileResult.isDirectory, 'single_file.txt should not be marked as directory');
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
	name: 'RemoveFilesTool - Protected directory',
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
				// Create test file in .git directory
				const gitDir = join(testProjectRoot, '.git');
				await ensureDir(gitDir);
				await Deno.writeTextFile(join(gitDir, 'test.txt'), 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_files', permanentDeleteConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['.git'],
						acknowledgement: {
							fileCount: 1,
							files: ['.git'],
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
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 0, 'Should have no successes');
					assertEquals(result.bbResponse.data.filesError.length, 1, 'Should have one error');
					const filesErrorResult = result.bbResponse.data.filesError[0];
					assertEquals(filesErrorResult.name, '.git', 'Should be .git');
					assertStringIncludes(filesErrorResult.error, 'protected', 'Should mention protection');
				}

				assertStringIncludes(result.toolResponse, '0 items deleted, 1 failed');

				// Verify directory still exists
				assert(await exists(gitDir), '.git directory should still exist');
				assert(await exists(join(gitDir, 'test.txt')), 'File in .git should still exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveFilesTool - Increment naming collision',
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
				// Create test files
				const sourceFile1 = join(testProjectRoot, 'collision.txt');
				const trashDir = join(testProjectRoot, '.trash');
				await ensureDir(trashDir);
				await ensureFile(sourceFile1);
				await Deno.writeTextFile(sourceFile1, 'content 1');

				// Create existing file in trash
				await Deno.writeTextFile(join(trashDir, 'collision.txt'), 'existing content');

				const toolManager = await getToolManager(projectEditor, 'remove_files', defaultConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				// Move first file
				const toolUse1: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'remove_files',
					toolInput: {
						sources: ['collision.txt'],
					},
				};

				const result1 = await tool.runTool(interaction, toolUse1, projectEditor);
				// console.log('Increment naming collision (1) - running tool for:', toolUse1);
				// const trashEntries1 = await Deno.readDir(trashDir);
				// const trashFiles1 = [];
				// for await (const entry of trashEntries1) {
				// 	trashFiles1.push(entry.name);
				// }
				// console.log('Increment naming collision (1) - trashFiles:', trashFiles1);
				// console.log('Increment naming collision (1) - bbResponse:', result1.bbResponse);
				// console.log('Increment naming collision (1) - toolResponse:', result1.toolResponse);
				// console.log('Increment naming collision (1) - toolResults:', result1.toolResults);

				assert(
					isRemoveFilesResponse(result1.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result1.bbResponse)) {
					assertEquals(result1.bbResponse.data.filesRemoved.length, 1, 'Should have 1 successful removal');
					const filesRemovedResult = result1.bbResponse.data.filesRemoved[0];
					assert(filesRemovedResult.destination?.endsWith('collision_1.txt'), 'Should use increment naming');
				}

				const sourceFile2 = join(testProjectRoot, 'collision.txt');
				await ensureFile(sourceFile2);
				await Deno.writeTextFile(sourceFile2, 'content 2');

				// Move second file
				const toolUse2: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-2',
					toolName: 'remove_files',
					toolInput: {
						sources: ['collision.txt'],
					},
				};

				const result2 = await tool.runTool(interaction, toolUse2, projectEditor);
				// console.log('Increment naming collision (2) - running tool for:', toolUse2);
				// const trashEntries2 = await Deno.readDir(trashDir);
				// const trashFiles2 = [];
				// for await (const entry of trashEntries2) {
				// 	trashFiles2.push(entry.name);
				// }
				// console.log('Increment naming collision (2) - trashFiles:', trashFiles2);
				// console.log('Increment naming collision (2) - bbResponse:', result2.bbResponse);
				// console.log('Increment naming collision (2) - toolResponse:', result2.toolResponse);
				// console.log('Increment naming collision (2) - toolResults:', result2.toolResults);

				if (isRemoveFilesResponse(result2.bbResponse)) {
					assertEquals(result2.bbResponse.data.filesRemoved.length, 1, 'Should have 1 successful removal');
					const filesRemovedResult = result2.bbResponse.data.filesRemoved[0];
					assert(filesRemovedResult.destination?.endsWith('collision_2.txt'), 'Should use next increment');
				}

				// Verify files in trash
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
	name: 'RemoveFilesTool - Timestamp naming collision',
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
				// Create test files
				const trashDir = join(testProjectRoot, '.trash');
				const sourceFile1 = join(testProjectRoot, 'timecoll.txt');
				await ensureFile(sourceFile1);
				await Deno.writeTextFile(sourceFile1, 'content 1');

				const toolManager = await getToolManager(projectEditor, 'remove_files', timestampConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				// Move first file
				const toolUse1: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'remove_files',
					toolInput: {
						sources: ['timecoll.txt'],
					},
				};

				const result1 = await tool.runTool(interaction, toolUse1, projectEditor);
				// console.log('Increment naming collision (1) - running tool for:', toolUse1);
				// const trashEntries1 = await Deno.readDir(trashDir);
				// const trashFiles1 = [];
				// for await (const entry of trashEntries1) {
				// 	trashFiles1.push(entry.name);
				// }
				// console.log('Increment naming collision (1) - trashFiles:', trashFiles1);
				// console.log('Timestamp naming collision (1) - bbResponse:', result1.bbResponse);
				// console.log('Timestamp naming collision (1) - toolResponse:', result1.toolResponse);
				// console.log('Timestamp naming collision (1) - toolResults:', result1.toolResults);

				// Small delay to ensure different timestamps
				await new Promise((resolve) => setTimeout(resolve, 1000));

				const sourceFile2 = join(testProjectRoot, 'timecoll.txt');
				await ensureFile(sourceFile2);
				await Deno.writeTextFile(sourceFile2, 'content 2');

				// Move second file
				const toolUse2: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-2',
					toolName: 'remove_files',
					toolInput: {
						sources: ['timecoll.txt'],
					},
				};

				const result2 = await tool.runTool(interaction, toolUse2, projectEditor);
				// console.log('Increment naming collision (2) - running tool for:', toolUse2);
				// const trashEntries2 = await Deno.readDir(trashDir);
				// const trashFiles2 = [];
				// for await (const entry of trashEntries2) {
				// 	trashFiles2.push(entry.name);
				// }
				// console.log('Increment naming collision (2) - trashFiles:', trashFiles2);
				// console.log('Timestamp naming collision (2) - bbResponse:', result2.bbResponse);
				// console.log('Timestamp naming collision (2) - toolResponse:', result2.toolResponse);
				// console.log('Timestamp naming collision (2) - toolResults:', result2.toolResults);

				// Verify files have different timestamps
				const trashFiles = [];
				for await (const entry of Deno.readDir(trashDir)) {
					if (entry.name.startsWith('timecoll_')) {
						trashFiles.push(entry.name);
					}
				}
				assertEquals(trashFiles.length, 2, 'Should have two files in trash');
				assert(trashFiles[0] !== trashFiles[1], 'Files should have different timestamps');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveFilesTool - Special characters in filenames',
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
				// Create test files with special characters
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

				const toolManager = await getToolManager(projectEditor, 'remove_files', defaultConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: specialNames,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Special characters in filenames - bbResponse:', result.bbResponse);
				// console.log('Special characters in filenames - toolResponse:', result.toolResponse);
				// console.log('Special characters in filenames - toolResults:', result.toolResults);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesRemoved.length,
						specialNames.length,
						'Should move all files',
					);
					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no errors');
				}

				// Verify files moved to trash
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
	name: 'RemoveFilesTool - Timestamp naming strategy',
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
				// Create test files
				const sourceFile = join(testProjectRoot, 'timestamp.txt');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_files', timestampConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['timestamp.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Timestamp naming strategy - bbResponse:', result.bbResponse);
				console.log('Timestamp naming strategy - toolResponse:', result.toolResponse);
				console.log('Timestamp naming strategy - toolResults:', result.toolResults);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 1, 'Should have 1 successful removal');
					const filesRemovedResult = result.bbResponse.data.filesRemoved[0];
					assert(filesRemovedResult.destination?.includes('timestamp_'), 'Should include timestamp in name');
					assert(
						/\d{8}_\d{6}/.test(filesRemovedResult.destination || ''),
						'Should have timestamp format YYYYMMDD_HHMMSS',
					);
				}

				// Verify file moved to trash with timestamp
				assert(!(await exists(sourceFile)), 'Source file should not exist');
				const trashDir = join(testProjectRoot, '.trash');
				let foundTimestampFile = false;
				for await (const entry of Deno.readDir(trashDir)) {
					if (entry.name.startsWith('timestamp_') && /\d{8}_\d{6}\.txt$/.test(entry.name)) {
						foundTimestampFile = true;
						break;
					}
				}
				assert(foundTimestampFile, 'Should find file with timestamp in trash');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveFilesTool - Custom trash directory',
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
				const sourceFile = join(testProjectRoot, 'custom.txt');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor, 'remove_files', customTrashConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['custom.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Custom trash directory - bbResponse:', result.bbResponse);
				// console.log('Custom trash directory - toolResponse:', result.toolResponse);
				// console.log('Custom trash directory - toolResults:', result.toolResults);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 1, 'Should have 1 successful removal');
					const filesRemovedResult = result.bbResponse.data.filesRemoved[0];
					assert(
						filesRemovedResult.destination?.startsWith('custom_trash/'),
						'Should use custom trash directory',
					);
				}

				// Verify file moved to custom trash
				assert(!(await exists(sourceFile)), 'Source file should not exist');
				const customTrashDir = join(testProjectRoot, 'custom_trash');
				assert(await exists(customTrashDir), 'Custom trash directory should exist');
				assert(await exists(join(customTrashDir, 'custom.txt')), 'File should exist in custom trash');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveFilesTool - Exceed file limit',
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
				// Create 4 test files (over the limit of 3)
				const files = ['limit1.txt', 'limit2.txt', 'limit3.txt', 'limit4.txt'];
				for (const file of files) {
					await ensureFile(join(testProjectRoot, file));
					await Deno.writeTextFile(join(testProjectRoot, file), `content of ${file}`);
				}

				const toolManager = await getToolManager(projectEditor, 'remove_files', lowLimitConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: files,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Exceed file limit - bbResponse:', result.bbResponse);
				// console.log('Exceed file limit - toolResponse:', result.toolResponse);
				// console.log('Exceed file limit - toolResults:', result.toolResults);

				assertStringIncludes(result.toolResponse, 'Failed to remove files');
				assertStringIncludes(result.toolResults as string, 'Too many items: 4 exceeds maximum of 3');

				// Verify no files were removed
				for (const file of files) {
					assert(await exists(join(testProjectRoot, file)), `${file} should still exist`);
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
	name: 'RemoveFilesTool - At file limit',
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
				// Create exactly 3 test files (at the limit)
				const files = ['at_limit1.txt', 'at_limit2.txt', 'at_limit3.txt'];
				for (const file of files) {
					await ensureFile(join(testProjectRoot, file));
					await Deno.writeTextFile(join(testProjectRoot, file), `content of ${file}`);
				}

				const toolManager = await getToolManager(projectEditor, 'remove_files', lowLimitConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: files,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('At file limit - bbResponse:', result.bbResponse);
				// console.log('At file limit - toolResponse:', result.toolResponse);
				// console.log('At file limit - toolResults:', result.toolResults);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 3, 'Should have 3 successful removals');
					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no errors');
				}

				// Verify all files were moved to trash
				for (const file of files) {
					assert(!(await exists(join(testProjectRoot, file))), `${file} should not exist in source`);
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
	name: 'RemoveFilesTool - Custom protected paths',
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
				// Create test files in protected directories
				const configDir = join(testProjectRoot, 'config');
				const secretsDir = join(testProjectRoot, 'secrets');
				await ensureDir(configDir);
				await ensureDir(secretsDir);
				await Deno.writeTextFile(join(configDir, 'test.txt'), 'config content');
				await Deno.writeTextFile(join(secretsDir, 'test.txt'), 'secret content');

				const toolManager = await getToolManager(projectEditor, 'remove_files', customProtectedConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['config', 'secrets'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Custom protected paths - bbResponse:', result.bbResponse);
				// console.log('Custom protected paths - toolResponse:', result.toolResponse);
				// console.log('Custom protected paths - toolResults:', result.toolResults);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 0, 'Should have no successes');
					assertEquals(result.bbResponse.data.filesError.length, 2, 'Should have two errors');
					for (const filesError of result.bbResponse.data.filesError) {
						assertStringIncludes(filesError.error, 'protected', 'Should mention protection');
					}
				}

				// Verify protected directories still exist
				assert(await exists(configDir), 'Config directory should still exist');
				assert(await exists(secretsDir), 'Secrets directory should still exist');
				assert(await exists(join(configDir, 'test.txt')), 'Config file should still exist');
				assert(await exists(join(secretsDir, 'test.txt')), 'Secret file should still exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RemoveFilesTool - Non-existent files',
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
				const toolManager = await getToolManager(projectEditor, 'remove_files', defaultConfig);
				const tool = await toolManager.getTool('remove_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'remove_files',
					toolInput: {
						sources: ['does_not_exist1.txt', 'does_not_exist2.txt'],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Non-existent files - bbResponse:', result.bbResponse);
				// console.log('Non-existent files - toolResponse:', result.toolResponse);
				// console.log('Non-existent files - toolResults:', result.toolResults);

				assert(
					isRemoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isRemoveFilesResponse(result.bbResponse)) {
					assertEquals(result.bbResponse.data.filesRemoved.length, 0, 'Should have no successes');
					assertEquals(result.bbResponse.data.filesError.length, 2, 'Should have two errors');
					for (const filesError of result.bbResponse.data.filesError) {
						assertStringIncludes(
							filesError.error,
							'No such file or directory',
							'Should mention file not found',
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
