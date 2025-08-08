import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from '../formatter.console.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from '../formatter.browser.tsx';
import type { LLMToolEditResourceInput } from '../types.ts';

/**
 * Formatter tests for EditResource tool
 * Tests both console and browser formatters for tool use and results
 */

Deno.test({
	name: 'EditResourceTool - Console Formatter - Search and replace tool use',
	fn: () => {
		const toolInput: LLMToolEditResourceInput = {
			resourcePath: 'src/test.ts',
			createIfMissing: true,
			operations: [
				{
					editType: 'searchReplace',
					searchReplace_search: 'old.*pattern',
					searchReplace_replace: 'new replacement',
					searchReplace_replaceAll: true,
					searchReplace_regexPattern: true,
					searchReplace_caseSensitive: false,
				},
				{
					editType: 'searchReplace',
					searchReplace_search: 'literal text',
					searchReplace_replace: 'updated text',
				},
			],
		};

		const result = formatLogEntryToolUseConsole(toolInput);

		// Check title, subtitle, and content are strings (console formatter)
		assert(typeof result.title === 'string', 'Title should be a string');
		assert(typeof result.subtitle === 'string', 'Subtitle should be a string');
		assert(typeof result.content === 'string', 'Content should be a string');

		// Check content structure
		assertStringIncludes(result.content, 'Resource:');
		assertStringIncludes(result.content, 'src/test.ts');
		assertStringIncludes(result.content, 'Edit type:');
		assertStringIncludes(result.content, 'searchReplace');
		assertStringIncludes(result.content, 'Create if missing:');
		assertStringIncludes(result.content, 'Yes');

		// Check default settings
		assertStringIncludes(result.content, 'Search & Replace 1:');
		assertStringIncludes(result.content, 'CASE-INSENSITIVE');
		assertStringIncludes(result.content, 'REGEX');
		assertStringIncludes(result.content, 'ALL');

		// Check operations
		assertStringIncludes(result.content, 'Search & Replace 1:');
		assertStringIncludes(result.content, 'old.*pattern');
		assertStringIncludes(result.content, 'new replacement');
		assertStringIncludes(result.content, 'Search & Replace 2:');
		assertStringIncludes(result.content, 'literal text');
		assertStringIncludes(result.content, 'updated text');

		// Check preview is a string
		assert(typeof result.preview === 'string', 'Preview should be a string');
		assertStringIncludes(result.preview, 'Editing src/test.ts with searchReplace operations');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Console Formatter - Block edit tool use',
	fn: () => {
		const toolInput: LLMToolEditResourceInput = {
			resourcePath: 'page/test-page',
			operations: [
				{
					editType: 'blocks',
					blocks_operationType: 'update',
					blocks_index: 0,
					blocks_content: {
						_key: 'block1',
						_type: 'block',
						style: 'h1',
						children: [{ _type: 'span', _key: 'span1', text: 'Updated Header', marks: [] }],
					},
				},
				{
					editType: 'blocks',
					blocks_operationType: 'insert',
					blocks_position: 1,
					blocks_block: {
						_key: 'block2',
						_type: 'block',
						style: 'normal',
						children: [{ _type: 'span', _key: 'span2', text: 'New content', marks: [] }],
					},
				},
				{
					editType: 'blocks',
					blocks_operationType: 'move',
					blocks_from: 2,
					blocks_to: 0,
				},
			],
		};

		const result = formatLogEntryToolUseConsole(toolInput);

		// Check title, subtitle, and content are strings (console formatter)
		assert(typeof result.title === 'string', 'Title should be a string');
		assert(typeof result.subtitle === 'string', 'Subtitle should be a string');
		assert(typeof result.content === 'string', 'Content should be a string');

		// Check content structure
		assertStringIncludes(result.content, 'Resource:');
		assertStringIncludes(result.content, 'page/test-page');
		assertStringIncludes(result.content, 'Edit type:');
		assertStringIncludes(result.content, 'blocks');

		// Check block operations
		assertStringIncludes(result.content, 'Operations:');
		assertStringIncludes(result.content, 'UPDATE operation 1:');
		assertStringIncludes(result.content, 'Target index:');
		assertStringIncludes(result.content, 'INSERT operation 2:');
		assertStringIncludes(result.content, 'Insert position:');
		assertStringIncludes(result.content, 'MOVE operation 3:');
		assertStringIncludes(result.content, 'Move:');
		// The arrow uses styled output, so just check for the numbers
		assertStringIncludes(result.content, '2');
		assertStringIncludes(result.content, '0');

		// Check preview is a string
		assert(typeof result.preview === 'string', 'Preview should be a string');
		assertStringIncludes(result.preview, 'Editing page/test-page with blocks operations');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Console Formatter - Tool result successful',
	fn: () => {
		const resultContent = {
			toolResult: [
				{ type: 'text' as const, text: 'Searched data source: local [primary]' },
				{
					type: 'text' as const,
					text: 'Search and replace operations applied to resource: test.ts. All operations succeeded.',
				},
				{ type: 'text' as const, text: '✅  Operation 1 completed successfully' },
				{ type: 'text' as const, text: '✅  Operation 2 completed successfully' },
			],
			bbResponse: {
				data: {
					resourcePath: 'test.ts',
					resourceId: 'test-id',
					editType: 'searchReplace' as const,
					operationsApplied: 2,
					operationsSuccessful: 2,
					operationsFailed: 0,
					operationsWithWarnings: 0,
					lastModified: '2024-01-01T00:00:00Z',
					revision: 'rev123',
					size: 1024,
					dataSource: { name: 'local', id: 'local-id' },
				},
			},
		};

		const result = formatLogEntryToolResultConsole(resultContent);

		// Check title and subtitle are strings (console formatter)
		assert(typeof result.title === 'string', 'Title should be a string');
		assert(typeof result.subtitle === 'string', 'Subtitle should be a string');

		// Check content includes operation results (console formatter returns strings)
		assertStringIncludes(result.content as string, 'Edit operations applied to test.ts');
		assertStringIncludes(result.content as string, 'Operation 1 completed successfully');
		assertStringIncludes(result.content as string, 'Operation 2 completed successfully');

		// Check preview is a string
		assert(typeof result.preview === 'string', 'Preview should be a string');
		assertStringIncludes(result.preview, '2 operations applied to test.ts');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Console Formatter - Tool result with warnings',
	fn: () => {
		const resultContent = {
			toolResult: [
				{ type: 'text' as const, text: 'Operated on data source: test-notion [notion-id]' },
				{
					type: 'text' as const,
					text:
						'Block edit operations applied to resource: page/test. Partial operations succeeded. 2/3 operations succeeded.',
				},
				{ type: 'text' as const, text: '✅ Operation 1 (update): Updated block successfully' },
				{ type: 'text' as const, text: '⚠️  Operation 2 (insert): Warning message' },
				{ type: 'text' as const, text: '❌ Operation 3 (delete): Operation failed' },
			],
			bbResponse: {
				data: {
					resourcePath: 'page/test',
					resourceId: 'test-page-id',
					editType: 'blocks' as const,
					operationsApplied: 3,
					operationsSuccessful: 1,
					operationsFailed: 1,
					operationsWithWarnings: 1,
					lastModified: '2024-01-01T00:00:00Z',
					revision: 'rev456',
					size: 2048,
					dataSource: { name: 'test-notion', id: 'notion-id' },
				},
			},
		};

		const result = formatLogEntryToolResultConsole(resultContent);

		// Check title and subtitle are strings (console formatter)
		assert(typeof result.title === 'string', 'Title should be a string');
		assert(typeof result.subtitle === 'string', 'Subtitle should be a string');

		// Check content includes different status indicators (console formatter returns strings)
		assertStringIncludes(result.content as string, 'Edit operations applied to page/test');
		assertStringIncludes(result.content as string, 'Operation 1');
		assertStringIncludes(result.content as string, 'Operation 2');
		assertStringIncludes(result.content as string, 'Operation 3');

		// Check preview is a string
		assert(typeof result.preview === 'string', 'Preview should be a string');
		assertStringIncludes(result.preview, '3 operations applied to page/test');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Browser Formatter - Search and replace tool use',
	fn: () => {
		const toolInput: LLMToolEditResourceInput = {
			resourcePath: 'src/example.ts',
			createIfMissing: false,
			operations: [
				{
					editType: 'searchReplace',
					searchReplace_search: 'old code',
					searchReplace_replace: 'new code',
					searchReplace_caseSensitive: true,
					searchReplace_replaceAll: false,
				},
			],
		};

		const result = formatLogEntryToolUseBrowser(toolInput);

		// Check title and subtitle are defined (JSX elements)
		assert(result.title, 'Title should be defined');
		assert(result.subtitle, 'Subtitle should be defined');

		// Check content is JSX element
		assert(result.content, 'Content should be defined');
		assert(typeof result.content === 'object', 'Content should be a JSX element');

		// Check preview is a string
		assert(typeof result.preview === 'string', 'Preview should be a string');
		assertStringIncludes(result.preview, 'Editing src/example.ts with searchReplace operations');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Browser Formatter - Block edit tool use',
	fn: () => {
		const toolInput: LLMToolEditResourceInput = {
			resourcePath: 'page/demo',
			operations: [
				{
					editType: 'blocks',
					blocks_operationType: 'delete',
					blocks_index: 1,
				},
				{
					editType: 'blocks',
					blocks_operationType: 'insert',
					blocks_position: 0,
					blocks_block: {
						_key: 'block3',
						_type: 'block',
						style: 'h3',
						children: [{ _type: 'span', _key: 'span3', text: 'New section', marks: [] }],
					},
				},
			],
		};

		const result = formatLogEntryToolUseBrowser(toolInput);

		// Check title and subtitle are defined (JSX elements)
		assert(result.title, 'Title should be defined');
		assert(result.subtitle, 'Subtitle should be defined');

		// Check content is JSX element
		assert(result.content, 'Content should be defined');
		assert(typeof result.content === 'object', 'Content should be a JSX element');

		// Check preview is a string
		assert(typeof result.preview === 'string', 'Preview should be a string');
		assertStringIncludes(result.preview, 'Editing page/demo with blocks operations');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'EditResourceTool - Browser Formatter - Tool result',
	fn: () => {
		const resultContent = {
			toolResult: [
				{ type: 'text' as const, text: 'Searched data source: local [primary]' },
				{ type: 'text' as const, text: '✅  Operation 1 completed successfully' },
			],
			bbResponse: {
				data: {
					resourcePath: 'example.ts',
					resourceId: 'example-id',
					editType: 'searchReplace' as const,
					operationsApplied: 1,
					operationsSuccessful: 1,
					operationsFailed: 0,
					operationsWithWarnings: 0,
					lastModified: '2024-01-01T00:00:00Z',
					revision: 'rev789',
					size: 512,
					dataSource: { name: 'local', id: 'primary' },
				},
			},
		};

		const result = formatLogEntryToolResultBrowser(resultContent);

		// Check title and subtitle are defined (JSX elements)
		assert(result.title, 'Title should be defined');
		assert(result.subtitle, 'Subtitle should be defined');

		// Check content is JSX element
		assert(result.content, 'Content should be defined');
		assert(typeof result.content === 'object', 'Content should be a JSX element');

		// Check preview is a string
		assert(typeof result.preview === 'string', 'Preview should be a string');
		assertStringIncludes(result.preview, '1 operations applied to example.ts');
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
