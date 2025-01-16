import { SEPARATOR_PATTERN } from '@std/path';

/**
 * Format a path for display by adding spaces around path separators
 * @param path The path to format
 * @param pathSeparator The separator to use in the formatted path (defaults to '/')
 * @returns Formatted path with spaces around separators
 */
export function formatPathForDisplay(path: string, pathSeparator: string = '/'): string {
	if (!path || path === '.') return path;

	// First normalize all separators to the desired one
	const normalized = path.replace(SEPARATOR_PATTERN, pathSeparator);

	// Then add spaces around each separator
	const spaced = normalized.split(pathSeparator).join(` ${pathSeparator} `);

	// Clean up any extra spaces
	return spaced.replace(/\s+/g, ' ').trim();
}
