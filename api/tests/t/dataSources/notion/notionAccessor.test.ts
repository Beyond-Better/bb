/**
 * Tests for NotionAccessor Portable Text methods
 */
import { assertEquals, assertRejects } from '@std/assert';
//import { stub, returnsNext } from '@std/testing/mock';
import { NotionAccessor } from 'api/dataSources/notionAccessor.ts';
import type { NotionBlock, NotionClient, NotionPage } from 'api/dataSources/notionClient.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { DataSourceAccessMethod } from 'shared/types/dataSource.ts';
import type {
	PortableTextOperation,
	//PortableTextOperationResult
} from 'api/types/portableText.ts';
import { generatePortableTextKey } from 'api/dataSources/notion/portableTextConverter.ts';

// Mock Notion client
class MockNotionClient implements Partial<NotionClient> {
	private pages: Map<string, NotionPage> = new Map();
	private blocks: Map<string, NotionBlock[]> = new Map();

	// Add methods to set up test data
	setPage(pageId: string, page: NotionPage) {
		this.pages.set(pageId, page);
	}

	setBlocks(pageId: string, blocks: NotionBlock[]) {
		this.blocks.set(pageId, blocks);
	}

	async getPage(pageId: string): Promise<NotionPage> {
		const page = this.pages.get(pageId);
		if (!page) {
			throw new Error(`Page ${pageId} not found`);
		}
		return page;
	}

	async getAllPageBlocks(pageId: string): Promise<NotionBlock[]> {
		return this.blocks.get(pageId) || [];
	}

	async deleteBlock(blockId: string): Promise<NotionBlock> {
		// Mock implementation - remove block from all pages
		for (const [_, blocks] of this.blocks) {
			const index = blocks.findIndex((b) => b.id === blockId);
			if (index !== -1) {
				const deletedBlock = blocks[index];
				blocks.splice(index, 1);
				return deletedBlock;
			}
		}
		return {} as NotionBlock;
	}

	async appendBlockChildren(
		pageId: string,
		blocks: Partial<NotionBlock>[],
	): Promise<{ object: string; results: NotionBlock[] }> {
		const existingBlocks = this.blocks.get(pageId) || [];
		const newBlocks = blocks.map((block, index) => ({
			object: 'block' as const,
			id: `new-block-${Date.now()}-${index}`,
			type: block.type || 'paragraph',
			created_time: new Date().toISOString(),
			last_edited_time: new Date().toISOString(),
			...block,
		})) as NotionBlock[];

		existingBlocks.push(...newBlocks);
		this.blocks.set(pageId, existingBlocks);
		return { object: '', results: newBlocks };
	}
}

// Mock DataSourceConnection
class MockDataSourceConnection implements Partial<DataSourceConnection> {
	id = 'test-connection';
	name = 'Test Connection';
	config = { workspaceId: 'test-workspace' };
	accessMethod = 'bb' as DataSourceAccessMethod;

	async isResourceWithinDataSource(_resourceUri: string): Promise<boolean> {
		return true;
	}

	getUriForResource(resourcePath: string): string {
		return `bb+notion+test-connection+notion://${resourcePath}`;
	}
}

// Helper function to create test blocks
function createTestBlock(id: string, type: string, content: string): NotionBlock {
	const block: NotionBlock = {
		object: 'block',
		id,
		// deno-lint-ignore no-explicit-any
		type: type as any,
		created_time: '2025-01-01T00:00:00.000Z',
		last_edited_time: '2025-01-01T00:00:00.000Z',
	};

	// Add type-specific properties
	switch (type) {
		case 'paragraph':
			// deno-lint-ignore no-explicit-any
			(block as any).paragraph = {
				rich_text: [{
					type: 'text',
					text: { content },
					plain_text: content,
					annotations: {
						bold: false,
						italic: false,
						strikethrough: false,
						underline: false,
						code: false,
						color: 'default',
					},
				}],
			};
			break;
		case 'heading_1':
			// deno-lint-ignore no-explicit-any
			(block as any).heading_1 = {
				rich_text: [{
					type: 'text',
					text: { content },
					plain_text: content,
					annotations: {
						bold: false,
						italic: false,
						strikethrough: false,
						underline: false,
						code: false,
						color: 'default',
					},
				}],
			};
			break;
	}

	return block;
}

// Helper function to create test page
function createTestPage(pageId: string, title: string): NotionPage {
	return {
		object: 'page',
		id: pageId,
		created_time: '2025-01-01T00:00:00.000Z',
		last_edited_time: '2025-01-01T00:00:00.000Z',
		properties: {
			title: {
				id: 'title',
				type: 'title',
				title: [{
					type: 'text',
					text: { content: title },
					plain_text: title,
					annotations: {
						bold: false,
						italic: false,
						strikethrough: false,
						underline: false,
						code: false,
						color: 'default',
					},
				}],
			},
		},
		parent: { type: 'workspace', workspace: true },
	} as NotionPage;
}

Deno.test({
	name: 'NotionAccessor.getDocumentAsPortableText - success',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
			createTestBlock('block2', 'heading_1', 'Main Title'),
			createTestBlock('block3', 'paragraph', 'Second paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const result = await accessor.getDocumentAsPortableText(`bb+notion+test-connection+notion://page/${pageId}`);

		assertEquals(result.length, 3);
		assertEquals(result[0]._type, 'block');
		assertEquals(result[0].style, 'normal');
		assertEquals(result[0].children![0].text, 'First paragraph');
		assertEquals(result[1]._type, 'block');
		assertEquals(result[1].style, 'h1');
		assertEquals(result[1].children![0].text, 'Main Title');
		assertEquals(result[2]._type, 'block');
		assertEquals(result[2].style, 'normal');
		assertEquals(result[2].children![0].text, 'Second paragraph');
	},
});

