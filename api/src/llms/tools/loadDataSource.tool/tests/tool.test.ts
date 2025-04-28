import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type { LLMToolLoadDatasourceResponseData } from '../types.ts';
import type { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
import { FilesystemProvider } from 'api/dataSources/filesystemProvider.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';

// Type guard for response validation
export function isLoadDatasourceResponse(
	response: unknown,
): response is LLMToolLoadDatasourceResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resources' in data &&
		Array.isArray((data as { resources: unknown }).resources) &&
		'dataSource' in data &&
		data.dataSource !== null &&
		typeof data.dataSource === 'object' &&
		'dsConnectionId' in data.dataSource &&
		typeof data.dataSource.dsConnectionId === 'string' &&
		'dsConnectionName' in data.dataSource &&
		typeof data.dataSource.dsConnectionName === 'string' &&
		'dsProviderType' in data.dataSource &&
		typeof data.dataSource.dsProviderType === 'string'
	);
}

async function createTestFiles(testProjectRoot: string): Promise<void> {
	// Create directory structure
	const subDir = join(testProjectRoot, 'sub-dir');
	const folder1 = join(testProjectRoot, 'folder1');

	// Ensure directories exist
	await Deno.mkdir(subDir, { recursive: true });
	await Deno.mkdir(folder1, { recursive: true });

	// Create test files with content
	await Deno.writeTextFile(
		join(testProjectRoot, 'file1.txt'),
		'This is test file 1 content.',
	);

	await Deno.writeTextFile(
		join(subDir, 'file2.txt'),
		'This is test file 2 content in a subdirectory.',
	);

	// Return to allow chaining if needed
	return;
}

Deno.test({
	name: 'LoadDatasourceTool - List resources from filesystem',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			// Create actual files instead of mocking
			await createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_datasource');
			assert(tool, 'Failed to get tool');

			// Mock the getDsConnection method
			const dataSourceRegistry = await getDataSourceRegistry();
			const dsConnection = FilesystemProvider.createFileSystemDataSource(
				'test 5',
				testProjectRoot,
				dataSourceRegistry,
				{
					id: 'ds-xyz1234',
					isPrimary: true,
					//capabilities: ['read', 'write', 'list', 'search'],
				},
			);
			const accessor = await dsConnection.getResourceAccessor();

			//projectEditor.projectData.initializeDsConnections([dsConnection]);
			projectEditor.projectData.setDsConnections([dsConnection]);
			//projectEditor.projectData.getPrimaryDsConnection = () => dsConnection as DataSourceConnection;

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_datasource',
				toolInput: {
					dataSourceName: 'filesystem-test',
					depth: 2,
				},
			};

			const initialConversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(initialConversation, toolUse, projectEditor);
			console.log('List resources from filesystem - bbResponse:', result.bbResponse);
			console.log('List resources from filesystem - toolResponse:', result.toolResponse);
			console.log('List resources from filesystem - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isLoadDatasourceResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isLoadDatasourceResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resources.length,
					5,
					'Should have 5 resources',
				);

				//assertEquals(result.bbResponse.data.dataSourceId, 'filesystem-test');
				assertEquals(result.bbResponse.data.dataSource.dsConnectionName, 'test 5');
				assertEquals(result.bbResponse.data.dataSource.dsProviderType, 'filesystem');
				//assertEquals(result.bbResponse.data.uriTemplate, 'bb+filesystem+test-5+file:./{path}');
				assertEquals(result.bbResponse.data.uriTemplate, 'file:./{path}');

				const resourceNames = result.bbResponse.data.resources.map((r) => r.name);
				assert(
					resourceNames.includes('File: file1.txt'),
					'Should include file1.txt',
				);
				assert(
					resourceNames.includes('File: sub-dir/file2.txt'),
					'Should include file2.txt',
				);
				assert(
					resourceNames.includes('Directory: folder1'),
					'Should include folder1',
				);

				const resourcePaths = result.bbResponse.data.resources.map((r) => r.uriTerm);
				assert(
					resourcePaths.includes('file1.txt'),
					'Should include file1.txt',
				);
				assert(
					resourcePaths.includes('sub-dir/file2.txt'),
					'Should include sub-dir/file2.txt',
				);
				assert(
					resourcePaths.includes('folder1'),
					'Should include folder1',
				);
			}

			assertStringIncludes(result.toolResponse, 'Retrieved 5 resources');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Data source: ds-xyz1234');
			assertStringIncludes(firstResult.text, 'Name: test 5');
			assertStringIncludes(firstResult.text, 'Type: filesystem');
			assertStringIncludes(firstResult.text, 'Resource count: 5');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(secondResult.text, 'file1.txt');
			assertStringIncludes(secondResult.text, 'sub-dir/file2.txt');
			assertStringIncludes(secondResult.text, 'folder1');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadDatasourceTool - Data source not found',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_datasource');
			assert(tool, 'Failed to get tool');

			// Mock getDsConnection to return null
			projectEditor.projectData.getPrimaryDsConnection = () => undefined;

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_datasource',
				toolInput: {
					dataSourceName: 'non-existent',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');

			try {
				await tool.runTool(conversation, toolUse, projectEditor);
				assert(false, 'Tool should throw an error for non-existent data source');
			} catch (error) {
				assert(error instanceof Error, 'Error should be an instance of Error');
				assertStringIncludes(error.message, 'Data source not found');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
