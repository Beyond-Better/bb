import { SEPARATOR, SEPARATOR_PATTERN } from '@std/path';

/**
 * Convert a path to use Unix-style forward slashes for client display
 * @param path The path to convert
 * @returns Path with forward slashes
 */
export function toUnixPath(path: string): string {
	if (!path || path === '.') return path;

	// If we're on Windows (backslash separator), replace with forward slashes
	//return SEPARATOR === '\\' ? path.replace(/\\/g, '/') : path;
	// replace all separators with our preference
	return path.replace(SEPARATOR_PATTERN, '/');
}
