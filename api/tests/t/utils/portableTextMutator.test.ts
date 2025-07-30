/**
 * Tests for portableTextMutator utility functions
 */
import { assert, assertEquals, assertThrows } from '@std/assert';
import {
	applyOperationsToPortableText,
	validatePortableTextOperation,
	findBlockByKey,
	summarizeOperations,
	type PortableTextBlock,
	type PortableTextOperation,
	type PortableTextOperationResult,
	type PortableTextSpan,
} from '../../../src/utils/portableTextMutator.utils.ts';

// Helper function to create test blocks
function createTestBlock(key: string, text: string, style: string = 'normal'): PortableTextBlock {
	return {
		_type: 'block',
		_key: key,
		style,
		children: [{
			_type: 'span',
			_key: `span-${key}`,
			text,
		}],
	};
}

// Helper function to create test span
function createTestSpan(key: string, text: string): PortableTextSpan {
	return {
		_type: 'span',
		_key: key,
		text,
	};
}

Deno.test({
	name: 'applyOperationsToPortableText - update operation by index',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'Original text'),
			createTestBlock('block2', 'Second block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'update',
			index: 0,
			content: createTestBlock('block1', 'Updated text'),
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].type, 'update');
		assertEquals(operationResults[0].message, 'Updated block at index 0');

		assertEquals(modifiedBlocks.length, 2);
		assertEquals(modifiedBlocks[0].children![0].text, 'Updated text');
		assertEquals(modifiedBlocks[1].children![0].text, 'Second block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - update operation by key',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'Original text'),
			createTestBlock('block2', 'Second block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'update',
			_key: 'block2',
			content: createTestBlock('block2', 'Updated second block'),
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].type, 'update');
		assertEquals(operationResults[0].affectedKey, 'block2');

		assertEquals(modifiedBlocks.length, 2);
		assertEquals(modifiedBlocks[0].children![0].text, 'Original text');
		assertEquals(modifiedBlocks[1].children![0].text, 'Updated second block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - insert operation',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'insert',
			position: 1,
			block: createTestBlock('block3', 'Inserted block'),
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].type, 'insert');
		assertEquals(operationResults[0].message, 'Inserted block at position 1');
		assertEquals(operationResults[0].newIndex, 1);

		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[0].children![0].text, 'First block');
		assertEquals(modifiedBlocks[1].children![0].text, 'Inserted block');
		assertEquals(modifiedBlocks[2].children![0].text, 'Second block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - insert at end',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'insert',
			position: 1,
			block: createTestBlock('block2', 'Last block'),
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 2);
		assertEquals(modifiedBlocks[1].children![0].text, 'Last block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - delete operation by index',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
			createTestBlock('block3', 'Third block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'delete',
			index: 1,
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].type, 'delete');
		assertEquals(operationResults[0].originalIndex, 1);
		assertEquals(operationResults[0].affectedKey, 'block2');

		assertEquals(modifiedBlocks.length, 2);
		assertEquals(modifiedBlocks[0].children![0].text, 'First block');
		assertEquals(modifiedBlocks[1].children![0].text, 'Third block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - delete operation by key',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
			createTestBlock('block3', 'Third block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'delete',
			_key: 'block2',
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].affectedKey, 'block2');

		assertEquals(modifiedBlocks.length, 2);
		assertEquals(modifiedBlocks[0]._key, 'block1');
		assertEquals(modifiedBlocks[1]._key, 'block3');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - move operation',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
			createTestBlock('block3', 'Third block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'move',
			from: 0,
			to: 2,
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].type, 'move');
		assertEquals(operationResults[0].originalIndex, 0);
		assertEquals(operationResults[0].newIndex, 1); // Adjusted for removal
		assertEquals(operationResults[0].affectedKey, 'block1');

		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[0]._key, 'block2');
		assertEquals(modifiedBlocks[1]._key, 'block1');
		assertEquals(modifiedBlocks[2]._key, 'block3');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - move operation by key',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
			createTestBlock('block3', 'Third block'),
		];

		const operations: PortableTextOperation[] = [{
			type: 'move',
			fromKey: 'block3',
			toPosition: 0,
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].affectedKey, 'block3');

		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[0]._key, 'block3');
		assertEquals(modifiedBlocks[1]._key, 'block1');
		assertEquals(modifiedBlocks[2]._key, 'block2');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - multiple operations',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
		];

		const operations: PortableTextOperation[] = [
			{
				type: 'update',
				index: 0,
				content: createTestBlock('block1', 'Updated first block'),
			},
			{
				type: 'insert',
				position: 2,
				block: createTestBlock('block3', 'New third block'),
			},
		];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 2);
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[0].type, 'update');
		assertEquals(operationResults[1].success, true);
		assertEquals(operationResults[1].type, 'insert');

		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[0].children![0].text, 'Updated first block');
		assertEquals(modifiedBlocks[1].children![0].text, 'Second block');
		assertEquals(modifiedBlocks[2].children![0].text, 'New third block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - operation failures',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
		];

		const operations: PortableTextOperation[] = [
			{
				type: 'update',
				index: 10, // Invalid index
				content: createTestBlock('block1', 'Updated'),
			},
			{
				type: 'insert',
				position: -1, // Invalid position
				block: createTestBlock('block2', 'New block'),
			},
			{
				type: 'delete',
				_key: 'nonexistent', // Non-existent key
			},
			{
				type: 'move',
				from: 0,
				to: 0, // Same position
			},
		];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 4);
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Block not found'), true);
		assertEquals(operationResults[1].success, false);
		assertEquals(operationResults[1].message.includes('Invalid insert position'), true);
		assertEquals(operationResults[2].success, false);
		assertEquals(operationResults[2].message.includes('Block not found'), true);
		assertEquals(operationResults[3].success, false);
		assertEquals(operationResults[3].message.includes('same'), true);

		// Original blocks should be unchanged due to failed operations
		assertEquals(modifiedBlocks.length, 1);
		assertEquals(modifiedBlocks[0].children![0].text, 'First block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - unsupported operation type',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [createTestBlock('block1', 'First block')];
		
		const operations: PortableTextOperation[] = [{
			type: 'invalid' as any,
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message, 'Unsupported operation type: invalid');
	},
});

