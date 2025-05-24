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

	if (
		data === null ||
		typeof data !== 'object' ||
		!('dataSource' in data) ||
		data.dataSource === null ||
		typeof data.dataSource !== 'object' ||
		!('dsConnectionId' in data.dataSource) ||
		typeof data.dataSource.dsConnectionId !== 'string' ||
		!('dsConnectionName' in data.dataSource) ||
		typeof data.dataSource.dsConnectionName !== 'string' ||
		!('dsProviderType' in data.dataSource) ||
		typeof data.dataSource.dsProviderType !== 'string'
	) {
		return false;
	}

	const hasValidMetadata = 'metadata' in data &&
		typeof data.metadata === 'object' &&
		data.metadata !== null &&
		'totalResources' in data.metadata &&
		typeof data.metadata.totalResources === 'number' &&
		'lastScanned' in data.metadata &&
		typeof data.metadata.lastScanned === 'string';

	const hasValidResources = 'resources' in data && Array.isArray((data as { resources: unknown }).resources);

	return hasValidMetadata || hasValidResources;
}

// Type guard for metadata response validation
export function isMetadataResponse(
	response: unknown,
): response is LLMToolLoadDatasourceResponseData {
	return isLoadDatasourceResponse(response) &&
		typeof response === 'object' &&
		response !== null &&
		'data' in response &&
		typeof response.data === 'object' &&
		response.data !== null &&
		'metadata' in response.data;
}

