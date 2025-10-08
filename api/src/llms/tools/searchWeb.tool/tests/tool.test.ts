/**
 * Tests for LLMToolSearchWeb
 *
 * Comprehensive tests covering search functionality, error handling,
 * configuration options, and integration scenarios.
 */

import { assert, assertEquals, assertExists, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';
import { Stub, stub } from '@std/testing/mock';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import { BraveApiClient, BraveApiError } from 'shared/braveApi.ts';
import { errorMessage } from 'shared/error.ts';
import type { LLMToolSearchWebInput, LLMToolSearchWebResponseData } from '../types.ts';

// Type guard function
function isSearchWebResponse(
	response: unknown,
): response is LLMToolSearchWebResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'results' in data &&
		typeof data.results === 'object' &&
		'summary' in data &&
		typeof data.summary === 'object' &&
		'provider' in data &&
		typeof data.provider === 'object'
	);
}

// Test data
const mockBraveResponse = {
	type: 'search' as const,
	query: {
		original: 'test query',
		altered: 'test query corrected',
	},
	web: {
		type: 'search' as const,
		results: [
			{
				type: 'search_result' as const,
				subtype: 'generic' as const,
				title: 'Test Result 1',
				url: 'https://example.com/1',
				description: 'This is a test result',
				is_source_local: false,
				is_source_both: false,
				family_friendly: true,
			},
			{
				type: 'search_result' as const,
				subtype: 'generic' as const,
				title: 'Test Result 2',
				url: 'https://example.com/2',
				description: 'This is another test result',
				is_source_local: false,
				is_source_both: false,
				family_friendly: true,
			},
		],
		family_friendly: true,
	},
	news: {
		type: 'news' as const,
		results: [
			{
				title: 'Test News Article',
				url: 'https://news.example.com/article',
				description: 'Breaking news test',
				source: 'Test News',
				breaking: true,
				is_live: false,
			},
		],
	},
};

const toolConfig = {
	apiProviders: {
		brave: {
			apiKey: 'test-api-key',
			enabled: true,
		},
	},
	proxyUrl: 'https://test-proxy.com/api/v1/api-proxy',
	defaultProvider: 'brave',
};

