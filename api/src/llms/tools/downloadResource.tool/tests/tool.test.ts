import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getTestFilePath,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import { ResourceHandlingError, ToolHandlingError } from 'api/errors/error.ts';
import type { LLMToolDownloadResourceResultData } from '../types.ts';

// Type guard function
function isDownloadResourceResponse(
	response: unknown,
): response is { data: LLMToolDownloadResourceResultData } {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'url' in data &&
		typeof data.url === 'string' &&
		'resourcePath' in data &&
		typeof data.resourcePath === 'string' &&
		'bytesDownloaded' in data &&
		typeof data.bytesDownloaded === 'number' &&
		'isNewResource' in data &&
		typeof data.isNewResource === 'boolean'
	);
}

// Type guard to check if toolResults is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

// Mock fetch for testing
let originalFetch: typeof globalThis.fetch;
type MockMatcher = {
	baseUrl: string;
	requiredParams?: Record<string, string>;
	response: Response;
};

let mockMatchers: MockMatcher[] = [];

function setupMockFetch() {
	originalFetch = globalThis.fetch;
	globalThis.fetch = async (input: string | Request | URL, init?: RequestInit): Promise<Response> => {
		const url = typeof input === 'string' ? input : input.toString();
		console.log('setupMockFetch - url:', url);
		console.log('setupMockFetch - mockMatchers:', mockMatchers);
		const parsedUrl = new URL(url);

		// Check matchers first
		for (const matcher of mockMatchers) {
			if (urlMatches(parsedUrl, matcher)) {
				return matcher.response.clone(); // Clone to avoid stream consumption issues
			}
		}

		// Default successful text response
		if (url.includes('success-text')) {
			return new Response('Hello from downloaded resource!', {
				status: 200,
				headers: { 'content-type': 'text/plain', 'content-length': '31' },
			});
		}

		// JSON response
		if (url.includes('success-json')) {
			const jsonData = { message: 'Hello JSON', data: [1, 2, 3] };
			return new Response(JSON.stringify(jsonData), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}

		// Binary response (simulate small image)
		if (url.includes('success-binary')) {
			const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
			return new Response(binaryData, {
				status: 200,
				headers: { 'content-type': 'image/png', 'content-length': '8' },
			});
		}

		// Error responses
		if (url.includes('error-404')) {
			return new Response('Not Found', { status: 404 });
		}

		if (url.includes('error-timeout')) {
			// Simulate timeout
			throw new Error('Request timeout');
		}

		// Default fallback
		return new Response('Default response', {
			status: 200,
			headers: { 'content-type': 'text/plain' },
		});
	};
}
function urlMatches(url: URL, matcher: MockMatcher): boolean {
	const matcherUrl = new URL(matcher.baseUrl);

	if (url.origin !== matcherUrl.origin || url.pathname !== matcherUrl.pathname) {
		return false;
	}

	if (matcher.requiredParams) {
		return Object.entries(matcher.requiredParams)
			.every(([key, value]) => url.searchParams.get(key) === value);
	}

	return true;
}

function addMockResponse(baseUrl: string, response: Response, requiredParams?: Record<string, string>) {
	mockMatchers.push({ baseUrl, requiredParams, response });
}
function clearMockMatchers() {
	mockMatchers.length = 0;
}

function restoreFetch() {
	globalThis.fetch = originalFetch;
	clearMockMatchers();
}

Deno.test({
	name: 'Download Resource Tool - download simple text file',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResource = 'downloaded-text.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://example.com/success-text',
						resourcePath: testResource,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert(
					isDownloadResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure for DownloadResource',
				);

				if (isDownloadResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.resourcePath,
						testResource,
						`Test response resourcePath should be "${testResource}"`,
					);
					assertEquals(
						result.bbResponse.data.url,
						'https://example.com/success-text',
						'Test response url should match input',
					);
					assertEquals(
						result.bbResponse.data.isNewResource,
						true,
						'Test response isNewResource should be true',
					);
					assertEquals(
						result.bbResponse.data.bytesDownloaded,
						31,
						'Test response bytesDownloaded should be 31',
					);
				}

				assertStringIncludes(result.toolResponse, 'Downloaded');
				if (isString(result.toolResults)) {
					assertStringIncludes(result.toolResults, 'Downloaded GET https://example.com/success-text');
				}

				// Verify file was actually created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Hello from downloaded resource!');
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - download JSON with custom headers',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResource = 'data.json';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://api.example.com/success-json',
						resourcePath: testResource,
						headers: {
							'Accept': 'application/json',
							'User-Agent': 'BB-Tool/1.0',
						},
						includeInMessages: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isDownloadResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isDownloadResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.response.contentTypeInfo.contentType,
						'text',
						'JSON should be detected as text content',
					);
					// Should include content in conversation
					assert(
						result.bbResponse.data.conversationContent,
						'Should include conversation content',
					);
				}

				// Verify file was created with JSON content
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				const parsedJson = JSON.parse(content);
				assertEquals(parsedJson.message, 'Hello JSON');
				assertEquals(parsedJson.data, [1, 2, 3]);
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - download binary content',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResource = 'image.png';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://images.example.com/success-binary',
						resourcePath: testResource,
						includeInMessages: true, // Should not include binary in messages
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isDownloadResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isDownloadResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.response.contentTypeInfo.contentType,
						'image',
						'PNG should be detected as image content',
					);
					assertEquals(
						result.bbResponse.data.bytesDownloaded,
						8,
						'Should download 8 bytes',
					);
					// Should NOT include binary content in conversation
					assertEquals(
						result.bbResponse.data.conversationContent,
						undefined,
						'Should not include binary content in conversation',
					);
				}

				// Verify binary file was created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readFile(testResourcePath);
				assertEquals(content.length, 8);
				assertEquals(content[0], 0x89); // PNG signature
				assertEquals(content[1], 0x50);
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - POST request with authentication',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			// Mock a POST endpoint
			addMockResponse(
				'https://api.example.com/data',
				new Response('POST response data', { status: 200, headers: { 'content-type': 'text/plain' } }),
				{ format: 'json', version: 'v1' },
			);
			try {
				const testResource = 'post-data.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://api.example.com/data',
						method: 'POST',
						resourcePath: testResource,
						auth: {
							type: 'bearer',
							token: 'secret-bearer-token',
						},
						requestBody: {
							content: JSON.stringify({ query: 'test data' }),
							contentType: 'application/json',
						},
						queryParams: {
							format: 'json',
							version: 'v1',
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isDownloadResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isDownloadResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.method,
						'POST',
						'Should record POST method',
					);
				}

				// Verify file was created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'POST response data');
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - overwrite existing file',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResource = 'overwrite-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				// Create existing file
				await Deno.writeTextFile(testResourcePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://example.com/success-text',
						resourcePath: testResource,
						overwriteExisting: true,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isDownloadResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isDownloadResourceResponse(result.bbResponse)) {
					assertEquals(
						result.bbResponse.data.isNewResource,
						false,
						'Should not be a new resource',
					);
				}

				assertStringIncludes(result.toolResponse, 'Downloaded and overwrote');

				// Verify file was overwritten
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Hello from downloaded resource!');
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - fail when file exists and overwrite is false',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResource = 'existing-file.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				// Create existing file
				await Deno.writeTextFile(testResourcePath, 'Original content');

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://example.com/success-text',
						resourcePath: testResource,
						overwriteExisting: false, // Default behavior
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
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - HTTP error response',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResource = 'error-test.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://example.com/error-404',
						resourcePath: testResource,
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					'HTTP 404',
				);
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - content type mismatch warning',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			// Mock response with mismatched content type
			addMockResponse(
				'https://example.com/mismatch',
				new Response('This is actually text', {
					status: 200,
					headers: { 'content-type': 'image/png' }, // Wrong type!
				}),
			);

			try {
				const testResource = 'data.txt'; // Text extension but will get image type
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://example.com/mismatch',
						resourcePath: testResource,
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isDownloadResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				if (isDownloadResourceResponse(result.bbResponse)) {
					// Should have a warning about content type mismatch
					assert(
						result.bbResponse.data.response.contentTypeInfo.warningMessage,
						'Should have content type warning',
					);
					assertStringIncludes(
						result.bbResponse.data.response.contentTypeInfo.warningMessage!,
						'Content type mismatch',
					);
				}

				// Should still download the file
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'This is actually text');
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - throw error for resource outside project',
	async fn() {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResourcePath = '/tmp/outside_project.txt';

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://example.com/success-text',
						resourcePath: testResourcePath,
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					ResourceHandlingError,
					`Access denied: ${testResourcePath} is outside the data source directory`,
				);
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'Download Resource Tool - API key authentication as query parameter',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction(
				'test-collaboration',
				'test-interaction',
				projectEditor,
			);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('download_resource');
			assert(tool, 'Failed to get tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			setupMockFetch();
			try {
				const testResource = 'api-key-test.txt';
				const testResourcePath = getTestFilePath(testProjectRoot, testResource);

				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'download_resource',
					toolInput: {
						url: 'https://api.example.com/success-text',
						resourcePath: testResource,
						auth: {
							type: 'apikey',
							token: 'my-api-key-123',
							useQueryParam: true,
							queryParamName: 'key',
						},
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(
					isDownloadResourceResponse(result.bbResponse),
					'bbResponse should have the correct structure',
				);

				// Verify file was created
				assert(await Deno.stat(testResourcePath));
				const content = await Deno.readTextFile(testResourcePath);
				assertEquals(content, 'Hello from downloaded resource!');

				// The final URL should include the API key as query parameter
				if (isDownloadResourceResponse(result.bbResponse)) {
					assertStringIncludes(
						result.bbResponse.data.response.finalUrl,
						'key=my-api-key-123',
					);
				}
			} finally {
				logChangeAndCommitStub.restore();
				restoreFetch();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
