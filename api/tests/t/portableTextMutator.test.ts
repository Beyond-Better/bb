/**
 * Exhaustive tests for portableTextMutator utility functions
 * Tests the utility functions directly without any accessor logic
 */
import { assert, assertEquals } from '@std/assert';
import {
	applyOperationsToPortableText,
	findBlockByKey,
	summarizeOperations,
	validatePortableTextOperation,
} from 'api/utils/portableTextMutator.ts';
import type {
	PortableTextBlock,
	PortableTextOperation,
	PortableTextOperationResult,
	PortableTextSpan,
} from 'api/types/portableText.ts';

// Helper function to create realistic test blocks similar to notionAccessor tests
function createPortableTextBlock(key: string, text: string, style: string = 'normal'): PortableTextBlock {
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

// Helper function to create complex blocks with multiple spans
function createComplexBlock(
	key: string,
	spans: Array<{ text: string; marks?: string[] }>,
	style: string = 'normal',
): PortableTextBlock {
	return {
		_type: 'block',
		_key: key,
		style,
		children: spans.map((span, index) => ({
			_type: 'span',
			_key: `span-${key}-${index}`,
			text: span.text,
			marks: span.marks || [],
		})),
	};
}

// Helper function to create list item blocks
function createListBlock(key: string, text: string, listItem: string, level: number = 1): PortableTextBlock {
	return {
		_type: 'block',
		_key: key,
		style: 'normal',
		listItem,
		level,
		children: [{
			_type: 'span',
			_key: `span-${key}`,
			text,
		}],
	};
}

// Helper function to create image blocks
function createImageBlock(key: string, alt: string, url?: string): PortableTextBlock {
	return {
		_type: 'image',
		_key: key,
		alt,
		asset: url ? { url } : undefined,
	};
}

// Helper function to create code blocks
function createCodeBlock(key: string, code: string, language?: string): PortableTextBlock {
	return {
		_type: 'code',
		_key: key,
		code,
		language,
	};
}

Deno.test({
	name: 'applyOperationsToPortableText - UPDATE operations comprehensive tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createPortableTextBlock('block1', 'First paragraph'),
			createComplexBlock('block2', [
				{ text: 'Bold ', marks: ['strong'] },
				{ text: 'and italic ', marks: ['em'] },
				{ text: 'text' },
			]),
			createListBlock('block3', 'List item', 'bullet'),
		];

		// Test update by index
		const updateByIndex: PortableTextOperation[] = [{
			type: 'update',
			index: 0,
			content: createPortableTextBlock('block1', 'Updated first paragraph'),
		}];

		let { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, updateByIndex);
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks[0].children![0].text, 'Updated first paragraph');

		// Test update by key
		const updateByKey: PortableTextOperation[] = [{
			type: 'update',
			_key: 'block2',
			content: createPortableTextBlock('block2', 'Replaced complex block'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, updateByKey));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks[1].children![0].text, 'Replaced complex block');

		// Test update with style change
		const updateStyle: PortableTextOperation[] = [{
			type: 'update',
			index: 2,
			content: createPortableTextBlock('block3', 'Now a heading', 'h1'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, updateStyle));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks[2].style, 'h1');

		// Test update non-existent index
		const updateInvalid: PortableTextOperation[] = [{
			type: 'update',
			index: 99,
			content: createPortableTextBlock('new', 'Should fail'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, updateInvalid));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Block not found'), true);

		// Test update non-existent key
		const updateInvalidKey: PortableTextOperation[] = [{
			type: 'update',
			_key: 'nonexistent',
			content: createPortableTextBlock('new', 'Should fail'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, updateInvalidKey));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Block not found'), true);

		// Test update without content
		const updateNoContent: PortableTextOperation[] = [{
			type: 'update',
			index: 0,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, updateNoContent));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message, 'Update operation requires content');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - INSERT operations comprehensive tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createPortableTextBlock('block1', 'First paragraph'),
			createPortableTextBlock('block2', 'Second paragraph'),
		];

		// Test insert at beginning
		const insertAtStart: PortableTextOperation[] = [{
			type: 'insert',
			position: 0,
			block: createPortableTextBlock('new1', 'New first paragraph'),
		}];

		let { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertAtStart);
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[0]._key, 'new1');
		assertEquals(modifiedBlocks[1]._key, 'block1');

		// Test insert in middle
		const insertInMiddle: PortableTextOperation[] = [{
			type: 'insert',
			position: 1,
			block: createPortableTextBlock('new2', 'Middle paragraph'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertInMiddle));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[1]._key, 'new2');

		// Test insert at end
		const insertAtEnd: PortableTextOperation[] = [{
			type: 'insert',
			position: 2,
			block: createPortableTextBlock('new3', 'Last paragraph'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertAtEnd));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 3);
		assertEquals(modifiedBlocks[2]._key, 'new3');

		// Test insert beyond end (should work)
		const insertBeyondEnd: PortableTextOperation[] = [{
			type: 'insert',
			position: 2,
			block: createPortableTextBlock('new4', 'Beyond end'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertBeyondEnd));
		assertEquals(operationResults[0].success, true);

		// Test insert with different block types
		const insertVariousTypes: PortableTextOperation[] = [
			{
				type: 'insert',
				position: 0,
				block: createComplexBlock('complex', [{ text: 'Complex ', marks: ['strong'] }, { text: 'block' }]),
			},
			{
				type: 'insert',
				position: 1,
				block: createListBlock('list1', 'List item', 'bullet'),
			},
			{
				type: 'insert',
				position: 2,
				block: createImageBlock('img1', 'Test image', 'https://example.com/image.jpg'),
			},
			{
				type: 'insert',
				position: 3,
				block: createCodeBlock('code1', 'console.log("hello");', 'javascript'),
			},
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertVariousTypes));
		assertEquals(operationResults.every((r: PortableTextOperationResult) => r.success), true);
		assertEquals(modifiedBlocks.length, 6);

		// Test insert at invalid positions
		const insertNegative: PortableTextOperation[] = [{
			type: 'insert',
			position: -1,
			block: createPortableTextBlock('invalid', 'Should fail'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertNegative));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Invalid insert position'), true);

		const insertTooHigh: PortableTextOperation[] = [{
			type: 'insert',
			position: 100,
			block: createPortableTextBlock('invalid', 'Should fail'),
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertTooHigh));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Invalid insert position'), true);

		// Test insert without block
		const insertNoBlock: PortableTextOperation[] = [{
			type: 'insert',
			position: 0,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, insertNoBlock));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message, 'Insert operation requires block');
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - DELETE operations comprehensive tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createPortableTextBlock('block1', 'First paragraph'),
			createComplexBlock('block2', [{ text: 'Complex block' }]),
			createListBlock('block3', 'List item', 'bullet'),
			createImageBlock('block4', 'Image block'),
			createCodeBlock('block5', 'console.log("test");', 'javascript'),
		];

		// Test delete by index (first)
		const deleteFirst: PortableTextOperation[] = [{
			type: 'delete',
			index: 0,
		}];

		let { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, deleteFirst);
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 4);
		assertEquals(modifiedBlocks[0]._key, 'block2');
		assertEquals(operationResults[0].affectedKey, 'block1');

		// Test delete by index (middle)
		const deleteMiddle: PortableTextOperation[] = [{
			type: 'delete',
			index: 2,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, deleteMiddle));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 4);
		assertEquals(operationResults[0].affectedKey, 'block3');

		// Test delete by index (last)
		const deleteLast: PortableTextOperation[] = [{
			type: 'delete',
			index: 4,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, deleteLast));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 4);
		assertEquals(operationResults[0].affectedKey, 'block5');

		// Test delete by key
		const deleteByKey: PortableTextOperation[] = [{
			type: 'delete',
			_key: 'block2',
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, deleteByKey));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 4);
		assertEquals(operationResults[0].affectedKey, 'block2');

		// Test delete multiple blocks
		const deleteMultiple: PortableTextOperation[] = [
			{ type: 'delete', _key: 'block1' },
			{ type: 'delete', index: 0 }, // This will be block2 after block1 is deleted
			{ type: 'delete', _key: 'block4' },
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, deleteMultiple));
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);
		assertEquals(modifiedBlocks.length, 2);

		// Test delete invalid index
		const deleteInvalidIndex: PortableTextOperation[] = [{
			type: 'delete',
			index: 99,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, deleteInvalidIndex));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Block not found'), true);

		// Test delete invalid key
		const deleteInvalidKey: PortableTextOperation[] = [{
			type: 'delete',
			_key: 'nonexistent',
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, deleteInvalidKey));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Block not found'), true);

		// Test delete from empty array
		const deleteFromEmpty: PortableTextOperation[] = [{
			type: 'delete',
			index: 0,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText([], deleteFromEmpty));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Block not found'), true);
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - MOVE operations comprehensive tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createPortableTextBlock('block1', 'First paragraph'),
			createPortableTextBlock('block2', 'Second paragraph'),
			createPortableTextBlock('block3', 'Third paragraph'),
			createPortableTextBlock('block4', 'Fourth paragraph'),
			createPortableTextBlock('block5', 'Fifth paragraph'),
		];

		// Test move from start to end
		const moveStartToEnd: PortableTextOperation[] = [{
			type: 'move',
			from: 0,
			to: 4,
		}];

		let { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveStartToEnd);
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks[0]._key, 'block2');
		assertEquals(modifiedBlocks[3]._key, 'block1'); // Adjusted position after removal
		assertEquals(operationResults[0].originalIndex, 0);
		assertEquals(operationResults[0].newIndex, 3);

		// Test move from end to start
		const moveEndToStart: PortableTextOperation[] = [{
			type: 'move',
			from: 4,
			to: 0,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveEndToStart));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks[0]._key, 'block5');
		assertEquals(modifiedBlocks[4]._key, 'block4');

		// Test move middle elements
		const moveMiddle: PortableTextOperation[] = [{
			type: 'move',
			from: 2,
			to: 1,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveMiddle));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks[1]._key, 'block3');
		assertEquals(modifiedBlocks[2]._key, 'block2');

		// Test move by key
		const moveByKey: PortableTextOperation[] = [{
			type: 'move',
			fromKey: 'block3',
			toPosition: 0,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveByKey));
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks[0]._key, 'block3');
		assertEquals(operationResults[0].affectedKey, 'block3');

		// Test multiple moves
		const multipleMove: PortableTextOperation[] = [
			{ type: 'move', from: 0, to: 2 },
			{ type: 'move', fromKey: 'block4', toPosition: 0 },
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, multipleMove));
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);

		// Test move to same position
		const moveSamePosition: PortableTextOperation[] = [{
			type: 'move',
			from: 2,
			to: 2,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveSamePosition));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('same'), true);

		// Test move with invalid from index
		const moveInvalidFrom: PortableTextOperation[] = [{
			type: 'move',
			from: 99,
			to: 0,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveInvalidFrom));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Source block not found'), true);

		// Test move with invalid to position
		const moveInvalidTo: PortableTextOperation[] = [{
			type: 'move',
			from: 0,
			to: 99,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveInvalidTo));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Invalid target position'), true);

		// Test move with invalid key
		const moveInvalidKey: PortableTextOperation[] = [{
			type: 'move',
			fromKey: 'nonexistent',
			toPosition: 0,
		}];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, moveInvalidKey));
		assertEquals(operationResults[0].success, false);
		assertEquals(operationResults[0].message.includes('Source block not found'), true);

		// Test complex move sequence
		const complexMoves: PortableTextOperation[] = [
			{ type: 'move', from: 4, to: 0 }, // Move last to first
			{ type: 'move', from: 3, to: 1 }, // Move what is now at index 3 to index 1
			{ type: 'move', fromKey: 'block2', toPosition: 4 }, // Move block2 to end
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, complexMoves));
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);
		assertEquals(modifiedBlocks.length, 5);
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - mixed operations and complex scenarios',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createPortableTextBlock('block1', 'First paragraph'),
			createPortableTextBlock('block2', 'Second paragraph'),
			createPortableTextBlock('block3', 'Third paragraph'),
		];

		// Test combination of all operations
		const mixedOperations: PortableTextOperation[] = [
			{
				type: 'update',
				index: 0,
				content: createPortableTextBlock('block1', 'Updated first paragraph'),
			},
			{
				type: 'insert',
				position: 2,
				block: createPortableTextBlock('new1', 'Inserted paragraph'),
			},
			{
				type: 'delete',
				_key: 'block3',
			},
			{
				type: 'move',
				from: 1,
				to: 0,
			},
		];

		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(blocks, mixedOperations);

		assertEquals(operationResults.length, 4);
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);
		assertEquals(modifiedBlocks.length, 3); // Started with 3, inserted 1, deleted 1

		// Test operations that depend on each other
		const dependentOperations: PortableTextOperation[] = [
			{
				type: 'insert',
				position: 0,
				block: createPortableTextBlock('new2', 'New first'),
			},
			{
				type: 'update',
				index: 1, // This is now the original first block
				content: createPortableTextBlock('block1', 'Updated original first'),
			},
			{
				type: 'move',
				from: 0,
				to: 3, // Move the inserted block to the end
			},
		];

		const { modifiedBlocks: dependent, operationResults: dependentResults } = applyOperationsToPortableText(
			blocks,
			dependentOperations,
		);

		assertEquals(dependentResults.every((r: PortableTextOperationResult) => r.success), true);
		assertEquals(dependent[0]._key, 'block1');
		assertEquals(dependent[2]._key, 'new2');

		// Test error recovery - some operations fail, others succeed
		const partialFailure: PortableTextOperation[] = [
			{
				type: 'update',
				index: 0,
				content: createPortableTextBlock('block1', 'This should work'),
			},
			{
				type: 'delete',
				index: 99, // This should fail
			},
			{
				type: 'insert',
				position: 1,
				block: createPortableTextBlock('new3', 'This should work'),
			},
			{
				type: 'move',
				from: 0,
				to: 0, // This should fail (same position)
			},
		];

		const { modifiedBlocks: partial, operationResults: partialResults } = applyOperationsToPortableText(
			blocks,
			partialFailure,
		);

		assertEquals(partialResults[0].success, true);
		assertEquals(partialResults[1].success, false);
		assertEquals(partialResults[2].success, true);
		assertEquals(partialResults[3].success, false);
		assertEquals(partial.length, 4); // Original 3 + 1 inserted
	},
});

