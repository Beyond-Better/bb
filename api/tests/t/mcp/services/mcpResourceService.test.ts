/**
 * Tests for MCPResourceService
 *
 * Tests the resource-related functionality extracted from MCPManager to ensure
 * proper resource listing and loading operations.
 */

import { assert, assertEquals, assertRejects } from '@std/assert';
import { MCPResourceService } from 'api/mcp/services/mcpResourceService.ts';
import type { McpServerInfo } from 'api/types/mcp.ts';
import type { MCPServerConfig } from 'shared/config/types.ts';
import type { ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { MCPConnectionService } from 'api/mcp/connection/mcpConnectionService.ts';

// Mock server configuration
function createMockServerConfig(serverId: string): MCPServerConfig {
	return {
		id: serverId,
		name: `Test Server ${serverId}`,
		url: 'https://example.com/mcp',
		transport: 'http',
	};
}

// Mock MCP client with resource operations
function createMockMCPClient(resources?: any[], shouldThrow = false, throwCode?: number) {
	return {
		listResources: async () => {
			if (shouldThrow) {
				// Special case for "Method not found" error (code -32601)
				if (throwCode === -32601) {
					const error = new Error('MCP error -32601: Method not found') as any;
					error.code = -32601;
					throw error;
				}
				throw new Error('MCP client error');
			}
			return {
				resources: resources || [
					{
						uri: 'file://test-resource-1.txt',
						name: 'Test Resource 1',
						description: 'First test resource',
						mimeType: 'text/plain',
					},
					{
						uri: 'file://test-image.png',
						name: 'Test Image',
						description: 'Test image resource',
						mimeType: 'image/png',
					},
				],
			};
		},
		readResource: async ({ uri }: { uri: string }) => {
			if (shouldThrow) {
				throw new Error('Resource loading failed');
			}
			return {
				uri,
				mimeType: 'text/plain',
				text: `Content of resource: ${uri}`,
			};
		},
		close: async () => {},
	};
}

// Mock server info
function createMockServerInfo(
	serverId: string,
	resources?: any[],
	shouldThrowResources = false,
	throwCode?: number,
): McpServerInfo {
	return {
		server: createMockMCPClient(resources, shouldThrowResources, throwCode),
		config: createMockServerConfig(serverId),
		capabilities: ['read', 'list'],
		connectionState: 'connected',
		reconnectAttempts: 0,
		maxReconnectAttempts: 5,
		reconnectDelay: 1000,
		resources: undefined, // Will be populated during tests
	} as unknown as McpServerInfo;
}

// Mock connection service
function createMockConnectionService(serverAvailability: Map<string, boolean> = new Map()): MCPConnectionService {
	return {
		isServerAvailable: async (serverId: string) => {
			return serverAvailability.get(serverId) ?? true; // Default to available
		},
		recordActivity: (serverId: string) => {
			// Mock: do nothing
		},
		isSessionError: (error: Error) => {
			return false; // Mock: no session errors in tests
		},
		isAuthError: (error: Error) => {
			return false; // Mock: no auth errors in tests
		},
		forceReconnect: async (serverId: string) => {
			// Mock: do nothing
		},
	} as MCPConnectionService;
}

Deno.test({
	name: 'MCPResourceService - listResources - Returns cached resources when available',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');

		// Pre-populate cache
		serverInfo.resources = [
			{
				uri: 'file://cached-resource.txt',
				name: 'Cached Resource',
				type: 'mcp',
				contentType: 'text',
				mimeType: 'text/plain',
				lastModified: new Date(),
			} as ResourceMetadata,
		];
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test cached resources
		const resources = await resourceService.listResources('test-server-1');

		assertEquals(resources.length, 1);
		assertEquals(resources[0].uri, 'file://cached-resource.txt');
		assertEquals(resources[0].name, 'Cached Resource');
	},
});

Deno.test({
	name: 'MCPResourceService - listResources - Fetches and caches resources when not cached',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test fresh resource fetch
		const resources = await resourceService.listResources('test-server-1');

		assertEquals(resources.length, 2);

		// Verify text resource
		const textResource = resources[0];
		assertEquals(textResource.uri, 'file://test-resource-1.txt');
		assertEquals(textResource.name, 'Test Resource 1');
		assertEquals(textResource.type, 'mcp');
		assertEquals(textResource.contentType, 'text');
		assertEquals(textResource.mimeType, 'text/plain');

		// Verify image resource (should be detected as image)
		const imageResource = resources[1];
		assertEquals(imageResource.uri, 'file://test-image.png');
		assertEquals(imageResource.name, 'Test Image');
		assertEquals(imageResource.contentType, 'image');
		assertEquals(imageResource.mimeType, 'image/png');

		// Verify resources were cached
		const cachedServerInfo = servers.get('test-server-1')!;
		assert(cachedServerInfo.resources);
		assertEquals(cachedServerInfo.resources.length, 2);
	},
});

