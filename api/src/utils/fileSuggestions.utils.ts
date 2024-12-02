import { globToRegExp } from '@std/path';
import { walk } from '@std/fs';
import { relative } from '@std/path';
import { createExcludeRegexPatterns, getExcludeOptions, isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
//import type { DisplaySuggestion } from '../../../bui/src/types/suggestions.types.ts';
import { logger } from 'shared/logger.ts';

export interface PatternOptions {
	caseSensitive?: boolean;
	type?: 'all' | 'file' | 'directory';
}

export interface FileSuggestionsOptions {
	partialPath: string;
	startDir: string;
	limit?: number;
	caseSensitive?: boolean;
	type?: 'all' | 'file' | 'directory';
}

export interface FileSuggestion {
	path: string;
	isDirectory: boolean;
	size?: number;
	modified?: string;
}

export interface FileSuggestionsResponse {
	suggestions: Array<FileSuggestion>;
	hasMore: boolean;
}

/**
 * Main function to get file suggestions based on partial path
 */
export async function suggestFiles(options: FileSuggestionsOptions): Promise<FileSuggestionsResponse> {
	const { partialPath, startDir, limit = 50, caseSensitive = false, type = 'all' } = options;

	// logger.info('SuggestionPatterns: Getting suggestions', { partialPath, startDir, limit, caseSensitive, type });

	// Validate path is within project
	if (!isPathWithinProject(startDir, partialPath)) {
		throw createError(ErrorType.FileHandling, 'Path outside project directory');
	}

	// Remove leading slash as it's just a trigger, not part of the pattern
	const searchPath = partialPath.replace(/^\//, '');
	// logger.info('SuggestionPatterns: Normalized search path', { searchPath });

	// Get exclude patterns
	const excludeOptions = await getExcludeOptions(startDir);
	const excludePatterns = createExcludeRegexPatterns(excludeOptions, startDir);
	// logger.debug('SuggestionPatterns: Using exclude patterns', excludePatterns.map((p) => p.toString()));

	// Generate patterns for matching
	const patterns = createSuggestionPatterns(searchPath, { caseSensitive, type });
	if (patterns.length === 0) {
		logger.info('SuggestionPatterns: No valid patterns generated');
		return { suggestions: [], hasMore: false };
	}

	// logger.info('SuggestionPatterns: Generated patterns', patterns.map((p) => p.toString()));

	// // Test some known paths to verify pattern matching
	// const testPaths = ['docs', 'docs/', 'docs/README.md', 'api/docs/example.md'];
	// for (const testPath of testPaths) {
	// 	logger.debug('SuggestionPatterns: Testing pattern against known path', {
	// 		path: testPath,
	// 		matches: patterns.map((p) => ({ pattern: p.toString(), matches: p.test(testPath) })),
	// 	});
	// }

	// Collect matching files
	const results: Array<{
		path: string;
		isDirectory: boolean;
		size?: number;
		modified?: string;
	}> = [];

	let reachedLimit = false;

	try {
		//logger.debug('SuggestionPatterns: Starting file walk', { startDir });
		for await (
			const entry of walk(startDir, {
				includeDirs: true,
				followSymlinks: false,
				match: patterns,
				skip: excludePatterns,
			})
		) {
			// Check limit before adding
			if (results.length >= limit) {
				//logger.debug('SuggestionPatterns: Reached result limit', { limit });
				reachedLimit = true;
				break;
			}

			const stat = await Deno.stat(entry.path);
			const relativePath = relative(startDir, entry.path);
			// logger.debug('SuggestionPatterns: Testing path', {
			// 	path: relativePath,
			// 	matches: patterns.map((p) => ({ pattern: p.toString(), matches: p.test(relativePath) })),
			// });

			results.push({
				path: relativePath,
				isDirectory: stat.isDirectory,
				size: stat.size,
				modified: stat.mtime?.toISOString(),
			});
		}
	} catch (error) {
		logger.error('SuggestionPatterns: Error walking directory', error);
		throw createError(
			ErrorType.FileHandling,
			`Error walking directory: ${(error as Error).message}`,
		);
	}

	// logger.info('SuggestionPatterns: Found matches', {
	// 	count: results.length,
	// 	hasMore: reachedLimit,
	// 	patterns: patterns.map((p) => p.toString()),
	// });

	// Apply type filtering if specified
	const filteredResults = results.filter((entry) => {
		if (type === 'directory') return entry.isDirectory;
		if (type === 'file') return !entry.isDirectory;
		return true;
	});

	return {
		suggestions: filteredResults,
		hasMore: reachedLimit,
	};
}

/**
 * Creates an array of RegExp patterns for matching file suggestions based on partial path input
 */
export function createSuggestionPatterns(
	partialPath: string,
	options: PatternOptions = {},
): RegExp[] {
	// Normalize path separators to forward slashes
	partialPath = partialPath.replace(/\\/g, '/');
	// logger.info('SuggestionPatterns: Creating patterns for path', { partialPath, options });

	// Reject paths trying to escape project root
	if (partialPath.includes('../') || partialPath.includes('..\\')) {
		logger.warn('SuggestionPatterns: Rejecting path that tries to escape root', { partialPath });
		return [];
	}

	const patterns: RegExp[] = [];
	const globOptions = {
		flags: options.caseSensitive ? '' : 'i',
		extended: true,
		globstar: true,
	};

	// Helper to create regex with proper case sensitivity
	const createRegex = (pattern: string) => {
		const flags = options.caseSensitive ? '' : 'i';
		return new RegExp(pattern, flags);
	};

	// Handle empty input
	if (!partialPath) {
		const rootPattern = '**/*';
		// logger.info('SuggestionPatterns: Creating root pattern', { rootPattern });
		// Match all files at any depth
		patterns.push(globToRegExp(rootPattern, globOptions));

		if (options.type !== 'file') {
			const rootDirPattern = '*/';
			// logger.info('SuggestionPatterns: Creating root directory pattern', { rootDirPattern });
			patterns.push(globToRegExp(rootDirPattern, globOptions));
		}
		return patterns;
	}

	// Handle brace expansion and multiple patterns
	const expandBraces = (pattern: string): string[] => {
		const match = pattern.match(/{([^}]+)}/);
		if (!match) return [pattern];

		const [fullMatch, alternatives] = match;
		const parts = alternatives.split(',').map((p) => p.trim());

		// Create a regex-compatible OR group
		const orGroup = `(${parts.join('|')})`;
		return [pattern.replace(fullMatch, orGroup)];
	};

	// Split by | and handle brace expansion
	const subPatterns = partialPath
		.split('|')
		.flatMap((pattern) => expandBraces(pattern));

	for (const pattern of subPatterns) {
		let singlePattern = pattern;
		// logger.info('SuggestionPatterns: Processing pattern', { original: pattern });

		// Handle directory patterns
		if (
			singlePattern.endsWith('/') ||
			(!singlePattern.includes('*') && !singlePattern.includes('.') && !singlePattern.includes('{') &&
				!singlePattern.includes('('))
		) {
			// For directory patterns (ending with / or no extension), match:
			// 1. The directory itself
			// 2. Everything under this directory
			singlePattern = singlePattern.slice(0, -1);

			// Match the directory itself and its contents
			const dirPattern = singlePattern.includes('**') ? `${singlePattern}/**/*` : `**/${singlePattern}*/**/*`;
			// logger.info('SuggestionPatterns: Created directory contents pattern', { dirPattern });
			patterns.push(createRegex(globToRegExp(dirPattern, globOptions).source));
		}

		// Handle bare filename (no path, no wildcards)
		if (!singlePattern.includes('/') && !singlePattern.includes('*')) {
			// Match directories that start with the pattern
			const dirPattern = `**/${singlePattern}*/`;
			// logger.info('SuggestionPatterns: Created directory match pattern', { dirPattern });
			patterns.push(globToRegExp(dirPattern, globOptions));

			// Match files under directories that start with the pattern
			const filesPattern = `**/${singlePattern}*/**/*`;
			// logger.info('SuggestionPatterns: Created files match pattern', { filesPattern });
			patterns.push(globToRegExp(filesPattern, globOptions));
		}

		// Handle wildcard patterns
		if (singlePattern.includes('*')) {
			if (singlePattern.includes('**')) {
				// Double-star pattern - ensure proper path handling
				// logger.info('SuggestionPatterns: Using double-star pattern', { singlePattern });
				// Add **/ prefix if pattern doesn't start with it
				const prefixedPattern = singlePattern.startsWith('**/') ? singlePattern : `**/${singlePattern}`;
				const pattern = globToRegExp(prefixedPattern, { ...globOptions, globstar: true });
				// logger.debug('SuggestionPatterns: Created pattern', {
				// 	original: singlePattern,
				// 	prefixed: prefixedPattern,
				// 	pattern: pattern.toString(),
				// 	testPaths: {
				// 		'docs/README.md': pattern.test('docs/README.md'),
				// 		'docs/development/guide.md': pattern.test('docs/development/guide.md'),
				// 	},
				// });
				patterns.push(pattern);
			} else {
				// Simple wildcard - handle file extension patterns differently
				if (singlePattern.includes('.')) {
					// File pattern - add **/ prefix only
					const prefixedPattern = `**/${singlePattern}`;
					// logger.info('SuggestionPatterns: Added **/ prefix to file pattern', { singlePattern });
					patterns.push(createRegex(globToRegExp(prefixedPattern, globOptions).source));
				} else {
					// Directory pattern - match both the directory and its contents
					const dirPattern = `**/${singlePattern}`;
					const contentsPattern = `**/${singlePattern}/**/*`;
					// logger.info('SuggestionPatterns: Created directory and contents patterns', {
					// 	dirPattern,
					// 	contentsPattern,
					// });
					patterns.push(globToRegExp(dirPattern, globOptions));
					patterns.push(globToRegExp(contentsPattern, globOptions));
				}
			}
		}
	}

	// logger.info('SuggestionPatterns: Final patterns', {
	// 	path: partialPath,
	// 	patterns: patterns.map((p) => p.toString()),
	// });
	return patterns;
}