Deno.test({
	name: 'NotionAccessor.getDocumentAsPortableText - invalid URI',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		await assertRejects(
			() => accessor.getDocumentAsPortableText('bb+notion+test-connection+notion://invalid/resource'),
			Error,
			'Invalid or unsupported resource URI',
		);
	},
});

Deno.test({
	name: 'NotionAccessor.getDocumentAsPortableText - non-page resource',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		await assertRejects(
			() => accessor.getDocumentAsPortableText('bb+notion+test-connection+notion://database/test-db-id'),
			Error,
			'Invalid or unsupported resource URI',
		);
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - update operation success',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'Original content'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'update',
			index: 0,
			content: {
				_type: 'block',
				_key: 'block1',
				style: 'normal',
				children: [{
					_type: 'span',
					_key: generatePortableTextKey('span'),
					text: 'Updated content',
				}],
			},
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, true);
		assertEquals(results[0].type, 'update');
		assertEquals(results[0].operationIndex, 0);
		assertEquals(results[0].message, 'Updated block at index 0');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - insert operation success',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'insert',
			position: 1,
			block: {
				_type: 'block',
				_key: generatePortableTextKey(),
				style: 'normal',
				children: [{
					_type: 'span',
					_key: generatePortableTextKey('span'),
					text: 'Inserted content',
				}],
			},
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, true);
		assertEquals(results[0].type, 'insert');
		assertEquals(results[0].operationIndex, 0);
		assertEquals(results[0].message, 'Inserted block at position 1');
		assertEquals(results[0].newIndex, 1);
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - delete operation success',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
			createTestBlock('block2', 'paragraph', 'Second paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'delete',
			index: 0,
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, true);
		assertEquals(results[0].type, 'delete');
		assertEquals(results[0].operationIndex, 0);
		assertEquals(results[0].message, 'Deleted block at index 0');
		assertEquals(results[0].originalIndex, 0);
		assertEquals(results[0].affectedKey, 'block1');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - move operation success',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
			createTestBlock('block2', 'paragraph', 'Second paragraph'),
			createTestBlock('block3', 'paragraph', 'Third paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'move',
			from: 0,
			to: 2,
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, true);
		assertEquals(results[0].type, 'move');
		assertEquals(results[0].operationIndex, 0);
		assertEquals(results[0].originalIndex, 0);
		assertEquals(results[0].newIndex, 1); // Adjusted for removal
		assertEquals(results[0].affectedKey, 'block1');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - operation by key',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
			createTestBlock('block2', 'paragraph', 'Second paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'delete',
			_key: 'block2',
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, true);
		assertEquals(results[0].type, 'delete');
		assertEquals(results[0].affectedKey, 'block2');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - multiple operations',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [
			{
				type: 'update',
				index: 0,
				content: {
					_type: 'block',
					_key: 'block1',
					style: 'h1',
					children: [{
						_type: 'span',
						_key: generatePortableTextKey('span'),
						text: 'Updated to heading',
					}],
				},
			},
			{
				type: 'insert',
				position: 1,
				block: {
					_type: 'block',
					_key: generatePortableTextKey(),
					style: 'normal',
					children: [{
						_type: 'span',
						_key: generatePortableTextKey('span'),
						text: 'New paragraph',
					}],
				},
			},
		];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 2);
		assertEquals(results[0].success, true);
		assertEquals(results[0].type, 'update');
		assertEquals(results[1].success, true);
		assertEquals(results[1].type, 'insert');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - invalid operation type',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			// deno-lint-ignore no-explicit-any
			type: 'invalid' as any,
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, false);
		assertEquals(results[0].message, 'Unsupported operation type: invalid');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - update operation missing content',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'update',
			index: 0,
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, false);
		assertEquals(results[0].message, 'Update operation requires content');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - insert operation missing block',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'insert',
			position: 1,
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, false);
		assertEquals(results[0].message, 'Insert operation requires block');
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - block not found',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'update',
			index: 5,
			content: {
				_type: 'block',
				_key: 'block1',
				style: 'normal',
				children: [],
			},
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, false);
		assertEquals(results[0].message.includes('Block not found'), true);
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - invalid position',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [{
			type: 'insert',
			position: 10,
			block: {
				_type: 'block',
				_key: generatePortableTextKey(),
				style: 'normal',
				children: [{
					_type: 'span',
					_key: generatePortableTextKey('span'),
					text: 'New content',
				}],
			},
		}];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 1);
		assertEquals(results[0].success, false);
		assertEquals(results[0].message.includes('Invalid insert position'), true);
	},
});

Deno.test({
	name: 'NotionAccessor.applyPortableTextOperations - no successful operations',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: async () => {
		const mockClient = new MockNotionClient();
		const mockConnection = new MockDataSourceConnection();

		const pageId = 'test-page-id';
		const testPage = createTestPage(pageId, 'Test Page');
		const testBlocks = [
			createTestBlock('block1', 'paragraph', 'First paragraph'),
		];

		mockClient.setPage(pageId, testPage);
		mockClient.setBlocks(pageId, testBlocks);

		const accessor = new NotionAccessor(
			mockConnection as unknown as DataSourceConnection,
			mockClient as unknown as NotionClient,
		);

		const operations: PortableTextOperation[] = [
			{ type: 'update', index: 10 }, // Invalid index
			{ type: 'delete', _key: 'nonexistent' }, // Nonexistent key
		];

		const results = await accessor.applyPortableTextOperations(
			`bb+notion+test-connection+notion://page/${pageId}`,
			operations,
		);

		assertEquals(results.length, 2);
		assertEquals(results[0].success, false);
		assertEquals(results[1].success, false);
	},
});
