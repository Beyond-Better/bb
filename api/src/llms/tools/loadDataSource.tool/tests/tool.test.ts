import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type { LLMToolLoadDatasourceResponseData } from '../types.ts';
import type { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
import { FilesystemProvider } from 'api/dataSources/filesystemProvider.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { ContentTypeGuidance } from 'shared/types/dataSource.ts';
import { logger } from 'shared/logger.ts';

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
					projectConfig: projectEditor.projectConfig,
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

			const initialInteraction = await projectEditor.initInteraction(
				'test-collaboration-id',
				'test-interaction-id',
			);
			const result = await tool.runTool(initialInteraction, toolUse, projectEditor);
			// console.log('List resources from filesystem - bbResponse:', result.bbResponse);
			// console.log('List resources from filesystem - toolResponse:', result.toolResponse);
			// console.log('List resources from filesystem - toolResults:', result.toolResults);

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

// ============================================================================
// CONTENT TYPE GUIDANCE TESTS
// ============================================================================

Deno.test({
	name: 'LoadDatasourceTool - Content type guidance for filesystem provider',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			// Create test files
			await createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_datasource');
			assert(tool, 'Failed to get tool');

			// Setup filesystem datasource
			const dataSourceRegistry = await getDataSourceRegistry();
			const dsConnection = FilesystemProvider.createFileSystemDataSource(
				'test filesystem guidance',
				testProjectRoot,
				dataSourceRegistry,
				{
					id: 'ds-filesystem-guidance',
					isPrimary: true,
					projectConfig: projectEditor.projectConfig,
				},
			);

			projectEditor.projectData.setDsConnections([dsConnection]);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-filesystem-guidance',
				toolName: 'load_datasource',
				toolInput: {
					dataSourceId: 'ds-filesystem-guidance',
					returnType: 'metadata',
				},
			};

			const initialInteraction = await projectEditor.initInteraction(
				'test-filesystem-guidance-collaboration',
				'test-filesystem-guidance-interaction',
			);
			const result = await tool.runTool(initialInteraction, toolUse, projectEditor);

			// Verify content type guidance is present
			assert(
				isMetadataResponse(result.bbResponse),
				'bbResponse should have the correct structure for metadata response',
			);

			if (isMetadataResponse(result.bbResponse)) {
				const guidance = result.bbResponse.data.contentTypeGuidance as ContentTypeGuidance;
				assert(guidance, 'Content type guidance should be present');

				// Verify filesystem-specific guidance
				assertEquals(guidance.primaryContentType, 'plain-text');
				assert(
					guidance.acceptedContentTypes.includes('plainTextContent'),
					'Should accept plainTextContent',
				);
				assert(
					guidance.acceptedContentTypes.includes('binaryContent'),
					'Should accept binaryContent',
				);
				assert(
					guidance.acceptedEditTypes.includes('searchReplace'),
					'Should accept searchReplace',
				);
				assertEquals(guidance.preferredContentType, 'plainTextContent');

				// Verify examples are present
				assert(Array.isArray(guidance.examples), 'Examples should be an array');
				assert(guidance.examples.length >= 2, 'Should have at least 2 examples');

				// Check for write_resource example
				const writeExample = guidance.examples.find((ex) => ex.toolCall.tool === 'write_resource');
				assert(writeExample, 'Should have write_resource example');
				assert(
					writeExample.toolCall.input.plainTextContent,
					'write_resource example should use plainTextContent',
				);

				// Check for edit_resource example
				const editExample = guidance.examples.find((ex) => ex.toolCall.tool === 'edit_resource');
				//logger.info('loadDataSource - editExample', editExample );
				assert(editExample, 'Should have edit_resource example');
				assert(editExample.toolCall.input.operations, 'Should have edit_resource.toolCall.input.operations');
				assertEquals(
					editExample.toolCall.input.operations[0].editType,
					'searchReplace',
					'edit_resource example should be searchReplace type',
				);

				// Verify notes contain corrected information
				assert(Array.isArray(guidance.notes), 'Notes should be an array');
				const notesText = guidance.notes.join(' ');
				assertStringIncludes(
					notesText,
					'multi-line string',
					'Notes should mention multi-line string search (not line-by-line)',
				);
				assert(
					!notesText.includes('line-by-line'),
					'Notes should not mention line-by-line',
				);
			}

			// Verify guidance appears in toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			const guidanceResult = result.toolResults.find((r: any) =>
				r.type === 'text' && r.text.includes('Content Type Guidance:')
			);
			assert(guidanceResult, 'Content type guidance should appear in toolResults');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadDatasourceTool - Content type guidance with both returnType',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			// Create test files
			await createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_datasource');
			assert(tool, 'Failed to get tool');

			// Setup filesystem datasource
			const dataSourceRegistry = await getDataSourceRegistry();
			const dsConnection = FilesystemProvider.createFileSystemDataSource(
				'test both guidance',
				testProjectRoot,
				dataSourceRegistry,
				{
					id: 'ds-both-guidance',
					isPrimary: true,
					projectConfig: projectEditor.projectConfig,
				},
			);

			projectEditor.projectData.setDsConnections([dsConnection]);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-both-guidance',
				toolName: 'load_datasource',
				toolInput: {
					dataSourceId: 'ds-both-guidance',
					returnType: 'both',
					depth: 2,
				},
			};

			const initialInteraction = await projectEditor.initInteraction(
				'test-both-guidance-collaboration',
				'test-both-guidance-interaction',
			);
			const result = await tool.runTool(initialInteraction, toolUse, projectEditor);

			// Verify both mode includes content type guidance
			assert(
				isLoadDatasourceResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isLoadDatasourceResponse(result.bbResponse)) {
				// Should have metadata, resources, AND content type guidance
				assert('metadata' in result.bbResponse.data, 'Should have metadata');
				assert('resources' in result.bbResponse.data, 'Should have resources');
				assert('contentTypeGuidance' in result.bbResponse.data, 'Should have content type guidance');

				const guidance = result.bbResponse.data.contentTypeGuidance as ContentTypeGuidance;
				assert(guidance, 'Content type guidance should be present');
				assertEquals(guidance.primaryContentType, 'plain-text');
			}

			// Verify toolResults structure includes guidance
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(
				result.toolResults.length >= 4,
				'toolResults should have at least 4 parts for both mode with guidance',
			);

			// Should have: datasource info, metadata, guidance, sample resources
			const guidanceResult = result.toolResults.find((r: any) =>
				r.type === 'text' && r.text.includes('Content Type Guidance:')
			);
			assert(guidanceResult, 'Content type guidance should appear in toolResults');

			const resourcesResult = result.toolResults.find((r: any) =>
				r.type === 'text' && r.text.includes('Sample Resources')
			);
			assert(resourcesResult, 'Sample resources should appear in toolResults');
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
					projectConfig: projectEditor.projectConfig,
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

			const initialInteraction = await projectEditor.initInteraction(
				'test-metadata-collaboration-id',
				'test-metadata-interaction-id',
			);
			const result = await tool.runTool(initialInteraction, toolUse, projectEditor);
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
				// Resources should NOT be present in metadata-only response
				assert(
					!('resources' in result.bbResponse.data),
					'Resources should not be present in metadata response',
				);

				// Content type guidance SHOULD be present in metadata response
				assert(
					'contentTypeGuidance' in result.bbResponse.data,
					'Content type guidance should be present in metadata response',
				);
				assert(
					result.bbResponse.data.contentTypeGuidance &&
						typeof result.bbResponse.data.contentTypeGuidance === 'object',
					'Content type guidance should be an object',
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

			// Check for content type guidance in toolResults
			assert(
				result.toolResults.length >= 3,
				'toolResults should have at least 3 parts for metadata with guidance',
			);
			const guidanceResult = result.toolResults[2];
			logger.info('loadDataSource - guidanceResult', guidanceResult);
			assert(guidanceResult.type === 'text', 'Third result should be content type guidance');
			assertStringIncludes(guidanceResult.text, 'Content Type Guidance:');
			assertStringIncludes(guidanceResult.text, 'Primary Type: plain-text');
			assertStringIncludes(guidanceResult.text, 'plainTextContent, binaryContent');
			assertStringIncludes(guidanceResult.text, 'searchReplace');
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
					projectConfig: projectEditor.projectConfig,
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

			const initialInteraction = await projectEditor.initInteraction(
				'test-both-collaboration-id',
				'test-both-interaction-id',
			);
			const result = await tool.runTool(initialInteraction, toolUse, projectEditor);
			// console.log('Get both metadata and sample resources - bbResponse:', result.bbResponse);
			// console.log('Get both metadata and sample resources - toolResponse:', result.toolResponse);
			// console.log('Get both metadata and sample resources - toolResults:', result.toolResults);

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
				assert(
					'contentTypeGuidance' in result.bbResponse.data,
					'Content type guidance should be present in both response',
				);

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

			const resourcesGuidance = result.toolResults[2];
			assert(resourcesGuidance.type === 'text', 'Third result should be guidance');
			assertStringIncludes(resourcesGuidance.text, 'Content Type Guidance');
			assertStringIncludes(resourcesGuidance.text, 'Primary Type: plain-text');

			const resourcesResult = result.toolResults[3];
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

			const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');

			try {
				await tool.runTool(interaction, toolUse, projectEditor);
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
