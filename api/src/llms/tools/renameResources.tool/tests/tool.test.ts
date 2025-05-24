import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';
import { join } from '@std/path';
import { ensureFile, exists } from '@std/fs';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolRenameResourcesResponseData } from '../types.ts';

// Type guard function
function isRenameResourcesResponse(
	response: unknown,
): response is LLMToolRenameResourcesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resourcesRenamed' in data &&
		Array.isArray(data.resourcesRenamed) &&
		'resourcesError' in data &&
		Array.isArray(data.resourcesError)
	);
}

Deno.test({
	name: 'RenameResourcesTool - Rename single resource',
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
				const destResource = join(testProjectRoot, 'renamed.txt');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_resources',
					toolInput: {
						operations: [{ source: 'source.txt', destination: 'renamed.txt' }],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Rename single resource - bbResponse:', result.bbResponse);
				// console.log('Rename single resource - toolResponse:', result.toolResponse);
				// console.log('Rename single resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesRenamed.length,
						1,
						'Should have 1 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.resourcesRenamed[0];

					assert(renameResult1, 'Should have a result for renamed resource');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(renameResult1.destination, 'renamed.txt', 'Result1 response should match destination');

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed resources');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 element');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(secondResult.text, 'Resource renamed: ');
				assertStringIncludes(secondResult.text, 'source.txt');
				assertStringIncludes(secondResult.text, 'renamed.txt');

				// Check that the resource was renamed
				assert(!(await exists(sourceResource)), 'Source resource should not exist');
				assert(await exists(destResource), 'Destination resource should exist');
				assertEquals(
					await Deno.readTextFile(destResource),
					'test content',
					'Resource content should be preserved',
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
	name: 'RenameResourcesTool - Create missing directories',
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
				const destResource = join(testProjectRoot, 'new_dir', 'renamed.txt');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_resources',
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
					isRenameResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesRenamed.length,
						1,
						'Should have 1 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.resourcesRenamed[0];

					assert(renameResult1, 'Should have a result for renamed resource');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'new_dir/renamed.txt',
						'Result1 response should match destination',
					);

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed resources');

				assert(!(await exists(sourceResource)), 'Source resource should not exist');
				assert(await exists(destResource), 'Destination resource should exist');
				assertEquals(
					await Deno.readTextFile(destResource),
					'test content',
					'Resource content should be preserved',
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
	name: 'RenameResourcesTool - Fail to create missing directories',
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
				const destResource = join(testProjectRoot, 'new_dir', 'renamed.txt');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_resources',
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
					isRenameResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						1,
						'Should have 1 error rename results',
					);
					const renameResult1 = result.bbResponse.data.resourcesError[0];

					assert(renameResult1, 'Should have a result for renamed resource');
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

					assertEquals(result.bbResponse.data.resourcesRenamed.length, 0, 'Should have no renamed resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Failed to rename resources');

				assert(await exists(sourceResource), 'Source resource should still exist');
				assert(!(await exists(destResource)), 'Destination resource should not exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RenameResourcesTool - Rename multiple resources',
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
				const sourceResource1 = join(testProjectRoot, 'file1.txt');
				const sourceResource2 = join(testProjectRoot, 'file2.txt');
				const destResource1 = join(testProjectRoot, 'renamed1.txt');
				const destResource2 = join(testProjectRoot, 'renamed2.txt');
				await ensureFile(sourceResource1);
				await ensureFile(sourceResource2);
				await Deno.writeTextFile(sourceResource1, 'content1');
				await Deno.writeTextFile(sourceResource2, 'content2');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_resources',
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
					isRenameResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesRenamed.length,
						2,
						'Should have 2 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.resourcesRenamed[0];
					const renameResult2 = result.bbResponse.data.resourcesRenamed[1];

					assert(renameResult1, 'Should have a result for renamed resource');
					assertEquals(renameResult1.source, 'file1.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'renamed1.txt',
						'Result1 response should match destination',
					);

					assert(renameResult2, 'Should have a result for renamed resource');
					assertEquals(renameResult2.source, 'file2.txt', 'Result2 response should match source');
					assertEquals(
						renameResult2.destination,
						'renamed2.txt',
						'Result2 response should match destination',
					);

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed resources');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

				assert(!(await exists(sourceResource1)), 'Source resource 1 should not exist');
				assert(!(await exists(sourceResource2)), 'Source resource 2 should not exist');
				assert(await exists(destResource1), 'Destination resource 1 should exist');
				assert(await exists(destResource2), 'Destination resource 2 should exist');
				assertEquals(
					await Deno.readTextFile(destResource1),
					'content1',
					'Resource 1 content should be preserved',
				);
				assertEquals(
					await Deno.readTextFile(destResource2),
					'content2',
					'Resource 2 content should be preserved',
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
	name: 'RenameResourcesTool - Overwrite existing resource',
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
				const destResource = join(testProjectRoot, 'existing.txt');
				await ensureFile(sourceResource);
				await ensureFile(destResource);
				await Deno.writeTextFile(sourceResource, 'new content');
				await Deno.writeTextFile(destResource, 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_resources',
					toolInput: {
						operations: [{ source: 'source.txt', destination: 'existing.txt' }],
						overwrite: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Overwrite existing resource - bbResponse:', result.bbResponse);
				// console.log('Overwrite existing resource - toolResponse:', result.toolResponse);
				// console.log('Overwrite existing resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesRenamed.length,
						1,
						'Should have 1 successful rename results',
					);
					const renameResult1 = result.bbResponse.data.resourcesRenamed[0];

					assert(renameResult1, 'Should have a result for renamed resource');
					assertEquals(renameResult1.source, 'source.txt', 'Result1 response should match source');
					assertEquals(
						renameResult1.destination,
						'existing.txt',
						'Result1 response should match destination',
					);

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no rename errors');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Renamed resources');

				assert(!(await exists(sourceResource)), 'Source resource should not exist');
				assert(await exists(destResource), 'Destination resource should exist');
				assertEquals(
					await Deno.readTextFile(destResource),
					'new content',
					'Destination resource should be overwritten',
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
	name: 'RenameResourcesTool - Fail to overwrite without permission',
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
				const destResource = join(testProjectRoot, 'existing.txt');
				await ensureFile(sourceResource);
				await ensureFile(destResource);
				await Deno.writeTextFile(sourceResource, 'new content');
				await Deno.writeTextFile(destResource, 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_resources',
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
					isRenameResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						1,
						'Should have 1 error rename results',
					);
					const renameResult1 = result.bbResponse.data.resourcesError[0];

					assert(renameResult1, 'Should have a result for renamed resource');
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

					assertEquals(result.bbResponse.data.resourcesRenamed.length, 0, 'Should have no renamed resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Failed to rename resources');

				assert(await exists(sourceResource), 'Source resource should still exist');
				assert(await exists(destResource), 'Destination resource should still exist');
				assertEquals(
					await Deno.readTextFile(sourceResource),
					'new content',
					'Source resource content should be unchanged',
				);
				assertEquals(
					await Deno.readTextFile(destResource),
					'old content',
					'Destination resource should not be overwritten',
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
	name: 'RenameResourcesTool - Attempt to rename non-existent resource',
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
				const nonExistentResource = join(testProjectRoot, 'non_existent.txt');
				const destResource = join(testProjectRoot, 'renamed.txt');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('rename_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'rename_resources',
					toolInput: {
						operations: [{ source: 'non_existent.txt', destination: 'renamed.txt' }],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Attempt to rename non-existent resource - bbResponse:', result.bbResponse);
				// console.log('Attempt to rename non-existent resource - toolResponse:', result.toolResponse);
				// console.log('Attempt to rename non-existent resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assertEquals(typeof result.toolResponse, 'string');
				assertEquals(typeof result.toolResults, 'object');

				assert(
					isRenameResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isRenameResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						1,
						'Should have 1 error rename results',
					);
					const renameResult1 = result.bbResponse.data.resourcesError[0];

					assert(renameResult1, 'Should have a result for renamed resource');
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

					assertEquals(result.bbResponse.data.resourcesRenamed.length, 0, 'Should have no renamed resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}
				assertStringIncludes(result.toolResponse, 'Failed to rename resources');

				assert(!(await exists(nonExistentResource)), 'Source resource should not exist');
				assert(!(await exists(destResource)), 'Destination resource should not exist');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
