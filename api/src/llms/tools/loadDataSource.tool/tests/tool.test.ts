import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type { LLMToolLoadDatasourceResponseData } from '../types.ts';
import { DataSource } from 'api/resources/dataSource.ts';

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
		'dataSourceId' in data &&
		'dataSourceType' in data
	);
}

Deno.test({
	name: 'LoadDatasourceTool - List resources from filesystem',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_datasource');
			assert(tool, 'Failed to get tool');

			// Mock the getDataSource method
			const mockDataSource = DataSource.createFileSystem('test 5', testProjectRoot, {
				id: 'ds-xyz1234',
				capabilities: ['read', 'write', 'list', 'search'],
			});

			projectEditor.projectData.getDataSource = () => mockDataSource;

			// Mock the resourceManager.listFilesystem method
			projectEditor.resourceManager.listFilesystem = async () => ({
				resources: [
					{
						accessMethod: 'bb',
						name: 'file1.txt',
						uri: 'bb-filesystem+test-5+file:./file1.txt',
						type: 'file',
						mimeType: 'text/plain',
						uriTerm: 'file1.txt',
						size: 100,
						lastModified: new Date(),
					},
					{
						accessMethod: 'bb',
						name: 'file2.txt',
						uri: 'bb-filesystem+test-5+file:./sub-dir/file2.txt',
						type: 'file',
						mimeType: 'text/plain',
						uriTerm: 'sub-dir/file2.txt',
						size: 150,
						lastModified: new Date(),
					},
					{
						accessMethod: 'bb',
						name: 'folder1',
						uri: 'bb-filesystem+test-5+file:./folder1',
						type: 'file',
						mimeType: 'application/directory',
						uriTerm: 'folder1',
					},
				],
				pagination: {
					totalCount: 3,
				},
				dataSourceId: 'jdj934tdkfg',
				dataSourceName: 'test 5',
				dataSourceType: 'filesystem',
			});

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_datasource',
				toolInput: {
					dataSourceName: 'filesystem-test',
				},
			};

			const initialConversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(initialConversation, toolUse, projectEditor);
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
				isLoadDatasourceResponse(result.bbResponse),
				'bbResponse should have the correct structure',
			);

			if (isLoadDatasourceResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resources.length,
					3,
					'Should have 3 resources',
				);

				//assertEquals(result.bbResponse.data.dataSourceId, 'filesystem-test');
				assertEquals(result.bbResponse.data.dataSourceName, 'test 5');
				assertEquals(result.bbResponse.data.dataSourceType, 'filesystem');
				assertEquals(result.bbResponse.data.uriTemplate, 'bb-filesystem+test-5+file:./{path}');

				const resourceNames = result.bbResponse.data.resources.map((r) => r.name);
				assert(
					resourceNames.includes('file1.txt'),
					'Should include file1.txt',
				);
				assert(
					resourceNames.includes('file2.txt'),
					'Should include file2.txt',
				);
				assert(
					resourceNames.includes('folder1'),
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

			assertStringIncludes(result.toolResponse, 'Retrieved 3 resources');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Data source: ds-xyz1234');
			assertStringIncludes(firstResult.text, 'Name: test 5');
			assertStringIncludes(firstResult.text, 'Type: filesystem');
			assertStringIncludes(firstResult.text, 'Resource count: 3');

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

			// Mock getDataSource to return null
			projectEditor.projectData.getDataSource = () => undefined;

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
