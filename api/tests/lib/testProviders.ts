/**
 * Test-specific providers that inject mock clients for testing
 */
import { NotionProvider } from 'api/dataSources/notionProvider.ts';
import { GoogleDocsProvider } from 'api/dataSources/googledocsProvider.ts';
import { NotionAccessor } from 'api/dataSources/notionAccessor.ts';
import { GoogleDocsAccessor } from 'api/dataSources/googledocsAccessor.ts';
import { MockNotionClient, MockGoogleDocsClient } from './mockClients.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';

/**
 * Test provider for Notion that injects a mock client
 */
export class TestNotionProvider extends NotionProvider {
	private mockClient: MockNotionClient;

	constructor(mockClient: MockNotionClient) {
		super();
		this.mockClient = mockClient;
	}

	/**
	 * Override createAccessor to use the mock client
	 */
	override createAccessor(connection: DataSourceConnection): ResourceAccessor {
		// Verify the connection is for this provider
		if (connection.providerType !== this.providerType) {
			throw new Error(
				`Connection provider ID mismatch: expected googledocs, got ${connection.providerType}`,
			);
		}

		// Create accessor with our mock client instead of creating a real one
		return new NotionAccessor(connection, this.mockClient);
	}

	/**
	 * Get access to the mock client for test setup and inspection
	 */
	getMockClient(): MockNotionClient {
		return this.mockClient;
	}
}

/**
 * Test provider for Google Docs that injects a mock client
 */
export class TestGoogleDocsProvider extends GoogleDocsProvider {
	private mockClient: MockGoogleDocsClient;

	constructor(mockClient: MockGoogleDocsClient) {
		super();
		this.mockClient = mockClient;
	}

	/**
	 * Override createAccessor to use the mock client
	 */
	override createAccessor(connection: DataSourceConnection): ResourceAccessor {
		// Verify the connection is for this provider
		if (connection.providerType !== this.providerType) {
			throw new Error(
				`Connection provider ID mismatch: expected ${this.providerType}, got ${connection.providerType}`,
			);
		}

		// Create accessor with our mock client instead of creating a real one
		return new GoogleDocsAccessor(connection, this.mockClient);
	}

	/**
	 * Get access to the mock client for test setup and inspection
	 */
	getMockClient(): MockGoogleDocsClient {
		return this.mockClient;
	}
}