Deno.test({
	name: 'applyOperationsToPortableText - edge cases and boundary conditions',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		// Test with empty blocks array
		const emptyOperations: PortableTextOperation[] = [
			{
				type: 'insert',
				position: 0,
				block: createPortableTextBlock('first', 'First block'),
			},
		];

		let { modifiedBlocks, operationResults } = applyOperationsToPortableText([], emptyOperations);
		assertEquals(operationResults[0].success, true);
		assertEquals(modifiedBlocks.length, 1);

		// Test with single block
		const singleBlock = [createPortableTextBlock('only', 'Only block')];

		const singleBlockOps: PortableTextOperation[] = [
			{ type: 'update', index: 0, content: createPortableTextBlock('only', 'Updated only block') },
			{ type: 'insert', position: 0, block: createPortableTextBlock('before', 'Before only') },
			{ type: 'insert', position: 2, block: createPortableTextBlock('after', 'After only') },
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(singleBlock, singleBlockOps));
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);
		assertEquals(modifiedBlocks.length, 3);

		// Test with blocks without keys
		const blocksWithoutKeys: (Omit<PortableTextBlock, 'children'> & {
			children: Omit<PortableTextSpan, '_key'>[];
		})[] = [
			{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: 'No key 1' }] },
			{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: 'No key 2' }] },
		];

		const noKeyOps: PortableTextOperation[] = [
			{ type: 'update', index: 0, content: createPortableTextBlock('new', 'Updated') },
			{ type: 'delete', _key: 'nonexistent' }, // Should fail gracefully
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(
			blocksWithoutKeys as PortableTextBlock[],
			noKeyOps,
		));
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[1].success, false);

		// Test with malformed operations
		const malformedOps: PortableTextOperation[] = [
			// deno-lint-ignore no-explicit-any
			{ type: 'update' as any }, // Missing required fields
			{ type: 'insert', position: 0 }, // Missing block
			{ type: 'delete' }, // Missing index/key
			{ type: 'move' }, // Missing from/to
			// deno-lint-ignore no-explicit-any
			{ type: 'invalid' as any }, // Invalid type
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(singleBlock, malformedOps));
		assertEquals(operationResults.every((r: PortableTextOperationResult) => !r.success), true);

		// Test with very large arrays (performance test)
		const largeBlocks = Array.from({ length: 1000 }, (_, i) => createPortableTextBlock(`block${i}`, `Block ${i}`));

		const largeOps: PortableTextOperation[] = [
			{ type: 'insert', position: 500, block: createPortableTextBlock('middle', 'Middle insert') },
			{ type: 'delete', index: 0 },
			{ type: 'move', from: 999, to: 0 },
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(largeBlocks, largeOps));
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);
		assertEquals(modifiedBlocks.length, 1000); // 1000 + 1 insert - 1 delete
	},
});