Deno.test({
	name: 'MCPResourceService - listResources - Server not found error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test with non-existent server
		await assertRejects(
			async () => {
				await resourceService.listResources('non-existent-server');
			},
			Error,
			'MCP server non-existent-server not found',
		);
	},
});

Deno.test({
	name: 'MCPResourceService - listResources - Server unavailable error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		// Mock server as unavailable
		const serverAvailability = new Map([['test-server-1', false]]);
		const connectionService = createMockConnectionService(serverAvailability);
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test server unavailable
		await assertRejects(
			async () => {
				await resourceService.listResources('test-server-1');
			},
			Error,
			'MCP server test-server-1 is not available',
		);
	},
});

Deno.test({
	name: 'MCPResourceService - listResources - Method not found returns empty array',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		// Server throws "Method not found" error (code -32601)
		const serverInfo = createMockServerInfo('slack-server', [], true, -32601);
		servers.set('slack-server', serverInfo);

		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test method not supported (should return empty array)
		const resources = await resourceService.listResources('slack-server');

		assertEquals(resources.length, 0);
	},
});

Deno.test({
	name: 'MCPResourceService - listResources - MCP client error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1', [], true); // shouldThrow = true
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test MCP client error
		await assertRejects(
			async () => {
				await resourceService.listResources('test-server-1');
			},
			Error,
			'Failed to list MCP resources: MCP client error',
		);
	},
});

Deno.test({
	name: 'MCPResourceService - loadResource - Successful resource loading',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test resource loading
		const resourceUri = 'file://test-document.txt';
		const result = await resourceService.loadResource('test-server-1', resourceUri);

		assertEquals(result.uri, resourceUri);
		assertEquals(result.mimeType, 'text/plain');
		assertEquals(result.text, `Content of resource: ${resourceUri}`);
	},
});

Deno.test({
	name: 'MCPResourceService - loadResource - Server not found error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test with non-existent server
		await assertRejects(
			async () => {
				await resourceService.loadResource('non-existent-server', 'file://test.txt');
			},
			Error,
			'MCP server non-existent-server not found',
		);
	},
});

Deno.test({
	name: 'MCPResourceService - loadResource - Server unavailable error',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		// Mock server as unavailable
		const serverAvailability = new Map([['test-server-1', false]]);
		const connectionService = createMockConnectionService(serverAvailability);
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test server unavailable
		await assertRejects(
			async () => {
				await resourceService.loadResource('test-server-1', 'file://test.txt');
			},
			Error,
			'MCP server test-server-1 is not available',
		);
	},
});

Deno.test({
	name: 'MCPResourceService - loadResource - Resource loading failure',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1', [], true); // shouldThrow = true
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test resource loading failure
		await assertRejects(
			async () => {
				await resourceService.loadResource('test-server-1', 'file://failing-resource.txt');
			},
			Error,
			'Failed to load MCP resource: Resource loading failed',
		);
	},
});

Deno.test({
	name: 'MCPResourceService - Resource metadata transformation - Text and image types',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();

		// Create server with mixed resource types
		const mixedResources = [
			{
				uri: 'file://document.txt',
				name: 'Text Document',
				mimeType: 'text/plain',
			},
			{
				uri: 'file://photo.jpg',
				name: 'Photo',
				mimeType: 'image/jpeg',
			},
			{
				uri: 'file://data.json',
				name: 'JSON Data',
				mimeType: 'application/json',
			},
			{
				uri: 'file://no-mime-type',
				name: 'No MIME Type',
				// No mimeType property
			},
		];

		const serverInfo = createMockServerInfo('test-server-1', mixedResources);
		servers.set('test-server-1', serverInfo);

		const connectionService = createMockConnectionService();
		const resourceService = new MCPResourceService(servers, connectionService);

		// Test resource metadata transformation
		const resources = await resourceService.listResources('test-server-1');

		assertEquals(resources.length, 4);

		// Text resource
		const textDoc = resources[0];
		assertEquals(textDoc.contentType, 'text');
		assertEquals(textDoc.mimeType, 'text/plain');
		assertEquals(textDoc.type, 'mcp');

		// Image resource
		const photo = resources[1];
		assertEquals(photo.contentType, 'image');
		assertEquals(photo.mimeType, 'image/jpeg');

		// JSON resource (not image, so should be 'text')
		const jsonData = resources[2];
		assertEquals(jsonData.contentType, 'text');
		assertEquals(jsonData.mimeType, 'application/json');

		// No MIME type resource (should default to 'text/plain')
		const noMimeType = resources[3];
		assertEquals(noMimeType.contentType, 'text');
		assertEquals(noMimeType.mimeType, 'text/plain');

		// All should have lastModified date
		resources.forEach((resource) => {
			assert(resource.lastModified);
			assert(resource.lastModified instanceof Date);
		});
	},
});
