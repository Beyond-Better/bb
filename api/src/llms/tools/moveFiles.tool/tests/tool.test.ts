import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';
import { join } from '@std/path';
import { ensureDir, ensureFile, exists } from '@std/fs';

import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

// Type guard function
function isMoveFilesResponse(
	response: unknown,
): response is {
	data: {
		filesMoved: string[];
		filesError: string[];
		destination: string;
	};
} {
	return (
		typeof response === 'object' &&
		response !== null &&
		'data' in response &&
		typeof (response as any).data === 'object' &&
		'destination' in (response as any).data &&
		typeof (response as any).data.destination === 'string' &&
		'filesMoved' in (response as any).data &&
		Array.isArray((response as any).data.filesMoved) &&
		'filesError' in (response as any).data &&
		Array.isArray((response as any).data.filesError)
	);
}

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'MoveFilesTool - Move single file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceFile = join(testProjectRoot, 'source.txt');
				const destDir = join(testProjectRoot, 'dest');
				await ensureFile(sourceFile);
				await ensureDir(destDir);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['source.txt'],
						destination: 'dest',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Move single file - bbResponse:', result.bbResponse);
				// console.log('Move single file - toolResponse:', result.toolResponse);
				// console.log('Move single file - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesMoved.length,
						1,
						'Should have 1 successful moved file results',
					);
					const testResult = result.bbResponse.data.filesMoved.find((r) => r === 'source.txt');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source.txt', 'Test response should match "source.txt"');

					assertEquals(result.bbResponse.data.destination, 'dest', 'Destination should match "dest"');

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				//assertStringIncludes(result.bbResponse, 'BB has moved these files to');
				assertStringIncludes(result.toolResponse, 'Moved files to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					'File/Directory moved: ',
				);
				assertStringIncludes(firstResult.text, 'source.txt');

				// Check that the file exists in the destination
				assert(await exists(join(destDir, 'source.txt')), 'Source file exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveFilesTool - Create missing directories',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceFile = join(testProjectRoot, 'source.txt');
				const destDir = join(testProjectRoot, 'new_dir', 'sub_dir');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['source.txt'],
						destination: join('new_dir', 'sub_dir'),
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
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesMoved.length,
						1,
						'Should have 1 successful moved file results',
					);
					const testResult = result.bbResponse.data.filesMoved.find((r) => r === 'source.txt');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source.txt', 'Test response should match "source.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'new_dir/sub_dir',
						'Destination should match "new_dir/sub_dir"',
					);

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved files to');

				assert(await exists(join(destDir, 'source.txt')), 'Source file exists in destination');
				assert(await exists(destDir), 'Destination directory was created');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveFilesTool - Fail to create missing directories',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceFile = join(testProjectRoot, 'source.txt');
				const destDir = join(testProjectRoot, 'another_new_dir', 'sub_dir');
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['source.txt'],
						destination: join('another_new_dir', 'sub_dir'),
						createMissingDirectories: false,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Fail to create missing directories - bbResponse:', result.bbResponse);
				// console.log('Fail to create missing directories - toolResponse:', result.toolResponse);
				// console.log('Fail to create missing directories - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesError.length,
						1,
						'Should have 1 successful moved file results',
					);
					const testResult = result.bbResponse.data.filesError.find((r) => r === 'source.txt');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source.txt', 'Test response should match "source.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'another_new_dir/sub_dir',
						'Destination should match "another_new_dir/sub_dir"',
					);

					assertEquals(result.bbResponse.data.filesMoved.length, 0, 'Should have no moved files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Failed to move files');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					' No such file or directory',
				);
				assertStringIncludes(firstResult.text, 'source.txt');

				assert(!(await exists(join(destDir, 'source.txt'))), 'Source file does not exist in destination');
				assert(!(await exists(destDir)), 'Destination directory was not created');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveFilesTool - Move multiple files',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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
				const destDir = join(testProjectRoot, 'multi_dest');
				await ensureDir(destDir);
				await ensureFile(sourceFile1);
				await ensureFile(sourceFile2);

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['file1.txt', 'file2.txt'],
						destination: 'multi_dest',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Move multiple files - bbResponse:', result.bbResponse);
				// console.log('Move multiple files - toolResponse:', result.toolResponse);
				// console.log('Move multiple files - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesMoved.length,
						2,
						'Should have 2 successful moved file results',
					);
					const testResult1 = result.bbResponse.data.filesMoved.find((r) => r === 'file1.txt');
					const testResult2 = result.bbResponse.data.filesMoved.find((r) => r === 'file2.txt');

					assert(testResult1, 'Should have a result for file1.txt');
					assert(testResult2, 'Should have a result for file2.txt');

					assertEquals(testResult1, 'file1.txt', 'Test response should match "file1.txt"');
					assertEquals(testResult2, 'file2.txt', 'Test response should match "file2.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'multi_dest',
						'Destination should match "multi_dest"',
					);

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved files to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const expectedFiles = ['file1.txt', 'file2.txt'];

				for (const [index, file] of expectedFiles.entries()) {
					const moveResult = result.toolResults[index];
					assert(moveResult.type === 'text', `Move result ${index} should be of type text`);
					assertStringIncludes(
						moveResult.text,
						'File/Directory moved: ',
					);
					assertStringIncludes(moveResult.text, file);
				}

				const foundFiles = result.toolResponse.split('\n');

				assert(
					foundFiles.some((f) => f.endsWith('Moved files to multi_dest:')),
					`Destination 'multi_dest' not found in the result`,
				);
				expectedFiles.forEach((file) => {
					assert(foundFiles.some((f) => f === `- ${file}`), `File ${file} not found in the result`);
				});
				assert(foundFiles.length - 1 === expectedFiles.length, 'Number of found files does not match expected');

				// Check that the file exists in the destination
				assert(await exists(join(destDir, 'file1.txt')), 'Source file exists in destination');
				assert(await exists(join(destDir, 'file2.txt')), 'Source file exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveFilesTool - Move directory',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceDir = join(testProjectRoot, 'source_dir');
				const destDir = join(testProjectRoot, 'dest_dir');
				await ensureDir(sourceDir);
				await ensureDir(destDir);
				await Deno.writeTextFile(join(sourceDir, 'file.txt'), 'dir content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['source_dir'],
						destination: 'dest_dir',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Move directory - bbResponse:', result.bbResponse);
				// console.log('Move directory - toolResponse:', result.toolResponse);
				// console.log('Move directory - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesMoved.length,
						1,
						'Should have 1 successful moved file results',
					);
					const testResult = result.bbResponse.data.filesMoved.find((r) => r === 'source_dir');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source_dir', 'Test response should match "source_dir"');

					assertEquals(
						result.bbResponse.data.destination,
						'dest_dir',
						'Destination should match "dest_dir"',
					);

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved files to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

				const expectedFiles = ['source_dir'];

				for (const [index, file] of expectedFiles.entries()) {
					const moveResult = result.toolResults[index];
					assert(moveResult.type === 'text', `Move result ${index} should be of type text`);
					assertStringIncludes(
						moveResult.text,
						'File/Directory moved: ',
					);
					assertStringIncludes(moveResult.text, file);
				}

				const foundFiles = result.toolResponse.split('\n');

				assert(
					foundFiles.some((f) => f === 'Moved files to dest_dir:'),
					`Destination 'dest_dir' not found in the result`,
				);
				expectedFiles.forEach((file) => {
					assert(foundFiles.some((f) => f === `- ${file}`), `File ${file} not found in the result`);
				});
				assert(foundFiles.length - 1 === expectedFiles.length, 'Number of found files does not match expected');

				// Check that the file exists in the destination
				assert(await exists(join(destDir, 'source_dir', 'file.txt')), 'Source file exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveFilesTool - Overwrite existing file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceFile = join(testProjectRoot, 'overwrite.txt');
				const destDir = join(testProjectRoot, 'overwrite_dest');
				await ensureDir(destDir);
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'new content');
				await ensureFile(join(destDir, 'overwrite.txt'));
				await Deno.writeTextFile(join(destDir, 'overwrite.txt'), 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['overwrite.txt'],
						destination: 'overwrite_dest',
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
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesMoved.length,
						1,
						'Should have 1 successful moved file results',
					);
					const testResult = result.bbResponse.data.filesMoved.find((r) => r === 'overwrite.txt');

					assert(testResult, 'Should have a result for overwrite.txt');

					assertEquals(testResult, 'overwrite.txt', 'Test response should match "overwrite.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'overwrite_dest',
						'Destination should match "overwrite_dest"',
					);

					assertEquals(result.bbResponse.data.filesError.length, 0, 'Should have no new files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved files to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					'File/Directory moved: overwrite.txt',
				);
				assertStringIncludes(firstResult.text, 'overwrite.txt');

				// Check that the file exists in the destination
				assert(await exists(join(destDir, 'overwrite.txt')), 'Source file exists in destination');

				assertEquals(
					await Deno.readTextFile(join(destDir, 'overwrite.txt')),
					'new content',
					'Destination file was overwritten with moved file',
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
	name: 'MoveFilesTool - Fail to overwrite without permission',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceFile = join(testProjectRoot, 'no_overwrite.txt');
				const destDir = join(testProjectRoot, 'overwrite_dest');
				await ensureDir(destDir);
				await ensureFile(sourceFile);
				await Deno.writeTextFile(sourceFile, 'new content');
				await ensureFile(join(destDir, 'no_overwrite.txt'));
				await Deno.writeTextFile(join(destDir, 'no_overwrite.txt'), 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['no_overwrite.txt'],
						destination: 'overwrite_dest',
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
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesError.length,
						1,
						'Should have 1 successful moved file results',
					);
					const testResult = result.bbResponse.data.filesError.find((r) => r === 'no_overwrite.txt');

					assert(testResult, 'Should have a result for no_overwrite.txt');

					assertEquals(testResult, 'no_overwrite.txt', 'Test response should match "no_overwrite.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'overwrite_dest',
						'Destination should match "overwrite_dest"',
					);

					assertEquals(result.bbResponse.data.filesMoved.length, 0, 'Should have no moved files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'No files moved');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					'Destination overwrite_dest/no_overwrite.txt already exists and overwrite is false',
				);
				assertStringIncludes(firstResult.text, 'no_overwrite.txt');

				// Check that the file exists in the destination
				assert(await exists(join(destDir, 'no_overwrite.txt')), 'Source file exists in destination');

				assertEquals(
					await Deno.readTextFile(join(destDir, 'no_overwrite.txt')),
					'old content',
					'Destination file was not overwritten with moved file',
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
	name: 'MoveFilesTool - Attempt to move non-existent file',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				//const nonExistentFile = join(testProjectRoot, 'non_existent.txt');
				const destDir = join(testProjectRoot, 'non_existent_dest');
				await ensureDir(destDir);

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_files');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_files',
					toolInput: {
						sources: ['non_existent.txt'],
						destination: 'non_existent_dest',
						overwrite: false,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Attempt to move non-existent file - bbResponse:', result.bbResponse);
				// console.log('Attempt to move non-existent file - toolResponse:', result.toolResponse);
				// console.log('Attempt to move non-existent file - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveFilesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveFilesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.filesError.length,
						1,
						'Should have 1 successful moved file results',
					);
					const testResult = result.bbResponse.data.filesError.find((r) => r === 'non_existent.txt');

					assert(testResult, 'Should have a result for non_existent.txt');

					assertEquals(testResult, 'non_existent.txt', 'Test response should match "non_existent.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'non_existent_dest',
						'Destination should match "non_existent_dest"',
					);

					assertEquals(result.bbResponse.data.filesMoved.length, 0, 'Should have no moved files');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}
				assertStringIncludes(result.toolResponse, 'No files moved');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 1, 'toolResults should have 1 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					firstResult.text,
					'non_existent.txt: No such file or directory',
				);

				// Check that the file exists in the destination
				//assert(await exists(join(destDir, 'non_existent.txt')), 'Source file exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
