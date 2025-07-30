/**
 * Portable Text mutator utility
 *
 * Provides generic operations for manipulating Portable Text blocks including
 * update, insert, delete, and move operations. This utility is independent
 * of any specific data source and can be used with any Portable Text implementation.
 */

import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import type {
	PortableTextBlock,
	//PortableTextSpan,
	PortableTextOperation,
	PortableTextOperationResult,
} from 'api/types/portableText.ts';

/**
 * Apply operations to Portable Text blocks
 * @param blocks Original blocks
 * @param operations Operations to apply
 * @returns Modified blocks and operation results
 */
export function applyOperationsToPortableText(
	blocks: PortableTextBlock[],
	operations: PortableTextOperation[],
): { modifiedBlocks: PortableTextBlock[]; operationResults: PortableTextOperationResult[] } {
	const modifiedBlocks = [...blocks];
	const operationResults: PortableTextOperationResult[] = [];

	for (const [index, operation] of operations.entries()) {
		try {
			switch (operation.type) {
				case 'update':
					operationResults.push(applyUpdateOperation(modifiedBlocks, operation, index));
					break;
				case 'insert':
					operationResults.push(applyInsertOperation(modifiedBlocks, operation, index));
					break;
				case 'delete':
					operationResults.push(applyDeleteOperation(modifiedBlocks, operation, index));
					break;
				case 'move':
					operationResults.push(applyMoveOperation(modifiedBlocks, operation, index));
					break;
				default:
					operationResults.push({
						operationIndex: index,
						type: operation.type,
						success: false,
						message: `Unsupported operation type: ${operation.type}`,
					});
			}
		} catch (error) {
			logger.warn(`PortableTextMutator: Operation ${index} failed: ${errorMessage(error)}`);
			operationResults.push({
				operationIndex: index,
				type: operation.type,
				success: false,
				message: `Operation failed: ${errorMessage(error)}`,
				error: errorMessage(error),
			});
		}
	}

	return { modifiedBlocks, operationResults };
}

/**
 * Apply update operation to blocks
 */
function applyUpdateOperation(
	blocks: PortableTextBlock[],
	operation: PortableTextOperation,
	operationIndex: number,
): PortableTextOperationResult {
	if (!operation.content) {
		return {
			operationIndex,
			type: 'update',
			success: false,
			message: 'Update operation requires content',
		};
	}

	let targetIndex = -1;

	// Find block by index or _key
	if (typeof operation.index === 'number') {
		if (operation.index >= 0 && operation.index < blocks.length) {
			targetIndex = operation.index;
		}
	} else if (operation._key) {
		targetIndex = blocks.findIndex((block) => block._key === operation._key);
	}

	if (targetIndex === -1) {
		return {
			operationIndex,
			type: 'update',
			success: false,
			message: `Block not found for update operation (index: ${operation.index}, key: ${operation._key})`,
		};
	}

	// Update the block
	blocks[targetIndex] = { ...operation.content };

	return {
		operationIndex,
		type: 'update',
		success: true,
		message: `Updated block at index ${targetIndex}`,
		originalIndex: targetIndex,
		affectedKey: operation.content._key,
	};
}

/**
 * Apply insert operation to blocks
 */
function applyInsertOperation(
	blocks: PortableTextBlock[],
	operation: PortableTextOperation,
	operationIndex: number,
): PortableTextOperationResult {
	if (!operation.block) {
		return {
			operationIndex,
			type: 'insert',
			success: false,
			message: 'Insert operation requires block',
		};
	}

	const position = operation.position ?? blocks.length;

	if (position < 0 || position > blocks.length) {
		return {
			operationIndex,
			type: 'insert',
			success: false,
			message: `Invalid insert position: ${position} (valid range: 0-${blocks.length})`,
		};
	}

	// Insert the block
	blocks.splice(position, 0, operation.block);

	return {
		operationIndex,
		type: 'insert',
		success: true,
		message: `Inserted block at position ${position}`,
		newIndex: position,
		affectedKey: operation.block._key,
	};
}

/**
 * Apply delete operation to blocks
 */