// Type guard for resources response validation
export function isResourcesResponse(
	response: unknown,
): response is LLMToolLoadDatasourceResponseData {
	return isLoadDatasourceResponse(response) &&
		typeof response === 'object' &&
		response !== null &&
		'data' in response &&
		typeof response.data === 'object' &&
		response.data !== null &&
		'resources' in response.data;
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
					returnType: 'resources',
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
				isResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for resources response',
			);

			if (isResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resources?.length || 0,
					5,
					'Should have 5 resources',
				);

				//assertEquals(result.bbResponse.data.dataSourceId, 'filesystem-test');
				assertEquals(result.bbResponse.data.dataSource.dsConnectionName, 'test 5');
				assertEquals(result.bbResponse.data.dataSource.dsProviderType, 'filesystem');
				//assertEquals(result.bbResponse.data.uriTemplate, 'bb+filesystem+test-5+file:./{path}');
				assertEquals(result.bbResponse.data.uriTemplate, 'file:./{path}');

				const resourceNames = result.bbResponse.data.resources?.map((r) => r.name).filter(Boolean) || [];
				const resourceUris = result.bbResponse.data.resources?.map((r) => r.uri) || [];

				// Check that we have the expected files in the resources
				assert(
					resourceUris.some((uri) => uri.includes('file1.txt')),
					'Should include file1.txt',
				);
				assert(
					resourceUris.some((uri) => uri.includes('file2.txt')),
					'Should include file2.txt',
				);
				assert(
					resourceUris.some((uri) => uri.includes('folder1')),
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
	name: 'LoadDatasourceTool - Get metadata from filesystem',
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
				'test metadata',
				testProjectRoot,
				dataSourceRegistry,
				{
					id: 'ds-metadata-test',
					isPrimary: true,
				},
			);

			projectEditor.projectData.setDsConnections([dsConnection]);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-metadata-id',
				toolName: 'load_datasource',
				toolInput: {
					dataSourceName: 'test-metadata',
					returnType: 'metadata',
				},
			};

			const initialConversation = await projectEditor.initConversation('test-metadata-conversation-id');
			const result = await tool.runTool(initialConversation, toolUse, projectEditor);
			console.log('Get metadata from filesystem - bbResponse:', result.bbResponse);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isMetadataResponse(result.bbResponse),
				'bbResponse should have the correct structure for metadata response',
			);

			if (isMetadataResponse(result.bbResponse)) {
				// Verify metadata structure
				const metadata = result.bbResponse.data.metadata;
				assert(metadata, 'Metadata should be present');
				assert(typeof metadata.totalResources === 'number', 'totalResources should be a number');
				assert(typeof metadata.lastScanned === 'string', 'lastScanned should be a string');
				assert(
					metadata.resourceTypes && typeof metadata.resourceTypes === 'object',
					'resourceTypes should be an object',
				);

				// Verify filesystem-specific metadata
				if (metadata.filesystem) {
					assert(
						typeof metadata.filesystem.totalDirectories === 'number',
						'totalDirectories should be a number',
					);
					assert(typeof metadata.filesystem.totalFiles === 'number', 'totalFiles should be a number');
					assert(metadata.filesystem.capabilities, 'capabilities should be present');
					assert(
						typeof metadata.filesystem.capabilities.canRead === 'boolean',
						'canRead should be a boolean',
					);
					assert(
						typeof metadata.filesystem.capabilities.canWrite === 'boolean',
						'canWrite should be a boolean',
					);
				}

				// Verify data source info
				assertEquals(result.bbResponse.data.dataSource.dsConnectionName, 'test metadata');
				assertEquals(result.bbResponse.data.dataSource.dsProviderType, 'filesystem');
				assertEquals(result.bbResponse.data.dataSource.dsConnectionId, 'ds-metadata-test');

				// Resources should NOT be present in metadata-only response
				assert(
					!('resources' in result.bbResponse.data),
					'Resources should not be present in metadata response',
				);
			}

			assertStringIncludes(result.toolResponse, 'Retrieved metadata for data source: ds-metadata-test');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Data source: ds-metadata-test');
			assertStringIncludes(firstResult.text, 'Name: test metadata');
			assertStringIncludes(firstResult.text, 'Type: filesystem');

			const metadataResult = result.toolResults[1];
			assert(metadataResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(metadataResult.text, 'Metadata:');
			assertStringIncludes(metadataResult.text, 'Total Resources:');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadDatasourceTool - Get both metadata and sample resources',
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
				'test both',
				testProjectRoot,
				dataSourceRegistry,
				{
					id: 'ds-both-test',
					isPrimary: true,
				},
			);

			projectEditor.projectData.setDsConnections([dsConnection]);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-both-id',
				toolName: 'load_datasource',
				toolInput: {
					dataSourceName: 'test-both',
					returnType: 'both',
					depth: 2,
				},
			};

			const initialConversation = await projectEditor.initConversation('test-both-conversation-id');
			const result = await tool.runTool(initialConversation, toolUse, projectEditor);
			console.log('Get both metadata and resources - bbResponse:', result.bbResponse);

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
				// Verify both metadata and resources are present
				assert('metadata' in result.bbResponse.data, 'Metadata should be present in both response');
				assert('resources' in result.bbResponse.data, 'Resources should be present in both response');

				// Verify metadata structure
				const metadata = result.bbResponse.data.metadata;
				assert(metadata, 'Metadata should be present');
				assert(typeof metadata.totalResources === 'number', 'totalResources should be a number');
				assert(typeof metadata.lastScanned === 'string', 'lastScanned should be a string');

				// Verify resources structure
				const resources = result.bbResponse.data.resources;
				assert(Array.isArray(resources), 'Resources should be an array');
				assert(resources.length <= 20, 'Sample resources should be limited to 20 or fewer');
				assert(resources.length > 0, 'Should have at least some sample resources');

				// Verify data source info
				assertEquals(result.bbResponse.data.dataSource.dsConnectionName, 'test both');
				assertEquals(result.bbResponse.data.dataSource.dsProviderType, 'filesystem');
				assertEquals(result.bbResponse.data.dataSource.dsConnectionId, 'ds-both-test');

				// Verify uriTemplate is present
				assert('uriTemplate' in result.bbResponse.data, 'uriTemplate should be present');
				assertEquals(result.bbResponse.data.uriTemplate, 'file:./{path}');

				// Verify sample contains expected files
				const resourceNames = resources.map((r) => r.name).filter(Boolean);
				const resourceUris = resources.map((r) => r.uri);

				// Should include at least some of our test files in the sample
				assert(
					resourceNames.some((name) => name?.includes('file1.txt')) ||
						resourceUris.some((uri) => uri.includes('file1.txt')),
					'Sample should include file1.txt',
				);
			}

			assertStringIncludes(
				result.toolResponse,
				'Retrieved metadata and sample resources for data source: ds-both-test',
			);

			// Check toolResults structure for 'both' mode
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length >= 3, 'toolResults should have at least 3 parts for both mode');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Data source: ds-both-test');

			const metadataResult = result.toolResults[1];
			assert(metadataResult.type === 'text', 'Second result should be metadata');
			assertStringIncludes(metadataResult.text, 'Metadata:');

			const resourcesResult = result.toolResults[2];
			assert(resourcesResult.type === 'text', 'Third result should be sample resources');
			assertStringIncludes(resourcesResult.text, 'Sample Resources');
			assertStringIncludes(resourcesResult.text, 'URI Template: file:./{path}');
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
					returnType: 'resources',
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
