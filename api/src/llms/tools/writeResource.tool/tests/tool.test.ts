import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getTestProvider,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import { ResourceHandlingError, ToolHandlingError } from 'api/errors/error.ts';
import type { TestNotionProvider } from 'api/tests/testProviders.ts';
import { MockGoogleDocsClient, MockNotionClient } from 'api/tests/mockClients.ts';
import type { LLMToolWriteResourceResponseData } from '../types.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

const VALID_ACKNOWLEDGEMENT =
	'I have checked for existing resource contents and confirm this is the complete resource content with no omissions or placeholders';

// Type guard function
function isWriteResourceResponse(
	response: unknown,
): response is LLMToolWriteResourceResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resourcePath' in data &&
		typeof data.resourcePath === 'string' &&
		'contentType' in data &&
		typeof data.contentType === 'string' &&
		'size' in data &&
		typeof data.size === 'number' &&
		'isNewResource' in data &&
		typeof data.isNewResource === 'boolean'
	);
}

// Type guard to check if toolResults is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'Write Resource Tool - create new plain text resource',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'new-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: 'Hello, world!',
							acknowledgement: VALID_ACKNOWLEDGEMENT,
							expectedLineCount: 1,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('create new plain text resource - bbResponse:', result.bbResponse);
				// console.log('create new plain text resource - toolResponse:', result.toolResponse);
				// console.log('create new plain text resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcePath,
						testResource,
						`Test response resourcePath should be "${testResource}"`,
					);
					assertEquals(
						result.bbResponse.data.contentType,
						'plain-text',
						'Test response contentType should be "plain-text"',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						true,
						'Test response isNewResource should be true',
					);
					assertEquals(
						result.bbResponse.data.lineCount,
						1,
						'Test response lineCount should be 1',
					);
				}

				assertStringIncludes(result.toolResponse, 'Created new-test.txt with plain-text content');
				if (isString(result.toolResults)) {
					assertStringIncludes(result.toolResults, 'Resource new-test.txt created with plain-text content');
				}

				// Verify file was actually created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Hello, world!');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - test multiple datasources with structured content',
	async fn() {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId: string, testProjectRoot: string) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				// Test structured content creation
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						dataSourceId: 'test-notion-connection',
						resourcePath: 'page/test-page-123/test-multi-datasource',
						structuredContent: {
							blocks: [
								{
									_type: 'block',
									style: 'h1',
									children: [
										{
											_type: 'span',
											text: 'Multi-Datasource Test',
											marks: [],
										},
									],
								},
								{
									_type: 'block',
									style: 'normal',
									children: [
										{
											_type: 'span',
											text: 'This content should be created in available structured datasources.',
											marks: [],
										},
									],
								},
							],
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				const resultNotion = await tool.runTool(interaction, toolUse, projectEditor);
				//console.log('test multiple datasources with structured content - bbResponse:', resultNotion.bbResponse);
				//console.log('test multiple datasources with structured content - toolResponse:', resultNotion.toolResponse);
				//console.log('test multiple datasources with structured content - toolResults:', resultNotion.toolResults);

				// Verify the resultNotion structure
				assert(
					resultNotion.bbResponse && typeof resultNotion.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(resultNotion.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(resultNotion.bbResponse)) {
					assertEquals(
						resultNotion.bbResponse.data.contentType,
						'structured',
						'Test response contentType should be "structured"',
					);
				}

				// Test Notion provider
				const notionProvider = await getTestProvider(projectEditor, 'notion');
				assert(notionProvider, 'Notion provider should be defined');

				const mockNotionClient = notionProvider.getMockClient() as MockNotionClient;
				const allNotionPages = mockNotionClient.getAllPagesData();
				//console.log('test multiple datasources with structured content - allNotionPages:', allNotionPages);
				//console.dir(allNotionPages, {depth: null});

				// Should include default test data + any created content
				assertEquals(allNotionPages.size >= 5, true, 'Should have default Notion test data');

				// Extract the resource ID from the Notion response
				let notionResourceId: string;
				if (isWriteResourceResponse(resultNotion.bbResponse)) {
					notionResourceId = resultNotion.bbResponse.data.resourceId;
					console.log('Notion Resource ID:', notionResourceId);
				} else {
					throw new Error('Unable to extract resource ID from Notion response');
				}

				// Find the page using the exact resource ID (most reliable method)
				const newestNotionPage = mockNotionClient.getPageData(notionResourceId);

				if (!newestNotionPage) {
					console.log('Available Notion Page IDs:', Array.from(allNotionPages.keys()));
					console.log('Looking for Resource ID:', notionResourceId);
				}

				assert(newestNotionPage, `Should have created a Notion page with ID: ${notionResourceId}`);

				// Verify exact content match (no duplication)
				const notionActualContent = newestNotionPage.blocks.map((block: any) => ({
					style: block.style,
					text: block.children?.map((child: any) => child.text).join('') || '',
				}));

				// Account for automatic title block when creating pages with parent
				const notionExpectedContent = [
					{ style: 'h1', text: 'Test Multi Datasource' }, // Auto-generated title
					{ style: 'h1', text: 'Multi-Datasource Test' },
					{ style: 'normal', text: 'This content should be created in available structured datasources.' },
				];

				//console.log('Notion actual content:', JSON.stringify(notionActualContent, null, 2));
				//console.log('Notion expected content:', JSON.stringify(notionExpectedContent, null, 2));

				assertEquals(
					notionActualContent.length,
					notionExpectedContent.length,
					`Notion page should have exactly ${notionExpectedContent.length} blocks, got ${notionActualContent.length}`,
				);

				for (let i = 0; i < notionExpectedContent.length; i++) {
					assertEquals(
						notionActualContent[i].style,
						notionExpectedContent[i].style,
						`Notion block ${i} should have style '${notionExpectedContent[i].style}', got '${
							notionActualContent[i].style
						}'`,
					);
					assertEquals(
						notionActualContent[i].text,
						notionExpectedContent[i].text,
						`Notion block ${i} should have text '${notionExpectedContent[i].text}', got '${
							notionActualContent[i].text
						}'`,
					);
				}

				toolUse.toolInput.dataSourceId = 'test-googledocs-connection';
				toolUse.toolInput.resourcePath = 'document/test-multi-datasource';

				const resultGoogledocs = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('test multiple datasources with structured content - bbResponse:', resultGoogledocs.bbResponse);
				// console.log('test multiple datasources with structured content - toolResponse:', resultGoogledocs.toolResponse);
				// console.log('test multiple datasources with structured content - toolResults:', resultGoogledocs.toolResults);

				// Verify the resultGoogledocs structure
				assert(
					resultGoogledocs.bbResponse && typeof resultGoogledocs.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(resultGoogledocs.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(resultGoogledocs.bbResponse)) {
					assertEquals(
						resultGoogledocs.bbResponse.data.contentType,
						'structured',
						'Test response contentType should be "structured"',
					);
				}

				// Test Google Docs provider
				const googleDocsProvider = await getTestProvider(projectEditor, 'googledocs');
				assert(googleDocsProvider, 'Google Docs provider should be defined');

				const mockGoogleDocsClient = googleDocsProvider.getMockClient() as MockGoogleDocsClient;
				const allGoogleDocs = mockGoogleDocsClient.getAllDocumentsData();
				//console.dir(allGoogleDocs, {depth: null});
				// console.log('Test search results:', Array.from(allGoogleDocs.values()).map(page =>
				//   page.blocks?.map(block =>
				//     block.children?.map(child => child.text)
				//   ).flat()
				// ).flat().filter(Boolean));

				// Should include default test data
				assertEquals(allGoogleDocs.size >= 5, true, 'Should have default Google Docs test data');

				// Find the newly created document (should be the most recent one)
				// Extract the resource ID from the Google Docs response
				let googleDocsResourceId: string;
				if (isWriteResourceResponse(resultGoogledocs.bbResponse)) {
					googleDocsResourceId = resultGoogledocs.bbResponse.data.resourceId;
					//console.log('Google Docs Resource ID:', googleDocsResourceId);
				} else {
					throw new Error('Unable to extract resource ID from Google Docs response');
				}
				const testGoogleDoc = mockGoogleDocsClient.getDocumentData(googleDocsResourceId);

				if (!testGoogleDoc) {
					console.log('Available Google Docs IDs:', Array.from(allGoogleDocs.keys()));
					console.log('Looking for Resource ID:', googleDocsResourceId);
				}

				assert(testGoogleDoc, `Should have created a Google Docs document with ID: ${googleDocsResourceId}`);

				// Verify exact content match (no duplication)
				const googleActualContent = testGoogleDoc.blocks.map((block: any) => ({
					style: block.style,
					text: block.children?.map((child: any) => child.text).join('') || '',
				}));
				//console.log('test multiple datasources with structured content - googleActualContent:', googleActualContent);

				const googleExpectedContent = [
					{ style: 'h1', text: 'Multi-Datasource Test' },
					{ style: 'normal', text: 'This content should be created in available structured datasources.' },
				];

				//console.log('Google Docs actual content:', JSON.stringify(googleActualContent, null, 2));
				//console.log('Google Docs expected content:', JSON.stringify(googleExpectedContent, null, 2));

				assertEquals(
					googleActualContent.length,
					googleExpectedContent.length,
					`Google Docs document should have exactly ${googleExpectedContent.length} blocks, got ${googleActualContent.length}`,
				);

				for (let i = 0; i < googleExpectedContent.length; i++) {
					assertEquals(
						googleActualContent[i].style,
						googleExpectedContent[i].style,
						`Google Docs block ${i} should have style '${googleExpectedContent[i].style}', got '${
							googleActualContent[i].style
						}'`,
					);
					assertEquals(
						googleActualContent[i].text,
						googleExpectedContent[i].text,
						`Google Docs block ${i} should have text '${googleExpectedContent[i].text}', got '${
							googleActualContent[i].text
						}'`,
					);
				}
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - overwrite existing resource',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'existing-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				// Create existing file
				await Deno.writeTextFile(testResourcePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						overwriteExisting: true,
						plainTextContent: {
							content: 'Overwritten content',
							acknowledgement: VALID_ACKNOWLEDGEMENT,
							expectedLineCount: 1,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('overwrite existing resource - bbResponse:', result.bbResponse);
				// console.log('overwrite existing resource - toolResponse:', result.toolResponse);
				// console.log('overwrite existing resource - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcePath,
						testResource,
						`Test response resourcePath should be "${testResource}"`,
					);
					assertEquals(
						result.bbResponse.data.contentType,
						'plain-text',
						'Test response contentType should be "plain-text"',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						false,
						'Test response isNewResource should be false',
					);
				}

				assertStringIncludes(result.toolResponse, 'Overwrote existing-test.txt with plain-text content');

				// Verify file was overwritten
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Overwritten content');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - fail when file exists and overwrite is false',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'existing-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				// Create existing file
				await Deno.writeTextFile(testResourcePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						overwriteExisting: false, // Default behavior
						plainTextContent: {
							content: 'New content',
							acknowledgement: VALID_ACKNOWLEDGEMENT,
							expectedLineCount: 1,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					'already exists and overwriteExisting is false',
				);

				// Verify original file is unchanged
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Original content');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - no content type provided',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'test.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						// No content type provided
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ToolHandlingError,
					'No content type provided',
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
	name: 'Write Resource Tool - multiple content types provided',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'test.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: 'Some text',
							expectedLineCount: 1,
						},
						structuredContent: {
							blocks: [],
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ToolHandlingError,
					'Multiple content types provided',
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
	name: 'Write Resource Tool - structured content with valid acknowledgement',
	async fn() {
		const extraDatasources = ['notion'];
		await withTestProject(async (testProjectId: string, testProjectRoot: string) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'page/test-page-123/structured-test';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						dataSourceId: 'test-notion-connection',
						resourcePath: testResource,
						structuredContent: {
							blocks: [
								{
									_type: 'block',
									style: 'normal',
									children: [
										{
											_type: 'span',
											text: 'Hello structured content!',
											marks: [],
										},
									],
								},
							],
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('structured content with valid acknowledgement - bbResponse:', result.bbResponse);
				console.log('structured content with valid acknowledgement - toolResponse:', result.toolResponse);
				console.log('structured content with valid acknowledgement - toolResults:', result.toolResults);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.contentType,
						'structured',
						'Test response contentType should be "structured"',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						true,
						'Test response isNewResource should be true',
					);
				}

				assertStringIncludes(
					result.toolResponse,
					'Created page/test-page-123/structured-test with structured content',
				);

				// Verify structured content was created correctly
				// For Notion datasource, verify the mock client received the data
				const testProvider = await getTestProvider(projectEditor, 'notion');
				assert(testProvider, 'Test provider should be defined');

				const mockClient = testProvider.getMockClient() as MockNotionClient;
				// Check that a new page was created with the structured content
				const allPages = mockClient.getAllPagesData();
				const createdPage = Array.from(allPages.values()).find((page) =>
					page.title === 'structured-test.json' ||
					page.blocks.some((block) =>
						block.children?.some((child) => child.text?.includes('Hello structured content!'))
					)
				);
				assert(createdPage, 'Expected structured content to be created in Notion mock');
				if (createdPage) {
					// Account for automatic title block when creating pages with parent
					assertEquals(createdPage.blocks[0]._type, 'block');
					assertEquals(createdPage.blocks[0].children![0].text, 'Structured Test'); // Auto-generated title
					assertEquals(createdPage.blocks[1]._type, 'block');
					assertEquals(createdPage.blocks[1].children![0].text, 'Hello structured content!');
				}
			} finally {
				logChangeAndCommitStub.restore();
			}
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - structured content with invalid acknowledgement',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'structured-test.json';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						structuredContent: {
							blocks: [],
							acknowledgement: 'Invalid acknowledgement',
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					'Invalid acknowledgement string for structured content',
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
	name: 'Write Resource Tool - line count mismatch warning',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'line-count-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: 'Line 1\nLine 2\nLine 3',
							expectedLineCount: 5, // Actual is 3
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.lineCount,
						3,
						'Test response lineCount should be 3',
					);
					assertEquals(
						result.bbResponse.data.lineCountError,
						'Line count mismatch. Content has 3 lines but expected 5 lines.',
						'Test response should include line count error',
					);
				}

				// Verify file was still created despite line count mismatch
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Line 1\nLine 2\nLine 3');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - reject empty content by default',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'empty-test.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: '',
							expectedLineCount: 0,
							// allowEmptyContent defaults to false
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					'Empty content provided and allowEmptyContent is false',
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
	name: 'Write Resource Tool - allow empty content when specified',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResource = 'empty-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResource,
						plainTextContent: {
							content: '',
							expectedLineCount: 0,
							allowEmptyContent: true,
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isWriteResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for WriteResource',
				);

				if (isWriteResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.lineCount,
						0,
						'Test response lineCount should be 0',
					);
				}

				// Verify empty file was created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, '');
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Write Resource Tool - throw error for resource outside project',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('write_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			try {
				const testResourcePath = '/tmp/outside_project.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'write_resource',
					toolInput: {
						resourcePath: testResourcePath,
						plainTextContent: {
							content: 'Content outside project',
							expectedLineCount: 1,
							acknowledgement: VALID_ACKNOWLEDGEMENT,
						},
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					`Access denied: ${testResourcePath} is outside the data source directory`,
				);
			} finally {
				logChangeAndCommitStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