function applyDeleteOperation(
	blocks: PortableTextBlock[],
	operation: PortableTextOperation,
	operationIndex: number,
): PortableTextOperationResult {
	let targetIndex = -1;

	// Find block by index or _key
	if (typeof operation.index === 'number') {
		if (operation.index >= 0 && operation.index < blocks.length) {
			targetIndex = operation.index;
		}
	} else if (operation._key) {
		targetIndex = blocks.findIndex((block) => block._key === operation._key);
	}

	if (targetIndex === -1) {
		return {
			operationIndex,
			type: 'delete',
			success: false,
			message: `Block not found for delete operation (index: ${operation.index}, key: ${operation._key})`,
		};
	}

	// Store the key before deletion
	const deletedKey = blocks[targetIndex]._key;

	// Delete the block
	blocks.splice(targetIndex, 1);

	return {
		operationIndex,
		type: 'delete',
		success: true,
		message: `Deleted block at index ${targetIndex}`,
		originalIndex: targetIndex,
		affectedKey: deletedKey,
	};
}

/**
 * Apply move operation to blocks
 */
function applyMoveOperation(
	blocks: PortableTextBlock[],
	operation: PortableTextOperation,
	operationIndex: number,
): PortableTextOperationResult {
	let fromIndex = -1;
	let toIndex = -1;

	// Find source block
	if (typeof operation.from === 'number') {
		if (operation.from >= 0 && operation.from < blocks.length) {
			fromIndex = operation.from;
		}
	} else if (operation.fromKey) {
		fromIndex = blocks.findIndex((block) => block._key === operation.fromKey);
	}

	// Find target position
	if (typeof operation.to === 'number') {
		toIndex = operation.to;
	} else if (typeof operation.toPosition === 'number') {
		toIndex = operation.toPosition;
	}

	if (fromIndex === -1) {
		return {
			operationIndex,
			type: 'move',
			success: false,
			message:
				`Source block not found for move operation (from: ${operation.from}, fromKey: ${operation.fromKey})`,
		};
	}

	if (toIndex === -1 || toIndex < 0 || toIndex > blocks.length) {
		return {
			operationIndex,
			type: 'move',
			success: false,
			message: `Invalid target position for move operation: ${toIndex} (valid range: 0-${blocks.length})`,
		};
	}

	if (fromIndex === toIndex) {
		return {
			operationIndex,
			type: 'move',
			success: false,
			message: `Source and target positions are the same: ${fromIndex}`,
		};
	}

	// Move the block
	const [movedBlock] = blocks.splice(fromIndex, 1);
	const actualToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
	blocks.splice(actualToIndex, 0, movedBlock);

	return {
		operationIndex,
		type: 'move',
		success: true,
		message: `Moved block from index ${fromIndex} to ${actualToIndex}`,
		originalIndex: fromIndex,
		newIndex: actualToIndex,
		affectedKey: movedBlock._key,
	};
}

/**
 * Validate a Portable Text operation
 * @param operation The operation to validate
 * @returns True if the operation is valid, false otherwise
 */
export function validatePortableTextOperation(operation: PortableTextOperation): boolean {
	if (!operation.type || !['update', 'insert', 'delete', 'move'].includes(operation.type)) {
		return false;
	}

	switch (operation.type) {
		case 'update':
			return !!(operation.content && (typeof operation.index === 'number' || operation._key));
		case 'insert':
			return !!(operation.block && typeof operation.position === 'number');
		case 'delete':
			return !!(typeof operation.index === 'number' || operation._key);
		case 'move':
			return !!((typeof operation.from === 'number' || operation.fromKey) &&
				(typeof operation.to === 'number' || typeof operation.toPosition === 'number'));
		default:
			return false;
	}
}

/**
 * Find a block by key in an array of Portable Text blocks
 * @param blocks Array of blocks to search
 * @param key The key to search for
 * @returns The index of the block, or -1 if not found
 */
export function findBlockByKey(blocks: PortableTextBlock[], key: string): number {
	return blocks.findIndex((block) => block._key === key);
}

/**
 * Get a summary of operations to be applied
 * @param operations Array of operations
 * @returns Summary string
 */
export function summarizeOperations(operations: PortableTextOperation[]): string {
	const summary = operations.map((op, index) => {
		switch (op.type) {
			case 'update':
				return `#${index}: Update block ${op.index ?? op._key}`;
			case 'insert':
				return `#${index}: Insert block at position ${op.position}`;
			case 'delete':
				return `#${index}: Delete block ${op.index ?? op._key}`;
			case 'move':
				return `#${index}: Move block from ${op.from ?? op.fromKey} to ${op.to ?? op.toPosition}`;
			default:
				return `#${index}: Unknown operation type`;
		}
	}).join(', ');

	return `${operations.length} operations: ${summary}`;
}
