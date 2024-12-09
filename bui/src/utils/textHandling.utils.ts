import type { DisplaySuggestion } from '../types/suggestions.types.ts';

/**
 * Gets text position information for inserting suggestions
 */
export interface TextPosition {
	start: number; // Start of text to replace
	end: number; // End of text to replace
	beforeText: string; // Text before replacement
	afterText: string; // Text after replacement
	isInline: boolean; // True if cursor is not at end
}

/**
 * Gets text position information for inserting suggestions
 */
export function getTextPositions(text: string, cursorPos: number): TextPosition {
	const beforeCursor = text.slice(0, cursorPos);
	const afterCursor = text.slice(cursorPos);

	// Find the last path or word before cursor
	// Match includes path separators but stops at quotes or spaces
	const beforeMatch = beforeCursor.match(/[^\s"'`]+$/); // Last word/path before cursor
	const afterMatch = afterCursor.match(/^[^\s"'`]*/); // Rest of word/path after cursor

	// console.debug('TextHandling: getTextPositions analysis', {
	// 	text,
	// 	cursorPos,
	// 	beforeCursor,
	// 	afterCursor,
	// 	beforeMatch,
	// 	afterMatch,
	// });

	// No word at cursor
	if (!beforeMatch && !afterMatch) {
		return {
			start: cursorPos,
			end: cursorPos,
			beforeText: beforeCursor,
			afterText: afterCursor,
			isInline: cursorPos < text.length,
		};
	}

	// Calculate word boundaries including path separators
	const wordStart = beforeMatch ? cursorPos - beforeMatch[0].length : cursorPos;
	const wordEnd = cursorPos + (afterMatch ? afterMatch[0].length : 0);

	return {
		start: wordStart,
		end: wordEnd,
		beforeText: text.slice(0, wordStart),
		afterText: text.slice(wordEnd),
		isInline: cursorPos < text.length,
	};
}

/**
 * Formats a path for insertion into text, handling backticks and list items
 */
export function formatPathForInsertion(path: string, pos: TextPosition): string {
	const wrappedPath = pos.isInline ? `\`${path}\`` : `\`${path}\``;

	// If on empty line, make it a list item
	if (pos.beforeText.trim() === '' && pos.afterText.trim() === '') {
		return `- ${wrappedPath}`;
	}

	return pos.beforeText + wrappedPath + pos.afterText;
}

/**
 * Processes suggestions into display format
 */
export function processSuggestions(
	suggestions: Array<{
		path: string;
		isDirectory: boolean;
		size?: number;
		modified?: string;
	}>,
): DisplaySuggestion[] {
	return suggestions
		.map((suggestion) => ({
			...suggestion,
			display: suggestion.path.split(/[\\/]/).pop() || suggestion.path,
			parent: suggestion.path.split(/[\\/]/).slice(0, -1).join('/') || '/',
		}))
		.sort((a, b) => {
			// Sort directories first
			if (a.isDirectory !== b.isDirectory) {
				return a.isDirectory ? -1 : 1;
			}
			// Then by display name
			return a.display.localeCompare(b.display);
		});
}
