import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';
import { join } from '@std/path';
import { ensureFile, exists } from '@std/fs';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolRenameFilesResponseData } from '../types.ts';

// Type guard function
function isRenameFilesResponse(
	response: unknown,
): response is LLMToolRenameFilesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'filesRenamed' in data &&
		Array.isArray(data.filesRenamed) &&
		'filesError' in data &&
		Array.isArray(data.filesError)
	);
}

Deno.test({
	name: 'RenameFilesTool - Rename single file',
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
				const destFile = join(testProjectRoot, 'renamed.txt');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_files',
					toolInput: {
						operations: [{ source: 'source.txt', destination: 'renamed.txt' }],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Rename single file - bbResponse:', result.bbResponse);
				// console.log('Rename single file - toolResponse:', result.toolResponse);
				// console.log('Rename single file - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesRenamed.length,
						1,
						'Should have 1 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.filesRenamed[0];

					assert(renameResult1, 'Should have a result for renamed file');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(renameResult1.destination, 'renamed.txt', 'Result1 response should match destination');

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed files');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 1, 'toolResults should have 1 element');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, 'File/Directory renamed: ');
				assertStringIncludes(firstResult.text, 'source.txt');
				assertStringIncludes(firstResult.text, 'renamed.txt');

				// Check that the file was renamed
				assert(!(await exists(sourceFile)), 'Source file should not exist');
				assert(await exists(destFile), 'Destination file should exist');
				assertEquals(await Deno.readTextFile(destFile), 'test content', 'File content should be preserved');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Create missing directories',
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
				const destFile = join(testProjectRoot, 'new_dir', 'renamed.txt');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_files',
					toolInput: {
						operations: [{ source: 'source.txt', destination: join('new_dir', 'renamed.txt') }],
						createMissingDirectories: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Create missing directories - bbResponse:', result.bbResponse);
				// console.log('Create missing directories - toolResponse:', result.toolResponse);
				// console.log('Create missing directories - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesRenamed.length,
						1,
						'Should have 1 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.filesRenamed[0];

					assert(renameResult1, 'Should have a result for renamed file');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'new_dir/renamed.txt',
						'Result1 response should match destination',
					);

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed files');

				assert(!(await exists(sourceFile)), 'Source file should not exist');
				assert(await exists(destFile), 'Destination file should exist');
				assertEquals(await Deno.readTextFile(destFile), 'test content', 'File content should be preserved');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Fail to create missing directories',
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
				const destFile = join(testProjectRoot, 'new_dir', 'renamed.txt');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_files',
					toolInput: {
						operations: [{ source: 'source.txt', destination: join('new_dir', 'renamed.txt') }],
						createMissingDirectories: false,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Fail to create missing directories - bbResponse:', result.bbResponse);
				console.log('Fail to create missing directories - toolResponse:', result.toolResponse);
				console.log('Fail to create missing directories - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesError.length,
						1,
						'Should have 1 error rename results',
					);
					const renameResult1 = result.bbResponse.data.filesError[0];

					assert(renameResult1, 'Should have a result for renamed file');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'new_dir/renamed.txt',
						'Result1 response should match destination',
					);
					assertStringIncludes(
						renameResult1.error,
						'No such file or directory',
						'Result1 response should have error',
					);

					assertEquals(result.bbResponse.data.filesRenamed.length, 0, 'Should have no renamed files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Failed to rename files');

				assert(await exists(sourceFile), 'Source file should still exist');
				assert(!(await exists(destFile)), 'Destination file should not exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Rename multiple files',
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
				const sourceFile1 = join(testProjectRoot, 'file1.txt');
				const sourceFile2 = join(testProjectRoot, 'file2.txt');
				const destFile1 = join(testProjectRoot, 'renamed1.txt');
				const destFile2 = join(testProjectRoot, 'renamed2.txt');
				await ensureFile(sourceFile1);
				await ensureFile(sourceFile2);
				await Deno.writeTextFile(sourceFile1, 'content1');
				await Deno.writeTextFile(sourceFile2, 'content2');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_files',
					toolInput: {
						operations: [
							{ source: 'file1.txt', destination: 'renamed1.txt' },
							{ source: 'file2.txt', destination: 'renamed2.txt' },
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Create missing directories - bbResponse:', result.bbResponse);
				// console.log('Create missing directories - toolResponse:', result.toolResponse);
				// console.log('Create missing directories - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesRenamed.length,
						2,
						'Should have 2 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.filesRenamed[0];
					const renameResult2 = result.bbResponse.data.filesRenamed[1];

					assert(renameResult1, 'Should have a result for renamed file');
					assertEquals(renameResult1.source, 'file1.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'renamed1.txt',
						'Result1 response should match destination',
					);

					assert(renameResult2, 'Should have a result for renamed file');
					assertEquals(renameResult2.source, 'file2.txt', 'Result2 response should match source');
					assertEquals(
						renameResult2.destination,
						'renamed2.txt',
						'Result2 response should match destination',
					);

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed files');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				assert(!(await exists(sourceFile1)), 'Source file 1 should not exist');
				assert(!(await exists(sourceFile2)), 'Source file 2 should not exist');
				assert(await exists(destFile1), 'Destination file 1 should exist');
				assert(await exists(destFile2), 'Destination file 2 should exist');
				assertEquals(await Deno.readTextFile(destFile1), 'content1', 'File 1 content should be preserved');
				assertEquals(await Deno.readTextFile(destFile2), 'content2', 'File 2 content should be preserved');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameFilesTool - Overwrite existing file',
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
				const destFile = join(testProjectRoot, 'existing.txt');
				await ensureFile(sourceFile);
				await ensureFile(destFile);
				await Deno.writeTextFile(sourceFile, 'new content');
				await Deno.writeTextFile(destFile, 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_files',
					toolInput: {
						operations: [{ source: 'source.txt', destination: 'existing.txt' }],
						overwrite: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Overwrite existing file - bbResponse:', result.bbResponse);
				// console.log('Overwrite existing file - toolResponse:', result.toolResponse);
				// console.log('Overwrite existing file - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesRenamed.length,
						1,
						'Should have 1 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.filesRenamed[0];

					assert(renameResult1, 'Should have a result for renamed file');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'existing.txt',
						'Result1 response should match destination',
					);

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed files');

				assert(!(await exists(sourceFile)), 'Source file should not exist');
				assert(await exists(destFile), 'Destination file should exist');
				assertEquals(
					await Deno.readTextFile(destFile),
					'new content',
					'Destination file should be overwritten',
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
	name: 'RenameFilesTool - Fail to overwrite without permission',
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
				const destFile = join(testProjectRoot, 'existing.txt');
				await ensureFile(sourceFile);
				await ensureFile(destFile);
				await Deno.writeTextFile(sourceFile, 'new content');
				await Deno.writeTextFile(destFile, 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_files',
					toolInput: {
						operations: [{ source: 'source.txt', destination: 'existing.txt' }],
						overwrite: false,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Fail to overwrite without permission - bbResponse:', result.bbResponse);
				// console.log('Fail to overwrite without permission - toolResponse:', result.toolResponse);
				// console.log('Fail to overwrite without permission - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesError.length,
						1,
						'Should have 1 error rename results',
					);
					const renameResult1 = result.bbResponse.data.filesError[0];

					assert(renameResult1, 'Should have a result for renamed file');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'existing.txt',
						'Result1 response should match destination',
					);
					assertStringIncludes(
						renameResult1.error,
						'Destination existing.txt already exists and overwrite is false',
						'Result1 response should have error',
					);

					assertEquals(result.bbResponse.data.filesRenamed.length, 0, 'Should have no renamed files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Failed to rename files');

				assert(await exists(sourceFile), 'Source file should still exist');
				assert(await exists(destFile), 'Destination file should still exist');
				assertEquals(
					await Deno.readTextFile(sourceFile),
					'new content',
					'Source file content should be unchanged',
				);
				assertEquals(
					await Deno.readTextFile(destFile),
					'old content',
					'Destination file should not be overwritten',
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
	name: 'RenameFilesTool - Attempt to rename non-existent file',
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
				const nonExistentFile = join(testProjectRoot, 'non_existent.txt');
				const destFile = join(testProjectRoot, 'renamed.txt');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_files',
					toolInput: {
						operations: [{ source: 'non_existent.txt', destination: 'renamed.txt' }],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Attempt to rename non-existent file - bbResponse:', result.bbResponse);
				// console.log('Attempt to rename non-existent file - toolResponse:', result.toolResponse);
				// console.log('Attempt to rename non-existent file - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesError.length,
						1,
						'Should have 1 error rename results',
					);
					const renameResult1 = result.bbResponse.data.filesError[0];

					assert(renameResult1, 'Should have a result for renamed file');
					assertEquals(renameResult1.source, 'non_existent.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'renamed.txt',
						'Result1 response should match destination',
					);
					assertStringIncludes(
						renameResult1.error,
						'No such file or directory',
						'Result1 response should have error',
					);

					assertEquals(result.bbResponse.data.filesRenamed.length, 0, 'Should have no renamed files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}
				assertStringIncludes(result.toolResponse, 'Failed to rename files');

				assert(!(await exists(nonExistentFile)), 'Source file should not exist');
				assert(!(await exists(destFile)), 'Destination file should not exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