Deno.test({
	name: 'LLMToolSearchWeb - Constructor and Input Schema Validation',
	fn: async () => {
		await withTestProject(async (testProjectId) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor, 'search_web', toolConfig);
			const tool = await toolManager.getTool('search_web');
			assert(tool, 'Failed to get tool');

			// Check tool properties
			assertEquals(tool.name, 'search_web');
			assertExists(tool.inputSchema);

			// Check schema structure
			const schema = tool.inputSchema;
			assertEquals(schema.type, 'object');
			assertExists(schema.properties);
			assertEquals(schema.required, ['query']);

			// Check query property
			const queryProp = schema.properties.query;
			assertEquals(queryProp.type, 'string');
			assertExists(queryProp.description);

			// Check optional properties
			assertExists(schema.properties.count);
			assertExists(schema.properties.country);
			assertExists(schema.properties.safesearch);
			assertExists(schema.properties.result_filter);
			assertExists(schema.properties.freshness);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Search with User API Key',
	fn: async () => {
		// Mock BraveApiClient
		const webSearchStub: Stub<BraveApiClient> = stub(
			BraveApiClient.prototype,
			'webSearch',
			() => Promise.resolve(mockBraveResponse),
		);

		try {
			await withTestProject(async (testProjectId) => {
				const projectEditor = await getProjectEditor(testProjectId);
				const toolManager = await getToolManager(projectEditor, 'search_web', toolConfig);
				const tool = await toolManager.getTool('search_web');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_web',
					toolInput: {
						query: 'test search query',
						count: 5,
						safesearch: 'moderate',
					} as LLMToolSearchWebInput,
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');
				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isSearchWebResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				// Check result structure
				assertExists(result.toolResults as string);
				assertExists(result.toolResponse);
				assertExists(result.bbResponse);

				// Check that API was called
				assertEquals(webSearchStub.calls.length, 1);

				// Check response content
				assertStringIncludes(result.toolResponse, 'Found');
				assertStringIncludes(result.toolResponse, 'test search query');

				// Check formatted results
				if (typeof result.toolResults === 'string') {
					assertStringIncludes(result.toolResults, 'Search Results');
					assertStringIncludes(result.toolResults, 'Test Result 1');
					assertStringIncludes(result.toolResults, 'Test Result 2');
				}
			});
		} finally {
			webSearchStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Search with Proxy Service',
	fn: async () => {
		// Mock fetch for proxy service
		const originalFetch = globalThis.fetch;
		const fetchStub = stub(
			globalThis,
			'fetch',
			() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							data: mockBraveResponse,
							metadata: {
								requestId: 'proxy-request-123',
								costMicroUsd: 5000,
							},
						}),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						},
					),
				),
		);

		try {
			await withTestProject(async (testProjectId) => {
				const projectEditor = await getProjectEditor(testProjectId);
				const proxyToolConfig = {
					proxyUrl: 'https://test-proxy.com/api/v1/api-proxy',
				};
				const toolManager = await getToolManager(projectEditor, 'search_web', proxyToolConfig);
				const tool = await toolManager.getTool('search_web');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_web',
					toolInput: {
						query: 'proxy test query',
						count: 3,
					} as LLMToolSearchWebInput,
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');
				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isSearchWebResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				// Check that proxy was called
				assertEquals(fetchStub.calls.length, 1);
				const fetchCall = fetchStub.calls[0];
				assertStringIncludes(fetchCall.args[0] as string, 'test-proxy.com');
				assertStringIncludes(fetchCall.args[0] as string, 'brave/web-search');

				// Check result
				assertExists(result.toolResults as string);
				assertStringIncludes(result.toolResponse, 'Found');
			});
		} finally {
			fetchStub.restore();
			globalThis.fetch = originalFetch;
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Input Validation',
	fn: async () => {
		await withTestProject(async (testProjectId) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor, 'search_web', {});
			const tool = await toolManager.getTool('search_web');
			assert(tool, 'Failed to get tool');

			// Test with invalid result filter
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_web',
				toolInput: {
					query: 'test',
					result_filter: 'invalid_filter,web',
				} as LLMToolSearchWebInput,
			};

			const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');

			// Should throw ToolHandlingError for invalid result filters
			const error = await assertRejects(
				() => tool.runTool(interaction, toolUse, projectEditor),
				'Tool should throw error for invalid result filters',
			);

			// Verify error message contains expected content
			assertStringIncludes(errorMessage(error), 'Invalid result filters');
			assertStringIncludes(errorMessage(error), 'invalid_filter');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - API Error Handling',
	fn: async () => {
		// Mock BraveApiClient to throw errors
		const webSearchStub = stub(
			BraveApiClient.prototype,
			'webSearch',
			() => Promise.reject(new BraveApiError('API rate limit exceeded', 429)),
		);

		try {
			await withTestProject(async (testProjectId) => {
				const projectEditor = await getProjectEditor(testProjectId);
				const toolManager = await getToolManager(projectEditor, 'search_web', toolConfig);
				const tool = await toolManager.getTool('search_web');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_web',
					toolInput: {
						query: 'test query',
					} as LLMToolSearchWebInput,
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');

				// Should throw ToolHandlingError for API rate limit
				const error = await assertRejects(
					() => tool.runTool(interaction, toolUse, projectEditor),
					'Tool should throw error for API rate limit',
				);

				// Verify error message contains expected content
				assertStringIncludes(errorMessage(error), 'Rate limit exceeded');
			});
		} finally {
			webSearchStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Network Error Handling',
	fn: async () => {
		// Mock fetch to fail for proxy service
		const originalFetch = globalThis.fetch;
		const fetchStub = stub(
			globalThis,
			'fetch',
			() => Promise.reject(new Error('fetch failed: network error')),
		);

		try {
			await withTestProject(async (testProjectId) => {
				const projectEditor = await getProjectEditor(testProjectId);
				const proxyToolConfig = {
					proxyUrl: 'https://test-proxy.com/api/v1/api-proxy',
				};
				const toolManager = await getToolManager(projectEditor, 'search_web', proxyToolConfig);
				const tool = await toolManager.getTool('search_web');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_web',
					toolInput: {
						query: 'network test query',
					} as LLMToolSearchWebInput,
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');

				// Should throw ToolHandlingError for network failure
				const error = await assertRejects(
					() => tool.runTool(interaction, toolUse, projectEditor),
					'Tool should throw error for network failure',
				);

				// Verify error message contains expected content
				assertStringIncludes(errorMessage(error), 'Network error');
			});
		} finally {
			fetchStub.restore();
			globalThis.fetch = originalFetch;
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Result Processing',
	fn: async () => {
		// Mock BraveApiClient
		const webSearchStub = stub(
			BraveApiClient.prototype,
			'webSearch',
			() => Promise.resolve(mockBraveResponse),
		);

		try {
			await withTestProject(async (testProjectId) => {
				const projectEditor = await getProjectEditor(testProjectId);
				const toolManager = await getToolManager(projectEditor, 'search_web', toolConfig);
				const tool = await toolManager.getTool('search_web');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_web',
					toolInput: {
						query: 'comprehensive test',
						count: 10,
						result_filter: 'web,news',
					} as LLMToolSearchWebInput,
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');
				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isSearchWebResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				if (isSearchWebResponse(result.bbResponse)) {
					// Verify result data structure
					const data = result.bbResponse.data;
					assertExists(data.results);
					assertExists(data.summary);
					assertExists(data.provider);

					// Check that results were processed correctly
					assertEquals(data.results.length, 3); // 2 web + 1 news
					assertEquals(data.summary.provider, 'brave');
					assertEquals(data.provider.source, 'user_key');
				} else {
					assert(false, 'bbResponse does not have the expected structure for Tool');
				}
			});
		} finally {
			webSearchStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Empty Results Handling',
	fn: async () => {
		// Mock BraveApiClient to return empty results
		const webSearchStub = stub(
			BraveApiClient.prototype,
			'webSearch',
			() =>
				Promise.resolve({
					type: 'search' as const,
					query: {
						original: 'no results query',
					},
				}),
		);

		try {
			await withTestProject(async (testProjectId) => {
				const projectEditor = await getProjectEditor(testProjectId);
				const toolManager = await getToolManager(projectEditor, 'search_web', toolConfig);
				const tool = await toolManager.getTool('search_web');
				assert(tool, 'Failed to get tool');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'search_web',
					toolInput: {
						query: 'no results query',
					} as LLMToolSearchWebInput,
				};

				const interaction = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id');
				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isSearchWebResponse(result.bbResponse),
					'bbResponse should have the correct structure for Tool',
				);

				// Should handle empty results gracefully
				assertStringIncludes(result.toolResults as string, 'No results found');
				assertStringIncludes(result.toolResponse, 'Found 0 search results');
			});
		} finally {
			webSearchStub.restore();
		}
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Result Filter Validation',
	fn: async () => {
		await withTestProject(async (testProjectId) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor, 'search_web', {});
			const tool = await toolManager.getTool('search_web');
			assert(tool, 'Failed to get tool');

			// Test with valid filters - this will throw due to proxy 404, but we're testing validation
			const validToolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_web',
				toolInput: {
					query: 'test',
					result_filter: 'web,news,videos',
				} as LLMToolSearchWebInput,
			};

			// Should throw for proxy 404 error, but not for validation error
			const interaction1 = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id-1');
			const proxyError = await assertRejects(
				() => tool.runTool(interaction1, validToolUse, projectEditor),
				'Tool should throw error for proxy failure',
			);
			// This should be a proxy error, not a validation error
			assertStringIncludes(errorMessage(proxyError), 'Proxy search failed');

			// Test with invalid filters
			const invalidToolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_web',
				toolInput: {
					query: 'test',
					result_filter: 'invalid,web,badfilter',
				} as LLMToolSearchWebInput,
			};

			const interaction2 = await projectEditor.initInteraction('test-collaboration-id', 'test-interaction-id-2');
			const validationError = await assertRejects(
				() => tool.runTool(interaction2, invalidToolUse, projectEditor),
				'Tool should throw error for invalid filters',
			);
			assertStringIncludes(errorMessage(validationError), 'Invalid result filters');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LLMToolSearchWeb - Formatter Functions',
	fn: async () => {
		await withTestProject(async (testProjectId) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor, 'search_web', {});
			const tool = await toolManager.getTool('search_web');
			assert(tool, 'Failed to get tool');

			const testInput: LLMToolSearchWebInput = {
				query: 'formatting test',
				count: 10,
				safesearch: 'strict',
				result_filter: 'web,news',
			};

			// Test tool use formatting
			const toolUseConsole = tool.formatLogEntryToolUse(testInput, 'console');
			const toolUseBrowser = tool.formatLogEntryToolUse(testInput, 'browser');

			// Both should be objects with required properties
			assertExists(toolUseConsole.title);
			assertExists(toolUseConsole.content);
			assertExists(toolUseConsole.preview);

			assertExists(toolUseBrowser.title);
			assertExists(toolUseBrowser.content);
			assertExists(toolUseBrowser.preview);

			// Test result formatting with mock data
			const mockResultContent = {
				bbResponse: {
					data: {
						results: [
							{
								title: 'Test Result',
								url: 'https://example.com',
								description: 'Test description',
								type: 'web',
							},
						],
						summary: {
							query: { original: 'formatting test' },
							totalResults: 1,
							resultTypes: ['web'],
							searchTime: 123,
							provider: 'brave',
						},
						provider: {
							name: 'brave',
							source: 'user_key',
						},
					},
				},
				toolResults: '',
			};

			const resultConsole = tool.formatLogEntryToolResult(mockResultContent, 'console');
			const resultBrowser = tool.formatLogEntryToolResult(mockResultContent, 'browser');

			assertExists(resultConsole.title);
			assertExists(resultConsole.content);
			assertExists(resultConsole.preview);

			assertExists(resultBrowser.title);
			assertExists(resultBrowser.content);
			assertExists(resultBrowser.preview);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
