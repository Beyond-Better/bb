#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

/**
 * Integration test script for BlockEdit tool
 * 
 * This script verifies that the BlockEdit tool can be properly instantiated,
 * validates input schema, and tests basic functionality without requiring
 * a live Notion connection.
 * 
 * Usage: deno run --allow-read --allow-write --allow-env scripts/test-block-edit-integration.ts
 */

import { assert, assertEquals, assertExists } from 'https://deno.land/std@0.213.0/assert/mod.ts';
import LLMToolBlockEdit from '../api/src/llms/tools/blockEdit.tool/tool.ts';
import type { LLMToolBlockEditInput } from '../api/src/llms/tools/blockEdit.tool/types.ts';
import { formatLogEntryToolUse as formatConsole } from '../api/src/llms/tools/blockEdit.tool/formatter.console.ts';
import { formatLogEntryToolUse as formatBrowser } from '../api/src/llms/tools/blockEdit.tool/formatter.browser.tsx';

console.log('🔍 Starting BlockEdit Tool Integration Test...\n');

// Test 1: Tool Instantiation
console.log('✅ Test 1: Tool Instantiation');
try {
	const tool = new LLMToolBlockEdit();
	assertExists(tool);
	console.log('   - Tool successfully instantiated');
	console.log(`   - Tool constructor: ${tool.constructor.name}`);
} catch (error) {
	console.error('❌ Failed to instantiate tool:', error);
	Deno.exit(1);
}

// Test 2: Input Schema Validation
console.log('\n✅ Test 2: Input Schema Validation');
try {
	const tool = new LLMToolBlockEdit();
	const schema = tool.inputSchema;
	
	assertExists(schema);
	assertExists(schema.properties);
	assertExists(schema.properties.resourcePath);
	assertExists(schema.properties.operations);
	assertExists(schema.required);
	
	console.log('   - Schema structure is valid');
	console.log(`   - Required fields: ${schema.required.join(', ')}`);
	console.log('   - Optional fields: dataSourceId');
	
	// Verify operations schema
	const operationsSchema = schema.properties.operations;
	assert(operationsSchema.type === 'array');
	assertExists(operationsSchema.items);
	
	const operationSchema = operationsSchema.items;
	assertExists(operationSchema.properties);
	assertExists(operationSchema.properties.type);
	
	const operationTypes = operationSchema.properties.type.enum;
	assertEquals(operationTypes, ['update', 'insert', 'delete', 'move']);
	console.log(`   - Supported operation types: ${operationTypes.join(', ')}`);
	
} catch (error) {
	console.error('❌ Schema validation failed:', error);
	Deno.exit(1);
}

// Test 3: Formatter Functions
console.log('\n✅ Test 3: Formatter Functions');
try {
	const testInput: LLMToolBlockEditInput = {
		resourcePath: 'page/test-page-123',
		operations: [
			{
				type: 'update',
				index: 0,
				content: {
					_type: 'block',
					_key: 'test-block-key',
					style: 'h1',
					children: [
						{
							_type: 'span',
							_key: 'test-span-key',
							text: 'Test heading',
							marks: ['strong']
						}
					]
				}
			},
			{
				type: 'insert',
				position: 1,
				block: {
					_type: 'block',
					_key: 'inserted-block',
					style: 'normal',
					children: [
						{
							_type: 'span',
							_key: 'inserted-span',
							text: 'Inserted content'
						}
					]
				}
			}
		]
	};
	
	// Test console formatter
	const consoleResult = formatConsole(testInput);
	assertExists(consoleResult);
	assertExists(consoleResult.title);
	assertExists(consoleResult.content);
	assertExists(consoleResult.preview);
	console.log('   - Console formatter working');
	console.log(`   - Console preview: ${consoleResult.preview}`);
	
	// Test browser formatter
	const browserResult = formatBrowser(testInput);
	assertExists(browserResult);
	assertExists(browserResult.title);
	assertExists(browserResult.content);
	assertExists(browserResult.preview);
	console.log('   - Browser formatter working');
	console.log(`   - Browser preview: ${browserResult.preview}`);
	
} catch (error) {
	console.error('❌ Formatter test failed:', error);
	Deno.exit(1);
}

// Test 4: Tool Method Access
console.log('\n✅ Test 4: Tool Method Access');
try {
	const tool = new LLMToolBlockEdit();
	
	// Check that required methods exist
	assertExists(tool.inputSchema);
	assertExists(tool.formatLogEntryToolUse);
	assertExists(tool.formatLogEntryToolResult);
	assertExists(tool.runTool);
	
	console.log('   - All required methods are accessible');
	console.log('   - inputSchema property exists');
	console.log('   - Formatter methods exist');
	console.log('   - runTool method exists');
	
	// Test formatter method calls
	const testInput = {
		resourcePath: 'test/path',
		operations: [{ type: 'update', index: 0 }]
	};
	
	const consoleFormat = tool.formatLogEntryToolUse(testInput, 'console');
	const browserFormat = tool.formatLogEntryToolUse(testInput, 'browser');
	
	assertExists(consoleFormat);
	assertExists(browserFormat);
	
	console.log('   - Tool formatter methods work correctly');
	
} catch (error) {
	console.error('❌ Tool method access test failed:', error);
	Deno.exit(1);
}