Deno.test({
	name: 'validatePortableTextOperation - comprehensive validation tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		// Valid update operations
		assertEquals(
			validatePortableTextOperation({
				type: 'update',
				index: 0,
				content: createPortableTextBlock('test', 'test'),
			}),
			true,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'update',
				_key: 'test',
				content: createPortableTextBlock('test', 'test'),
			}),
			true,
		);

		// Invalid update operations
		assertEquals(
			validatePortableTextOperation({
				type: 'update',
			}),
			false,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'update',
				index: 0,
			}),
			false,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'update',
				content: createPortableTextBlock('test', 'test'),
			}),
			false,
		);

		// Valid insert operations
		assertEquals(
			validatePortableTextOperation({
				type: 'insert',
				position: 0,
				block: createPortableTextBlock('test', 'test'),
			}),
			true,
		);

		// Invalid insert operations
		assertEquals(
			validatePortableTextOperation({
				type: 'insert',
			}),
			false,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'insert',
				position: 0,
			}),
			false,
		);

		// Valid delete operations
		assertEquals(
			validatePortableTextOperation({
				type: 'delete',
				index: 0,
			}),
			true,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'delete',
				_key: 'test',
			}),
			true,
		);

		// Invalid delete operations
		assertEquals(
			validatePortableTextOperation({
				type: 'delete',
			}),
			false,
		);

		// Valid move operations
		assertEquals(
			validatePortableTextOperation({
				type: 'move',
				from: 0,
				to: 1,
			}),
			true,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'move',
				fromKey: 'test',
				toPosition: 1,
			}),
			true,
		);

		// Invalid move operations
		assertEquals(
			validatePortableTextOperation({
				type: 'move',
			}),
			false,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'move',
				from: 0,
			}),
			false,
		);

		assertEquals(
			validatePortableTextOperation({
				type: 'move',
				to: 1,
			}),
			false,
		);

		// Invalid operation types
		assertEquals(
			validatePortableTextOperation({
				// deno-lint-ignore no-explicit-any
				type: 'invalid' as any,
			}),
			false,
		);

		// deno-lint-ignore no-explicit-any
		assertEquals(validatePortableTextOperation({} as any), false);
	},
});

