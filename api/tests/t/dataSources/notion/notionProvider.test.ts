/**
 * Tests for the NotionProvider and NotionAccessor
 */
import { assertEquals, assertExists, assertRejects } from 'api/tests/deps.ts';
import { afterAll, beforeAll, describe, it } from '@std/testing/bdd';
import {
	//assertSpyCalls,
	type Spy,
	spy,
} from '@std/testing/mock';

import { NotionProvider } from 'api/dataSources/notionProvider.ts';
import { NotionAccessor } from '../../../../src/dataSources/notion/notionAccessor.ts';
import { NotionClient } from '../../../../src/dataSources/notion/notionClient.ts';
import { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
//import { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type { DataSourceAuth, DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

// Mock Notion client for testing
class MockNotionClient extends NotionClient {
	constructor() {
		super('mock-api-key');
	}

	// Override methods to return mock data
	override async search(): Promise<any> {
		return {
			results: [
				{
					object: 'page',
					id: 'page-123',
					created_time: '2023-01-01T00:00:00.000Z',
					last_edited_time: '2023-01-02T00:00:00.000Z',
					url: 'https://notion.so/page-123',
					properties: {
						title: {
							title: [
								{
									plain_text: 'Test Page',
								},
							],
						},
					},
				},
				{
					object: 'database',
					id: 'db-456',
					created_time: '2023-01-01T00:00:00.000Z',
					last_edited_time: '2023-01-02T00:00:00.000Z',
					url: 'https://notion.so/db-456',
					title: [
						{
							plain_text: 'Test Database',
						},
					],
				},
			],
			next_cursor: null,
			has_more: false,
		};
	}

	override async getPage(): Promise<any> {
		return {
			object: 'page',
			id: 'page-123',
			created_time: '2023-01-01T00:00:00.000Z',
			last_edited_time: '2023-01-02T00:00:00.000Z',
			url: 'https://notion.so/page-123',
			properties: {
				title: {
					title: [
						{
							plain_text: 'Test Page',
						},
					],
				},
			},
		};
	}

	override async getPageBlocks(): Promise<any> {
		return {
			results: [
				{
					type: 'paragraph',
					paragraph: {
						rich_text: [
							{
								plain_text: 'This is a test paragraph.',
							},
						],
					},
				},
			],
			next_cursor: null,
			has_more: false,
		};
	}

	override async getAllPageBlocks(): Promise<any[]> {
		return [
			{
				type: 'paragraph',
				paragraph: {
					rich_text: [
						{
							plain_text: 'This is a test paragraph.',
						},
					],
				},
			},
		];
	}

	override async getBotUser(): Promise<any> {
		return {
			object: 'bot',
			id: 'bot-123',
			name: 'bot-user',
			avatar_url: null,
			type: 'bot',
			bot: {},
		};
	}

	override async getDatabase(): Promise<any> {
		return {
			object: 'database',
			id: 'db-456',
			created_time: '2023-01-01T00:00:00.000Z',
			last_edited_time: '2023-01-02T00:00:00.000Z',
			url: 'https://notion.so/db-456',
			title: [
				{
					plain_text: 'Test Database',
				},
			],
		};
	}

	override async getAllDatabasePages(): Promise<any[]> {
		return [
			{
				object: 'page',
				id: 'page-123',
				created_time: '2023-01-01T00:00:00.000Z',
				last_edited_time: '2023-01-02T00:00:00.000Z',
				url: 'https://notion.so/page-123',
				properties: {
					title: {
						title: [
							{
								plain_text: 'Test Page',
							},
						],
					},
				},
			},
		];
	}
}

// Mock NotionClient.fromAuthConfig to return our mock client
let fromAuthConfigSpy: Spy;

describe('NotionProvider', () => {
	let provider: NotionProvider;
	let connection: DataSourceConnection;

	beforeAll(() => {
		// Replace the fromAuthConfig method with our spy
		//fromAuthConfigSpy = spy(NotionClient, 'fromAuthConfig', () => new MockNotionClient());

		// Create provider and connection
		provider = new NotionProvider();
		connection = new DataSourceConnection(
			provider,
			'Test Notion Connection',
			{ workspaceId: 'test-workspace' },
			{
				auth: {
					method: 'apiKey',
					apiKey: 'test-api-key',
				},
			},
		);
	});

	afterAll(() => {
		// Restore original method
		//fromAuthConfigSpy.restore();
	});

	it('should create a provider with correct properties', () => {
		assertEquals(provider.providerType, 'notion');
		assertEquals(provider.accessMethod, 'bb');
		assertEquals(provider.capabilities.includes('blockRead'), true);
		assertEquals(provider.capabilities.includes('blockEdit'), true);
		assertEquals(provider.capabilities.includes('list'), true);
		assertEquals(provider.capabilities.includes('search'), true);
		assertEquals(provider.capabilities.includes('write'), false);
	});

	it('should validate correct config', () => {
		const validConfig = { workspaceId: 'test-workspace' };
		assertEquals(provider.validateConfig(validConfig), true);
	});

	it('should reject invalid config', () => {
		const missingWorkspaceId = {};
		assertEquals(provider.validateConfig(missingWorkspaceId), false);

		const emptyWorkspaceId = { workspaceId: '' };
		assertEquals(provider.validateConfig(emptyWorkspaceId), false);

		const invalidWorkspaceId = { workspaceId: 123 };
		assertEquals(provider.validateConfig(invalidWorkspaceId), false);
	});

	it('should validate correct auth config', () => {
		const validAuth = { method: 'apiKey', apiKey: 'test-key' } as DataSourceAuth;
		assertEquals(provider.validateAuth(validAuth), true);
	});

	it('should reject invalid auth config', () => {
		const missingAuth = undefined as unknown as DataSourceAuth;
		assertEquals(provider.validateAuth(missingAuth), false);

		const wrongMethod = { method: 'oauth1' } as unknown as DataSourceAuth;
		assertEquals(provider.validateAuth(wrongMethod), false);

		const missingApiKey = { method: 'apiKey' } as DataSourceAuth;
		assertEquals(provider.validateAuth(missingApiKey), false);
	});

	it('should create an accessor with valid connection', () => {
		const accessor = provider.createAccessor(connection);
		assertExists(accessor);
		assertEquals(accessor instanceof NotionAccessor, true);
	});

	it('should reject connections with invalid provider ID', () => {
		const wrongConnection = new DataSourceConnection(
			'wrong-provider' as unknown as NotionProvider,
			'Wrong Connection',
			{ workspaceId: 'test-workspace' },
			{
				auth: {
					method: 'apiKey',
					apiKey: 'test-api-key',
				},
			},
		);

		assertRejects(
			async () => provider.createAccessor(wrongConnection),
			Error,
			'Connection provider ID mismatch',
		);
	});

	it('should create a Notion data source with the factory method', () => {
		// Create a mock registry
		const mockRegistry = {
			createConnection: (
				providerType: DataSourceProviderType,
				name: string,
				config: Record<string, unknown>,
				options?: {
					id?: string;
					enabled?: boolean;
					isPrimary?: boolean;
					priority?: number;
					auth?: DataSourceAuth;
					projectConfig?: ProjectConfig;
				},
			) => new DataSourceConnection(provider, name, config, options),
			getProvider: (providerType: DataSourceProviderType, accessMethod: 'bb' | 'mcp') => provider,
		} as unknown as DataSourceRegistry;

		const notionDataSource = NotionProvider.createNotionDataSource(
			'Test Notion',
			'workspace-123',
			'api-key-456',
			mockRegistry,
		);

		assertExists(notionDataSource);
		assertEquals(notionDataSource.providerType, 'notion');
		assertEquals(notionDataSource.name, 'Test Notion');
		assertEquals(notionDataSource.config.workspaceId, 'workspace-123');
		assertExists(notionDataSource.auth);
		assertEquals(notionDataSource.auth?.method, 'apiKey');
		assertEquals(notionDataSource.auth?.apiKey, 'api-key-456');
	});
});

describe('NotionAccessor', () => {
	let provider: NotionProvider;
	let connection: DataSourceConnection;
	let accessor: NotionAccessor;

	beforeAll(() => {
		// Replace the fromAuthConfig method with our spy
		//fromAuthConfigSpy = spy(NotionClient, 'fromAuthConfig', () => new MockNotionClient());

		// Create connection
		// Create provider and connection
		provider = new NotionProvider();
		const connection = new DataSourceConnection(
			provider,
			'Test Notion Connection',
			{ workspaceId: 'test-workspace' },
			{
				auth: {
					method: 'apiKey',
					apiKey: 'test-api-key',
				},
			},
		);

		// Create accessor directly with mock client
		accessor = new NotionAccessor(connection, new MockNotionClient());
	});

	afterAll(() => {
		// Restore original method
		//fromAuthConfigSpy.restore();
	});

	it('should have correct capabilities', () => {
		assertEquals(accessor.hasCapability('blockRead'), true);
		assertEquals(accessor.hasCapability('blockEdit'), true);
		assertEquals(accessor.hasCapability('search'), true);
		assertEquals(accessor.hasCapability('write'), false);
	});

	it('should load a page resource', async () => {
		const result = await accessor.loadResource('bb+notion+test-notion-connection+file:./page/page-123');

		assertExists(result);
		assertExists(result.content);
		assertExists(result.metadata);

		// Content should be markdown with the page title and paragraph
		const content = result.content as string;
		assertEquals(content.includes('# Test Page'), true);
		assertEquals(content.includes('This is a test paragraph.'), true);

		// Metadata should have the correct properties
		assertEquals(result.metadata.type, 'page');
		assertEquals(result.metadata.mimeType, 'text/markdown');
		assertEquals(result.metadata.contentType, 'text');
	});

	it('should load a database resource', async () => {
		const result = await accessor.loadResource('bb+notion+test-notion-connection+file:./database/db-456');

		assertExists(result);
		assertExists(result.content);
		assertExists(result.metadata);

		// Content should be markdown with the database title and page list
		const content = result.content as string;
		assertEquals(content.includes('# Test Database'), true);
		assertEquals(content.includes('## Pages'), true);
		assertEquals(content.includes('Test Page'), true);

		// Metadata should have the correct properties
		assertEquals(result.metadata.type, 'database');
		assertEquals(result.metadata.mimeType, 'text/markdown');
		assertEquals(result.metadata.contentType, 'text');
	});

	it('should load a workspace resource', async () => {
		const result = await accessor.loadResource('bb+notion+test-notion-connection+file:./workspace/test-workspace');

		assertExists(result);
		assertExists(result.content);
		assertExists(result.metadata);

		// Content should be markdown with workspace information and lists of pages and databases
		const content = result.content as string;
		assertEquals(content.includes('# Notion Workspace'), true);
		assertEquals(content.includes('## Databases'), true);
		assertEquals(content.includes('## Pages'), true);
		assertEquals(content.includes('Test Database'), true);
		assertEquals(content.includes('Test Page'), true);

		// Metadata should have the correct properties
		assertEquals(result.metadata.type, 'workspace');
		assertEquals(result.metadata.mimeType, 'text/markdown');
		assertEquals(result.metadata.contentType, 'text');
	});

	it('should reject invalid resource URIs', async () => {
		await assertRejects(
			() => accessor.loadResource('bb+notion+test-notion-connection+file:./invalid/format'),
			Error,
			'Invalid Notion resource URI',
		);
	});

	it('should list resources', async () => {
		const result = await accessor.listResources();

		assertExists(result);
		assertExists(result.resources);
		assertEquals(result.resources.length >= 3, true); // Workspace + page + database

		// Should include workspace, page, and database
		const workspace = result.resources.find((r) => r.uri.includes('workspace/'));
		assertExists(workspace);
		assertEquals(workspace.type, 'workspace');

		const page = result.resources.find((r) => r.uri.includes('page/'));
		assertExists(page);
		assertEquals(page.type, 'page');

		const database = result.resources.find((r) => r.uri.includes('database/'));
		assertExists(database);
		assertEquals(database.type, 'database');
	});

	it('should search resources', async () => {
		const result = await accessor.searchResources('test');

		assertExists(result);
		assertExists(result.matches);
		assertEquals(result.matches.length >= 2, true); // Page + database

		// Should include page and database matches
		const pageMatch = result.matches.find((m) => m.resource.uri.includes('page/'));
		assertExists(pageMatch);
		assertEquals(pageMatch.resource.type, 'page');

		const dbMatch = result.matches.find((m) => m.resource.uri.includes('database/'));
		assertExists(dbMatch);
		assertEquals(dbMatch.resource.type, 'database');
	});
});