Deno.test({
	name: 'validatePortableTextOperation - valid operations',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const validOperations: PortableTextOperation[] = [
			{
				type: 'update',
				index: 0,
				content: createTestBlock('block1', 'Updated'),
			},
			{
				type: 'update',
				_key: 'block1',
				content: createTestBlock('block1', 'Updated'),
			},
			{
				type: 'insert',
				position: 0,
				block: createTestBlock('block2', 'New block'),
			},
			{
				type: 'delete',
				index: 0,
			},
			{
				type: 'delete',
				_key: 'block1',
			},
			{
				type: 'move',
				from: 0,
				to: 1,
			},
			{
				type: 'move',
				fromKey: 'block1',
				toPosition: 1,
			},
		];

		for (const operation of validOperations) {
			assertEquals(validatePortableTextOperation(operation), true, 
				`Operation should be valid: ${JSON.stringify(operation)}`);
		}
	},
});

Deno.test({
	name: 'validatePortableTextOperation - invalid operations',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const invalidOperations: PortableTextOperation[] = [
			{ type: 'invalid' as any },
			{ type: 'update' }, // Missing content and index/key
			{ type: 'update', content: createTestBlock('block1', 'text') }, // Missing index/key
			{ type: 'insert' }, // Missing position and block
			{ type: 'insert', position: 0 }, // Missing block
			{ type: 'delete' }, // Missing index and key
			{ type: 'move' }, // Missing from and to
			{ type: 'move', from: 0 }, // Missing to
		];

		for (const operation of invalidOperations) {
			assertEquals(validatePortableTextOperation(operation), false, 
				`Operation should be invalid: ${JSON.stringify(operation)}`);
		}
	},
});

Deno.test({
	name: 'findBlockByKey - existing key',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
			createTestBlock('block3', 'Third block'),
		];

		assertEquals(findBlockByKey(blocks, 'block1'), 0);
		assertEquals(findBlockByKey(blocks, 'block2'), 1);
		assertEquals(findBlockByKey(blocks, 'block3'), 2);
	},
});

Deno.test({
	name: 'findBlockByKey - non-existing key',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
		];

		assertEquals(findBlockByKey(blocks, 'nonexistent'), -1);
		assertEquals(findBlockByKey(blocks, 'block3'), -1);
	},
});

Deno.test({
	name: 'findBlockByKey - empty array',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks: PortableTextBlock[] = [];
		assertEquals(findBlockByKey(blocks, 'any-key'), -1);
	},
});

Deno.test({
	name: 'summarizeOperations - various operations',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const operations: PortableTextOperation[] = [
			{
				type: 'update',
				index: 0,
				content: createTestBlock('block1', 'Updated'),
			},
			{
				type: 'insert',
				position: 1,
				block: createTestBlock('block2', 'New block'),
			},
			{
				type: 'delete',
				_key: 'block3',
			},
			{
				type: 'move',
				from: 2,
				to: 0,
			},
		];

		const summary = summarizeOperations(operations);
		
		assertEquals(summary.includes('4 operations'), true);
		assertEquals(summary.includes('#0: Update block 0'), true);
		assertEquals(summary.includes('#1: Insert block at position 1'), true);
		assertEquals(summary.includes('#2: Delete block block3'), true);
		assertEquals(summary.includes('#3: Move block from 2 to 0'), true);
	},
});

Deno.test({
	name: 'summarizeOperations - empty operations',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const operations: PortableTextOperation[] = [];
		const summary = summarizeOperations(operations);
		assertEquals(summary, '0 operations: ');
	},
});

Deno.test({
	name: 'summarizeOperations - operation with keys',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const operations: PortableTextOperation[] = [
			{
				type: 'update',
				_key: 'block-key',
				content: createTestBlock('block1', 'Updated'),
			},
			{
				type: 'move',
				fromKey: 'source-key',
				toPosition: 2,
			},
		];

		const summary = summarizeOperations(operations);
		
		assertEquals(summary.includes('#0: Update block block-key'), true);
		assertEquals(summary.includes('#1: Move block from source-key to 2'), true);
	},
});

Deno.test({
	name: 'empty blocks array handling',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks: PortableTextBlock[] = [];
		
		const operations: PortableTextOperation[] = [{
			type: 'insert',
			position: 0,
			block: createTestBlock('block1', 'New block'),
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 1);
		assertEquals(modifiedBlocks[0].children![0].text, 'New block');
	},
});

Deno.test({
	name: 'edge case - move to same position adjusted',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createTestBlock('block1', 'First block'),
			createTestBlock('block2', 'Second block'),
			createTestBlock('block3', 'Third block'),
		];

		// Move block from index 1 to position 1 should fail
		const operations: PortableTextOperation[] = [{
			type: 'move',
			from: 1,
			to: 1,
		}];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, operations);

		assertEquals(operationResults.length, 1);
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('same'), true);
		
		// Blocks should remain unchanged
		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[0]._key, 'block1');
		assertEquals(modifiedBlocks[1]._key, 'block2');
		assertEquals(modifiedBlocks[2]._key, 'block3');
	},
});