Deno.test({
	name: 'findBlockByKey - comprehensive search tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [
			createPortableTextBlock('first', 'First block'),
			createComplexBlock('second', [{ text: 'Second block' }]),
			createListBlock('third', 'Third block', 'bullet'),
			{ _type: 'block', children: [{ _type: 'span' as const, text: 'No key block' }] } as PortableTextBlock, // Block without key
		];

		// Test finding existing keys
		assertEquals(findBlockByKey(blocks, 'first'), 0);
		assertEquals(findBlockByKey(blocks, 'second'), 1);
		assertEquals(findBlockByKey(blocks, 'third'), 2);

		// Test finding non-existent keys
		assertEquals(findBlockByKey(blocks, 'nonexistent'), -1);
		assertEquals(findBlockByKey(blocks, 'FIRST'), -1); // Case sensitive

		// Test with empty array
		assertEquals(findBlockByKey([], 'any'), -1);

		// Test with array containing blocks without keys
		const blocksWithoutKeys: (Omit<PortableTextBlock, 'children'> & {
			children: Omit<PortableTextSpan, '_key'>[];
		})[] = [
			{ _type: 'block', children: [{ _type: 'span' as const, text: 'Block 1' }] },
			{ _type: 'block', children: [{ _type: 'span' as const, text: 'Block 2' }] },
		];
		assertEquals(findBlockByKey(blocksWithoutKeys as PortableTextBlock[], 'any'), -1);

		// Test with duplicate keys (should return first match)
		const duplicateKeyBlocks = [
			createPortableTextBlock('duplicate', 'First duplicate'),
			createPortableTextBlock('duplicate', 'Second duplicate'),
			createPortableTextBlock('unique', 'Unique block'),
		];
		assertEquals(findBlockByKey(duplicateKeyBlocks, 'duplicate'), 0);

		// Test with null/undefined keys
		const nullKeyBlocks: PortableTextBlock[] = [
			{ _type: 'block', _key: undefined, children: [] },
			// deno-lint-ignore no-explicit-any
			{ _type: 'block', _key: null as any, children: [] },
			createPortableTextBlock('valid', 'Valid block'),
		];
		assertEquals(findBlockByKey(nullKeyBlocks, 'valid'), 2);
	},
});

