import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolLoadResourcesResponseData } from '../types.ts';
import { isLoadResourcesResponse } from './tool.test.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

/**
 * Content Format tests for LoadResources tool
 * Tests the contentFormat parameter functionality across different data source types
 */

Deno.test({
	name: 'LoadResourcesTool - ContentFormat - Filesystem ignores contentFormat parameter',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			// Create test resource
			const testContent = 'Hello from filesystem!';
			await Deno.writeTextFile(join(testProjectRoot, 'format-test.txt'), testContent);

			// Test with different contentFormat values - all should behave the same for filesystem
			const contentFormats = ['plainText', 'structured', 'both'] as const;

			for (const contentFormat of contentFormats) {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: `test-filesystem-${contentFormat}`,
					toolName: 'load_resources',
					toolInput: {
						mode: 'template',
						uriTemplate: 'file:./{path}',
						templateResources: [{ path: 'format-test.txt' }],
						contentFormat,
					},
				};

				const interaction = await projectEditor.initInteraction(
					'test-collaboration-id',
					'test-interaction-id',
				);
				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify filesystem behavior is consistent regardless of contentFormat
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					`bbResponse should be an object for ${contentFormat}`,
				);
				assert(
					isLoadResourcesResponse(result.bbResponse),
					`bbResponse should have correct structure for ${contentFormat}`,
				);

				if (isLoadResourcesResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcesAdded.length,
						1,
						`Should have 1 resource for ${contentFormat}`,
					);
					assertEquals(
						result.bbResponse.data.resourcesError.length,
						0,
						`Should have no errors for ${contentFormat}`,
					);
				}

				assertStringIncludes(
					result.toolResponse,
					'Added resources to the conversation',
					`Should indicate success for ${contentFormat}`,
				);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - ContentFormat - Notion structured datasource with plainText format',
	fn: async () => {
		const extraDatasources = ['notion'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-notion-plaintext',
				toolName: 'load_resources',
				toolInput: {
					dataSourceId: 'test-notion-connection',
					mode: 'template',
					uriTemplate: 'notion://{path}',
					templateResources: [{ path: 'page/simple-page-123' }],
					contentFormat: 'plainText',
				},
			};

			const interaction = await projectEditor.initInteraction(
				'test-collaboration-id',
				'test-interaction-id',
			);
			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have correct structure',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesAdded.length,
					1,
					'Should have 1 resource added',
				);
				assertEquals(
					result.bbResponse.data.resourcesError.length,
					0,
					'Should have no errors',
				);
				assertEquals(
					result.bbResponse.data.dataSource.dsProviderType,
					'notion',
					'Should indicate Notion datasource',
				);
			}

			assertStringIncludes(
				result.toolResponse,
				'Added resources to the conversation',
				'Should indicate success',
			);
			assertStringIncludes(
				result.toolResponse,
				'test-notion-connection',
				'Should mention the datasource connection',
			);
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - ContentFormat - Google Docs structured datasource with structured format',
	fn: async () => {
		const extraDatasources = ['googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-googledocs-structured',
				toolName: 'load_resources',
				toolInput: {
					dataSourceId: 'test-googledocs-connection',
					mode: 'template',
					uriTemplate: 'googledocs://{path}',
					templateResources: [{ path: 'document/simple-doc-123' }],
					contentFormat: 'structured',
				},
			};

			const interaction = await projectEditor.initInteraction(
				'test-collaboration-id',
				'test-interaction-id',
			);
			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have correct structure',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesAdded.length,
					1,
					'Should have 1 resource added',
				);
				assertEquals(
					result.bbResponse.data.resourcesError.length,
					0,
					'Should have no errors',
				);
				assertEquals(
					result.bbResponse.data.dataSource.dsProviderType,
					'googledocs',
					'Should indicate Google Docs datasource',
				);
			}

			assertStringIncludes(
				result.toolResponse,
				'Added resources to the conversation',
				'Should indicate success',
			);
			assertStringIncludes(
				result.toolResponse,
				'test-googledocs-connection',
				'Should mention the datasource connection',
			);
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - ContentFormat - Multi-datasource with different contentFormat values',
	fn: async () => {
		const extraDatasources = ['notion', 'googledocs'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			// Create filesystem resource
			await Deno.writeTextFile(join(testProjectRoot, 'multi-test.txt'), 'Multi-test content');

			// Test 1: Filesystem with contentFormat (should be ignored)
			const filesystemToolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-multi-filesystem',
				toolName: 'load_resources',
				toolInput: {
					mode: 'template',
					uriTemplate: 'file:./{path}',
					templateResources: [{ path: 'multi-test.txt' }],
					contentFormat: 'both', // Should be ignored for filesystem
				},
			};

			const filesystemInteraction = await projectEditor.initInteraction(
				'test-collaboration-filesystem',
				'test-interaction-filesystem',
			);
			const filesystemResult = await tool.runTool(
				filesystemInteraction,
				filesystemToolUse,
				projectEditor,
			);

			// Verify filesystem result
			assert(
				isLoadResourcesResponse(filesystemResult.bbResponse),
				'Filesystem result should have correct structure',
			);
			if (isLoadResourcesResponse(filesystemResult.bbResponse)) {
				assertEquals(
					filesystemResult.bbResponse.data.resourcesAdded.length,
					1,
					'Filesystem should have 1 resource added',
				);
			}

			// Test 2: Notion with plainText format
			const notionToolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-multi-notion',
				toolName: 'load_resources',
				toolInput: {
					dataSourceId: 'test-notion-connection',
					mode: 'template',
					uriTemplate: 'notion://{path}',
					templateResources: [{ path: 'page/complex-page-456' }],
					contentFormat: 'plainText',
				},
			};

			const notionInteraction = await projectEditor.initInteraction(
				'test-collaboration-notion',
				'test-interaction-notion',
			);
			const notionResult = await tool.runTool(notionInteraction, notionToolUse, projectEditor);

			// Verify Notion result
			assert(
				isLoadResourcesResponse(notionResult.bbResponse),
				'Notion result should have correct structure',
			);
			if (isLoadResourcesResponse(notionResult.bbResponse)) {
				assertEquals(
					notionResult.bbResponse.data.dataSource.dsProviderType,
					'notion',
					'Should indicate Notion datasource',
				);
				assertEquals(
					notionResult.bbResponse.data.resourcesAdded.length,
					1,
					'Notion should have 1 resource added',
				);
			}

			// Test 3: Google Docs with both format
			const googleDocsToolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-multi-googledocs',
				toolName: 'load_resources',
				toolInput: {
					dataSourceId: 'test-googledocs-connection',
					mode: 'template',
					uriTemplate: 'googledocs://{path}',
					templateResources: [{ path: 'document/structured-doc-202' }],
					contentFormat: 'both',
				},
			};

			const googleDocsInteraction = await projectEditor.initInteraction(
				'test-collaboration-googledocs',
				'test-interaction-googledocs',
			);
			const googleDocsResult = await tool.runTool(
				googleDocsInteraction,
				googleDocsToolUse,
				projectEditor,
			);

			// Verify Google Docs result
			assert(
				isLoadResourcesResponse(googleDocsResult.bbResponse),
				'Google Docs result should have correct structure',
			);
			if (isLoadResourcesResponse(googleDocsResult.bbResponse)) {
				assertEquals(
					googleDocsResult.bbResponse.data.dataSource.dsProviderType,
					'googledocs',
					'Should indicate Google Docs datasource',
				);
				assertEquals(
					googleDocsResult.bbResponse.data.resourcesAdded.length,
					1,
					'Google Docs should have 1 resource added',
				);
			}

			// Verify all operations succeeded
			assertStringIncludes(
				filesystemResult.toolResponse,
				'Added resources to the conversation',
				'Filesystem operation should succeed',
			);
			assertStringIncludes(
				notionResult.toolResponse,
				'Added resources to the conversation',
				'Notion operation should succeed',
			);
			assertStringIncludes(
				googleDocsResult.toolResponse,
				'Added resources to the conversation',
				'Google Docs operation should succeed',
			);
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - ContentFormat - Default value behavior',
	fn: async () => {
		const extraDatasources = ['notion'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			// Test without specifying contentFormat (should default to 'plainText')
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-default-format',
				toolName: 'load_resources',
				toolInput: {
					dataSourceId: 'test-notion-connection',
					mode: 'template',
					uriTemplate: 'notion://{path}',
					templateResources: [{ path: 'page/minimal-page-101' }],
					// No contentFormat specified - should default to 'plainText'
				},
			};

			const interaction = await projectEditor.initInteraction(
				'test-collaboration-default',
				'test-interaction-default',
			);
			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have correct structure',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesAdded.length,
					1,
					'Should have 1 resource added with default format',
				);
				assertEquals(
					result.bbResponse.data.resourcesError.length,
					0,
					'Should have no errors with default format',
				);
			}

			assertStringIncludes(
				result.toolResponse,
				'Added resources to the conversation',
				'Should succeed with default contentFormat',
			);
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - ContentFormat - Direct mode with contentFormat',
	fn: async () => {
		const extraDatasources = ['notion'] as DataSourceProviderType[];
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			// Test direct mode with contentFormat parameter
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-direct-format',
				toolName: 'load_resources',
				toolInput: {
					dataSourceId: 'test-notion-connection',
					mode: 'direct',
					directUris: ['notion://page/simple-page-123'],
					contentFormat: 'structured',
				},
			};

			const interaction = await projectEditor.initInteraction(
				'test-collaboration-direct',
				'test-interaction-direct',
			);
			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have correct structure',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesAdded.length,
					1,
					'Should have 1 resource added in direct mode',
				);
				assertEquals(
					result.bbResponse.data.dataSource.dsProviderType,
					'notion',
					'Should indicate Notion datasource',
				);
			}

			assertStringIncludes(
				result.toolResponse,
				'Added resources to the conversation',
				'Should succeed with direct mode and contentFormat',
			);
		}, extraDatasources);
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