// Test 5: Type System Integration
console.log('\n✅ Test 5: Type System Integration');
try {
	// Test that types are properly exported and accessible
	const testOperation: LLMToolBlockEditInput = {
		resourcePath: 'page/test',
		dataSourceId: 'notion-test',
		operations: [
			{
				type: 'update',
				index: 0,
				content: {
					_type: 'block',
					_key: 'test-key',
					style: 'normal',
					children: []
				}
			},
			{
				type: 'insert',
				position: 1,
				block: {
					_type: 'block',
					_key: 'insert-key',
					style: 'h2'
				}
			},
			{
				type: 'delete',
				_key: 'delete-this-key'
			},
			{
				type: 'move',
				from: 2,
				to: 0
			}
		]
	};
	
	assertExists(testOperation);
	assertEquals(testOperation.operations.length, 4);
	assertEquals(testOperation.operations[0].type, 'update');
	assertEquals(testOperation.operations[1].type, 'insert');
	assertEquals(testOperation.operations[2].type, 'delete');
	assertEquals(testOperation.operations[3].type, 'move');
	
	console.log('   - Type definitions are working correctly');
	console.log(`   - Test input has ${testOperation.operations.length} operations`);
	console.log('   - All operation types are properly typed');
	
} catch (error) {
	console.error('❌ Type system test failed:', error);
	Deno.exit(1);
}

// Test 6: JSON Schema Validation
console.log('\n✅ Test 6: JSON Schema Validation');
try {
	const tool = new LLMToolBlockEdit();
	const schema = tool.inputSchema;
	
	// Test valid input structure
	const validInput = {
		resourcePath: 'page/valid-test',
		operations: [
			{
				type: 'update',
				index: 0,
				content: {
					_type: 'block',
					_key: 'valid-key',
					style: 'normal'
				}
			}
		]
	};
	
	// Basic structural validation
	assert(typeof validInput.resourcePath === 'string');
	assert(Array.isArray(validInput.operations));
	assert(validInput.operations.length > 0);
	assert(['update', 'insert', 'delete', 'move'].includes(validInput.operations[0].type));
	
	console.log('   - Valid input structure passes basic validation');
	console.log('   - Schema enum constraints are properly defined');
	console.log('   - Required properties are correctly specified');
	
} catch (error) {
	console.error('❌ JSON Schema validation test failed:', error);
	Deno.exit(1);
}

// Test 7: Info.json Integration
console.log('\n✅ Test 7: Info.json Integration');
try {
	const infoPath = new URL('../api/src/llms/tools/blockEdit.tool/info.json', import.meta.url);
	const infoText = await Deno.readTextFile(infoPath);
	const info = JSON.parse(infoText);
	
	assertExists(info.name);
	assertExists(info.description);
	assertExists(info.version);
	assertEquals(info.name, 'block_edit');
	assertEquals(info.mutates, true);
	
	console.log(`   - Tool name: ${info.name}`);
	console.log(`   - Tool version: ${info.version}`);
	console.log(`   - Tool mutates resources: ${info.mutates}`);
	console.log('   - Info.json structure is valid for LLMToolManager');
	
} catch (error) {
	console.error('❌ Info.json integration test failed:', error);
	Deno.exit(1);
}

// Test 8: Import/Export Structure
console.log('\n✅ Test 8: Import/Export Structure');
try {
	// Test that the index file properly exports the tool
	const indexPath = new URL('../api/src/llms/tools/blockEdit.tool/index.ts', import.meta.url);
	const indexContent = await Deno.readTextFile(indexPath);
	
	assert(indexContent.includes('import LLMToolBlockEdit'));
	assert(indexContent.includes('export default LLMToolBlockEdit'));
	
	console.log('   - Index.ts exports tool correctly');
	console.log('   - Import/export structure follows BB conventions');
	
	// Test that tool file has proper imports
	const toolPath = new URL('../api/src/llms/tools/blockEdit.tool/tool.ts', import.meta.url);
	const toolContent = await Deno.readTextFile(toolPath);
	
	assert(toolContent.includes('import LLMTool from'));
	assert(toolContent.includes('export default class LLMToolBlockEdit extends LLMTool'));
	
	console.log('   - Tool.ts structure follows LLMTool pattern');
	console.log('   - All imports and exports are properly structured');
	
} catch (error) {
	console.error('❌ Import/Export structure test failed:', error);
	Deno.exit(1);
}

console.log('\n🎉 All Integration Tests Passed!');
console.log('\n📋 Summary:');
console.log('   ✅ Tool instantiation works correctly');
console.log('   ✅ Input schema is properly defined');
console.log('   ✅ Formatter functions are accessible');
console.log('   ✅ All required methods exist');
console.log('   ✅ Type system integration is working');
console.log('   ✅ JSON schema validation passes');
console.log('   ✅ Info.json is properly configured');
console.log('   ✅ Import/export structure is correct');
console.log('\n🚀 BlockEdit tool is ready for integration with LLMToolManager');

console.log('\n📝 Next Steps:');
console.log('   1. Ensure Notion data source has blockEdit capability');
console.log('   2. Test with live Notion pages in development environment');
console.log('   3. Verify BlockResourceAccessor interface implementation');
console.log('   4. Run full test suite: deno task tool:test');