Deno.test({
	name: 'summarizeOperations - comprehensive summary tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		// Test empty operations
		assertEquals(summarizeOperations([]), '0 operations: ');

		// Test single operations of each type
		assertEquals(
			summarizeOperations([{ type: 'update', index: 0, content: createPortableTextBlock('test', 'test') }]),
			'1 operations: #0: Update block 0',
		);

		assertEquals(
			summarizeOperations([{ type: 'insert', position: 1, block: createPortableTextBlock('test', 'test') }]),
			'1 operations: #0: Insert block at position 1',
		);

		assertEquals(
			summarizeOperations([{ type: 'delete', index: 2 }]),
			'1 operations: #0: Delete block 2',
		);

		assertEquals(
			summarizeOperations([{ type: 'move', from: 0, to: 1 }]),
			'1 operations: #0: Move block from 0 to 1',
		);

		// Test operations with keys
		assertEquals(
			summarizeOperations([{
				type: 'update',
				_key: 'test-key',
				content: createPortableTextBlock('test', 'test'),
			}]),
			'1 operations: #0: Update block test-key',
		);

		assertEquals(
			summarizeOperations([{ type: 'delete', _key: 'delete-key' }]),
			'1 operations: #0: Delete block delete-key',
		);

		assertEquals(
			summarizeOperations([{ type: 'move', fromKey: 'move-key', toPosition: 3 }]),
			'1 operations: #0: Move block from move-key to 3',
		);

		// Test complex mixed operations
		const complexOps: PortableTextOperation[] = [
			{ type: 'update', index: 0, content: createPortableTextBlock('test', 'test') },
			{ type: 'insert', position: 1, block: createPortableTextBlock('test', 'test') },
			{ type: 'delete', _key: 'target' },
			{ type: 'move', fromKey: 'source', toPosition: 2 },
			{ type: 'update', _key: 'another', content: createPortableTextBlock('test', 'test') },
		];

		const summary = summarizeOperations(complexOps);
		assertEquals(summary.includes('5 operations'), true);
		assertEquals(summary.includes('#0: Update block 0'), true);
		assertEquals(summary.includes('#1: Insert block at position 1'), true);
		assertEquals(summary.includes('#2: Delete block target'), true);
		assertEquals(summary.includes('#3: Move block from source to 2'), true);
		assertEquals(summary.includes('#4: Update block another'), true);

		// Test unknown operation type
		const unknownOps: PortableTextOperation[] = [
			// deno-lint-ignore no-explicit-any
			{ type: 'unknown' as any },
		];
		const unknownSummary = summarizeOperations(unknownOps);
		assertEquals(unknownSummary.includes('#0: Unknown operation type'), true);

		// Test very large number of operations
		const manyOps = Array.from({ length: 100 }, (_, i) => ({
			type: 'update' as const,
			index: i,
			content: createPortableTextBlock(`block${i}`, `Block ${i}`),
		}));
		const manySummary = summarizeOperations(manyOps);
		assertEquals(manySummary.includes('100 operations'), true);
		assertEquals(manySummary.includes('#0: Update block 0'), true);
		assertEquals(manySummary.includes('#99: Update block 99'), true);
	},
});

