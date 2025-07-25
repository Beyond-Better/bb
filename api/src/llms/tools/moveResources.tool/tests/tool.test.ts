import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
//import { existsSync } from '@std/fs';
import { join } from '@std/path';
import { ensureDir, ensureFile, exists } from '@std/fs';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolMoveResourcesResponseData } from '../types.ts';

// Type guard function
function isMoveResourcesResponse(
	response: unknown,
): response is LLMToolMoveResourcesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'destination' in data &&
		typeof data.destination === 'string' &&
		'resourcesMoved' in data &&
		Array.isArray(data.resourcesMoved) &&
		'resourcesError' in data &&
		Array.isArray(data.resourcesError)
	);
}

// // Type guard to check if bbResponse is a string
// function isString(value: unknown): value is string {
// 	return typeof value === 'string';
// }

Deno.test({
	name: 'MoveResourcesTool - Move single resource',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource = join(testProjectRoot, 'source.txt');
				const destDir = join(testProjectRoot, 'dest');
				await ensureFile(sourceResource);
				await ensureDir(destDir);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
					toolInput: {
						sources: ['source.txt'],
						destination: 'dest',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Move single resource - bbResponse:', result.bbResponse);
				// console.log('Move single resource - toolResponse:', result.toolResponse);
				// console.log('Move single resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesMoved.length,
						1,
						'Should have 1 successful moved resource results',
					);
					const testResult = result.bbResponse.data.resourcesMoved.find((r) => r === 'source.txt');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source.txt', 'Test response should match "source.txt"');

					assertEquals(result.bbResponse.data.destination, 'dest', 'Destination should match "dest"');

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no new resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				//assertStringIncludes(result.bbResponse, 'BB has moved these resources to');
				assertStringIncludes(result.toolResponse, 'Moved resources to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const firstResult = result.toolResults[0];
				assert(firstResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(firstResult.text, 'Used data source: primary');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Resource moved: ',
				);
				assertStringIncludes(secondResult.text, 'source.txt');

				// Check that the resource exists in the destination
				assert(await exists(join(destDir, 'source.txt')), 'Source resource exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveResourcesTool - Create missing directories',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource = join(testProjectRoot, 'source.txt');
				const destDir = join(testProjectRoot, 'new_dir', 'sub_dir');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
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
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesMoved.length,
						1,
						'Should have 1 successful moved resource results',
					);
					const testResult = result.bbResponse.data.resourcesMoved.find((r) => r === 'source.txt');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source.txt', 'Test response should match "source.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'new_dir/sub_dir',
						'Destination should match "new_dir/sub_dir"',
					);

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no new resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved resources to');

				assert(await exists(join(destDir, 'source.txt')), 'Source resource exists in destination');
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
	name: 'MoveResourcesTool - Fail to create missing directories',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource = join(testProjectRoot, 'source.txt');
				const destDir = join(testProjectRoot, 'another_new_dir', 'sub_dir');
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'test content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
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
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						1,
						'Should have 1 successful moved resource results',
					);
					const testResult = result.bbResponse.data.resourcesError.find((r) => r === 'source.txt');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source.txt', 'Test response should match "source.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'another_new_dir/sub_dir',
						'Destination should match "another_new_dir/sub_dir"',
					);

					assertEquals(result.bbResponse.data.resourcesMoved.length, 0, 'Should have no moved resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Failed to move resources');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					' No such file or directory',
				);
				assertStringIncludes(secondResult.text, 'source.txt');

				assert(!(await exists(join(destDir, 'source.txt'))), 'Source resource does not exist in destination');
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
	name: 'MoveResourcesTool - Move multiple resources',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource1 = join(testProjectRoot, 'file1.txt');
				const sourceResource2 = join(testProjectRoot, 'file2.txt');
				const destDir = join(testProjectRoot, 'multi_dest');
				await ensureDir(destDir);
				await ensureFile(sourceResource1);
				await ensureFile(sourceResource2);

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
					toolInput: {
						sources: ['file1.txt', 'file2.txt'],
						destination: 'multi_dest',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Move multiple resources - bbResponse:', result.bbResponse);
				// console.log('Move multiple resources - toolResponse:', result.toolResponse);
				// console.log('Move multiple resources - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesMoved.length,
						2,
						'Should have 2 successful moved resource results',
					);
					const testResult1 = result.bbResponse.data.resourcesMoved.find((r) => r === 'file1.txt');
					const testResult2 = result.bbResponse.data.resourcesMoved.find((r) => r === 'file2.txt');

					assert(testResult1, 'Should have a result for file1.txt');
					assert(testResult2, 'Should have a result for file2.txt');

					assertEquals(testResult1, 'file1.txt', 'Test response should match "file1.txt"');
					assertEquals(testResult2, 'file2.txt', 'Test response should match "file2.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'multi_dest',
						'Destination should match "multi_dest"',
					);

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no new resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved resources to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

				const expectedResources = ['file1.txt', 'file2.txt'];
				const moveResults = result.toolResults.slice(1); // skip the first element for data source used

				for (const [index, resource] of expectedResources.entries()) {
					const moveResult = moveResults[index];
					assert(moveResult.type === 'text', `Move result ${index} should be of type text`);
					assertStringIncludes(
						moveResult.text,
						'Resource moved: ',
					);
					assertStringIncludes(moveResult.text, resource);
				}

				const foundResources = result.toolResponse.split('\n').slice(2); //skip the first two lines for data source used.

				assert(
					foundResources.some((f) => f.endsWith('Moved resources to multi_dest:')),
					`Destination 'multi_dest' not found in the result`,
				);
				expectedResources.forEach((resource) => {
					assert(
						foundResources.some((f) => f === `- ${resource}`),
						`Resource ${resource} not found in the result`,
					);
				});
				assert(
					foundResources.length - 1 === expectedResources.length,
					'Number of found resources does not match expected',
				);

				// Check that the resource exists in the destination
				assert(await exists(join(destDir, 'file1.txt')), 'Source resource exists in destination');
				assert(await exists(join(destDir, 'file2.txt')), 'Source resource exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveResourcesTool - Move directory',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
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
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
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
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesMoved.length,
						1,
						'Should have 1 successful moved resource results',
					);
					const testResult = result.bbResponse.data.resourcesMoved.find((r) => r === 'source_dir');

					assert(testResult, 'Should have a result for source.txt');

					assertEquals(testResult, 'source_dir', 'Test response should match "source_dir"');

					assertEquals(
						result.bbResponse.data.destination,
						'dest_dir',
						'Destination should match "dest_dir"',
					);

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no new resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved resources to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const expectedResources = ['source_dir'];
				const moveResults = result.toolResults.slice(1); // skip the first element for data source used

				for (const [index, resource] of expectedResources.entries()) {
					const moveResult = moveResults[index];
					assert(moveResult.type === 'text', `Move result ${index} should be of type text`);
					assertStringIncludes(
						moveResult.text,
						'Resource moved: ',
					);
					assertStringIncludes(moveResult.text, resource);
				}

				const foundResources = result.toolResponse.split('\n').slice(2); //skip the first two lines for data source used.

				assert(
					foundResources.some((f) => f === 'Moved resources to dest_dir:'),
					`Destination 'dest_dir' not found in the result`,
				);
				expectedResources.forEach((resource) => {
					assert(
						foundResources.some((f) => f === `- ${resource}`),
						`Resource ${resource} not found in the result`,
					);
				});
				assert(
					foundResources.length - 1 === expectedResources.length,
					'Number of found resources does not match expected',
				);

				// Check that the resource exists in the destination
				assert(await exists(join(destDir, 'source_dir', 'file.txt')), 'Source resource exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'MoveResourcesTool - Overwrite existing resource',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource = join(testProjectRoot, 'overwrite.txt');
				const destDir = join(testProjectRoot, 'overwrite_dest');
				await ensureDir(destDir);
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'new content');
				await ensureFile(join(destDir, 'overwrite.txt'));
				await Deno.writeTextFile(join(destDir, 'overwrite.txt'), 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
					toolInput: {
						sources: ['overwrite.txt'],
						destination: 'overwrite_dest',
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
				assert(
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesMoved.length,
						1,
						'Should have 1 successful moved resource results',
					);
					const testResult = result.bbResponse.data.resourcesMoved.find((r) => r === 'overwrite.txt');

					assert(testResult, 'Should have a result for overwrite.txt');

					assertEquals(testResult, 'overwrite.txt', 'Test response should match "overwrite.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'overwrite_dest',
						'Destination should match "overwrite_dest"',
					);

					assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no new resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'Moved resources to');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'Resource moved: overwrite.txt',
				);
				assertStringIncludes(secondResult.text, 'overwrite.txt');

				// Check that the resource exists in the destination
				assert(await exists(join(destDir, 'overwrite.txt')), 'Source resource exists in destination');

				assertEquals(
					await Deno.readTextFile(join(destDir, 'overwrite.txt')),
					'new content',
					'Destination resource was overwritten with moved resource',
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
	name: 'MoveResourcesTool - Fail to overwrite without permission',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				const sourceResource = join(testProjectRoot, 'no_overwrite.txt');
				const destDir = join(testProjectRoot, 'overwrite_dest');
				await ensureDir(destDir);
				await ensureFile(sourceResource);
				await Deno.writeTextFile(sourceResource, 'new content');
				await ensureFile(join(destDir, 'no_overwrite.txt'));
				await Deno.writeTextFile(join(destDir, 'no_overwrite.txt'), 'old content');

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
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
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						1,
						'Should have 1 successful moved resource results',
					);
					const testResult = result.bbResponse.data.resourcesError.find((r) => r === 'no_overwrite.txt');

					assert(testResult, 'Should have a result for no_overwrite.txt');

					assertEquals(testResult, 'no_overwrite.txt', 'Test response should match "no_overwrite.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'overwrite_dest',
						'Destination should match "overwrite_dest"',
					);

					assertEquals(result.bbResponse.data.resourcesMoved.length, 0, 'Should have no moved resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}

				assertStringIncludes(result.toolResponse, 'No resources moved');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'no_overwrite.txt: Destination file already exists and overwrite is false: overwrite_dest/no_overwrite.txt',
				);
				assertStringIncludes(secondResult.text, 'no_overwrite.txt');

				// Check that the resource exists in the destination
				assert(await exists(join(destDir, 'no_overwrite.txt')), 'Source resource exists in destination');

				assertEquals(
					await Deno.readTextFile(join(destDir, 'no_overwrite.txt')),
					'old content',
					'Destination resource was not overwritten with moved resource',
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
	name: 'MoveResourcesTool - Attempt to move non-existent resource',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);

			try {
				//const nonExistentResource = join(testProjectRoot, 'non_existent.txt');
				const destDir = join(testProjectRoot, 'non_existent_dest');
				await ensureDir(destDir);

				const toolManager = await getToolManager(projectEditor);
				const tool = await toolManager.getTool('move_resources');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'move_resources',
					toolInput: {
						sources: ['non_existent.txt'],
						destination: 'non_existent_dest',
						overwrite: false,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Attempt to move non-existent resource - bbResponse:', result.bbResponse);
				// console.log('Attempt to move non-existent resource - toolResponse:', result.toolResponse);
				// console.log('Attempt to move non-existent resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isMoveResourcesResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isMoveResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						1,
						'Should have 1 successful moved resource results',
					);
					const testResult = result.bbResponse.data.resourcesError.find((r) => r === 'non_existent.txt');

					assert(testResult, 'Should have a result for non_existent.txt');

					assertEquals(testResult, 'non_existent.txt', 'Test response should match "non_existent.txt"');

					assertEquals(
						result.bbResponse.data.destination,
						'non_existent_dest',
						'Destination should match "non_existent_dest"',
					);

					assertEquals(result.bbResponse.data.resourcesMoved.length, 0, 'Should have no moved resources');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}
				assertStringIncludes(result.toolResponse, 'No resources moved');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length > 0, 'toolResults should not be empty');
				assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

				const secondResult = result.toolResults[1];
				assert(secondResult.type === 'text', 'First result should be of type text');
				assertStringIncludes(
					secondResult.text,
					'non_existent.txt: Source file not found: non_existent.txt',
				);

				// Check that the resource exists in the destination
				//assert(await exists(join(destDir, 'non_existent.txt')), 'Source resource exists in destination');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