Deno.test({
	name: 'error handling and exception scenarios',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const blocks = [createPortableTextBlock('test', 'Test block')];

		// Test operations that would throw errors if not handled properly
		const problematicOps: PortableTextOperation[] = [
			{
				type: 'update',
				index: 0,
				// deno-lint-ignore no-explicit-any
				content: null as any, // Null content
			},
			{
				type: 'insert',
				position: 0,
				// deno-lint-ignore no-explicit-any
				block: undefined as any, // Undefined block
			},
			{
				type: 'delete',
				index: -1, // Negative index
			},
			{
				type: 'move',
				from: 0,
				to: -1, // Negative target
			},
		];

		const { operationResults } = applyOperationsToPortableText(blocks, problematicOps);

		// All operations should fail gracefully without throwing
		assertEquals(operationResults.every((r: { success: boolean }) => !r.success), true);
		assertEquals(operationResults.every((r: PortableTextOperationResult) => typeof r.message === 'string'), true);

		// Test with malformed blocks array
		// deno-lint-ignore no-explicit-any
		const malformedBlocks: any[] = [
			null,
			undefined,
			'not a block',
			{ wrongType: 'block' },
		];

		const simpleOp: PortableTextOperation[] = [{ type: 'delete', index: 0 }];

		// Should handle malformed blocks gracefully
		// deno-lint-ignore no-explicit-any
		const { operationResults: malformedResults } = applyOperationsToPortableText(malformedBlocks as any, simpleOp);
		assertEquals(malformedResults[0].success, false);
	},
});

Deno.test({
	name: 'performance and stress tests',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		// Test with large number of blocks
		const largeBlockCount = 5000;
		const largeBlocks = Array.from(
			{ length: largeBlockCount },
			(_, i) => createPortableTextBlock(`block${i}`, `Content ${i}`),
		);

		// Test various operations on large dataset
		const largeOps: PortableTextOperation[] = [
			{ type: 'insert', position: 0, block: createPortableTextBlock('start', 'Start block') },
			{ type: 'insert', position: largeBlockCount + 1, block: createPortableTextBlock('end', 'End block') },
			{ type: 'update', index: largeBlockCount / 2, content: createPortableTextBlock('middle', 'Middle update') },
			{ type: 'delete', index: largeBlockCount - 1 },
			{ type: 'move', from: 0, to: largeBlockCount },
		];

		const startTime = performance.now();
		const { modifiedBlocks, operationResults } = applyOperationsToPortableText(largeBlocks, largeOps);
		const endTime = performance.now();

		// Verify operations completed successfully
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);
		assertEquals(modifiedBlocks.length, largeBlockCount + 1); // +2 inserts, -1 delete

		// Performance should be reasonable (less than 1 second for 5000 blocks)
		const executionTime = endTime - startTime;
		assert(executionTime < 1000, `Execution took too long: ${executionTime}ms`);

		// Test with many operations on smaller dataset
		const manyOpsCount = 1000;
		const smallBlocks = Array.from({ length: 100 }, (_, i) => createPortableTextBlock(`block${i}`, `Content ${i}`));

		const manyOps: PortableTextOperation[] = Array.from({ length: manyOpsCount }, (_, i) => {
			const opType = ['update', 'insert', 'delete', 'move'][i % 4] as 'update' | 'insert' | 'delete' | 'move';
			switch (opType) {
				case 'update':
					return {
						type: 'update',
						index: i % 100,
						content: createPortableTextBlock(`updated${i}`, `Updated ${i}`),
					};
				case 'insert':
					return {
						type: 'insert',
						position: Math.min(i % 50, 100),
						block: createPortableTextBlock(`inserted${i}`, `Inserted ${i}`),
					};
				case 'delete':
					return { type: 'delete', index: 0 }; // Always delete first (which changes)
				case 'move':
					return { type: 'move', from: 0, to: Math.min(1, 99) };
				default:
					return {
						type: 'update',
						index: 0,
						content: createPortableTextBlock(`fallback${i}`, `Fallback ${i}`),
					};
			}
		});

		const { operationResults: manyResults } = applyOperationsToPortableText(smallBlocks, manyOps);

		// Some operations may fail due to array bounds, but shouldn't crash
		assertEquals(manyResults.length, manyOpsCount);
		assertEquals(manyResults.every((r: PortableTextOperationResult) => typeof r.success === 'boolean'), true);
	},
});

Deno.test({
	name: 'complex real-world scenarios',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		// Simulate a complex document editing session
		const initialDocument = [
			createPortableTextBlock('title', 'Document Title', 'h1'),
			createPortableTextBlock('intro', 'Introduction paragraph with some text.'),
			createListBlock('item1', 'First bullet point', 'bullet'),
			createListBlock('item2', 'Second bullet point', 'bullet'),
			createPortableTextBlock('content', 'Main content paragraph.'),
			createCodeBlock('code1', 'console.log("example");', 'javascript'),
			createImageBlock('img1', 'Example image', 'https://example.com/image.jpg'),
			createPortableTextBlock('conclusion', 'Conclusion paragraph.'),
		];

		// Scenario 1: Reorganize document structure
		const reorganizeOps: PortableTextOperation[] = [
			// Move image before code block
			{ type: 'move', fromKey: 'img1', toPosition: 5 },
			// Update title
			{
				type: 'update',
				_key: 'title',
				content: createPortableTextBlock('title', 'Updated Document Title', 'h1'),
			},
			// Insert new section header
			{ type: 'insert', position: 4, block: createPortableTextBlock('section', 'Technical Details', 'h2') },
			// Delete second bullet point
			{ type: 'delete', _key: 'item2' },
		];

		let { modifiedBlocks, operationResults } = applyOperationsToPortableText(initialDocument, reorganizeOps);
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);
		assertEquals(modifiedBlocks.length, 8); // 8 original + 1 insert - 1 delete

		// Scenario 2: Content editing workflow
		const editingOps: PortableTextOperation[] = [
			// Add new content at the beginning
			{
				type: 'insert',
				position: 1,
				block: createPortableTextBlock('abstract', 'Abstract: This document covers...'),
			},
			// Update existing content
			{
				type: 'update',
				_key: 'intro',
				content: createPortableTextBlock('intro', 'Revised introduction with more details.'),
			},
			// Add more list items
			{ type: 'insert', position: 4, block: createListBlock('item3', 'Additional bullet point', 'bullet') },
			{ type: 'insert', position: 5, block: createListBlock('item4', 'Another bullet point', 'bullet') },
			// Update code block
			{
				type: 'update',
				_key: 'code1',
				content: createCodeBlock(
					'code1',
					'const message = "updated example";\nconsole.log(message);',
					'javascript',
				),
			},
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(modifiedBlocks, editingOps));
		assertEquals(operationResults.every((r: { success: boolean }) => r.success), true);

		// Scenario 3: Error recovery - mixed success/failure operations
		const mixedOps: PortableTextOperation[] = [
			// This should work
			{ type: 'insert', position: 0, block: createPortableTextBlock('header', 'Document Header', 'h1') },
			// This should fail - invalid position
			{ type: 'insert', position: 999, block: createPortableTextBlock('invalid', 'Should fail') },
			// This should work
			{
				type: 'update',
				_key: 'conclusion',
				content: createPortableTextBlock('conclusion', 'Updated conclusion.'),
			},
			// This should fail - non-existent key
			{ type: 'delete', _key: 'nonexistent' },
			// This should work
			{ type: 'move', from: 0, to: 1 },
		];

		({ modifiedBlocks, operationResults } = applyOperationsToPortableText(modifiedBlocks, mixedOps));
		assertEquals(operationResults[0].success, true);
		assertEquals(operationResults[1].success, false);
		assertEquals(operationResults[2].success, true);
		assertEquals(operationResults[3].success, false);
		assertEquals(operationResults[4].success, true);

		// Verify document integrity after mixed operations
		assert(modifiedBlocks.length > 0);
		assertEquals(modifiedBlocks.every((block: PortableTextBlock) => block._type !== undefined), true);
	},
});
