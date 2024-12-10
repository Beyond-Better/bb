import { globToRegExp } from '@std/path';
import { walk } from '@std/fs';
import { relative } from '@std/path';
import { createExcludeRegexPatterns, getExcludeOptions, isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { getProjectRoot } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';

export interface PatternOptions {
	caseSensitive?: boolean;
	type?: 'all' | 'file' | 'directory';
}

export interface FileSuggestionsOptions {
	partialPath: string;
	projectId: string;
	limit?: number;
	caseSensitive?: boolean;
	type?: 'all' | 'file' | 'directory';
}

export interface FileSuggestionsForPathOptions {
	partialPath: string;
	rootPath: string;
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
 * Main function to get file suggestions based on partial path and project ID
 */
export async function suggestFiles(options: FileSuggestionsOptions): Promise<FileSuggestionsResponse> {
	const { partialPath, projectId, limit, caseSensitive, type } = options;

	const projectRoot = await getProjectRoot(projectId);

	// Validate path is within project
	if (!isPathWithinProject(projectRoot, partialPath)) {
		throw createError(ErrorType.FileHandling, 'Path outside project directory');
	}

	return suggestFilesForPath({
		partialPath,
		rootPath: projectRoot,
		limit,
		caseSensitive,
		type,
	});
}

/**
 * Get file suggestions based on partial path and root directory
 */
export async function suggestFilesForPath(options: FileSuggestionsForPathOptions): Promise<FileSuggestionsResponse> {
	const { partialPath, rootPath, limit = 50, caseSensitive = false, type = 'all' } = options;

	// Remove leading slash as it's just a trigger, not part of the pattern
	const searchPath = partialPath.replace(/^\//, '');

	// Get exclude patterns
	const excludeOptions = await getExcludeOptions(rootPath);
	const excludePatterns = createExcludeRegexPatterns(excludeOptions, rootPath);

	// Generate patterns for matching
	const patterns = createSuggestionPatterns(searchPath, { caseSensitive, type });
	if (patterns.length === 0) {
		logger.info('SuggestionPatterns: No valid patterns generated');
		return { suggestions: [], hasMore: false };
	}

	// Collect matching files
	const results: Array<{
		path: string;
		isDirectory: boolean;
		size?: number;
		modified?: string;
	}> = [];

	let reachedLimit = false;

	try {
		for await (
			const entry of walk(rootPath, {
				includeDirs: true,
				followSymlinks: false,
				match: patterns,
				skip: excludePatterns,
			})
		) {
			// Check limit before adding
			if (results.length >= limit) {
				reachedLimit = true;
				break;
			}

			const stat = await Deno.stat(entry.path);
			const relativePath = relative(rootPath, entry.path);

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

	// Reject paths trying to escape root
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
		patterns.push(globToRegExp(rootPattern, globOptions));

		if (options.type !== 'file') {
			const rootDirPattern = '*/';
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

		// Handle directory patterns
		if (
			singlePattern.endsWith('/') ||
			(!singlePattern.includes('*') && !singlePattern.includes('.') && !singlePattern.includes('{') &&
				!singlePattern.includes('('))
		) {
			singlePattern = singlePattern.slice(0, -1);
			const dirPattern = singlePattern.includes('**') ? `${singlePattern}/**/*` : `**/${singlePattern}*/**/*`;
			patterns.push(createRegex(globToRegExp(dirPattern, globOptions).source));
		}

		// Handle bare filename (no path, no wildcards)
		if (!singlePattern.includes('/') && !singlePattern.includes('*')) {
			const dirPattern = `**/${singlePattern}*/`;
			patterns.push(globToRegExp(dirPattern, globOptions));

			const filesPattern = `**/${singlePattern}*/**/*`;
			patterns.push(globToRegExp(filesPattern, globOptions));
		}

		// Handle wildcard patterns
		if (singlePattern.includes('*')) {
			if (singlePattern.includes('**')) {
				const prefixedPattern = singlePattern.startsWith('**/') ? singlePattern : `**/${singlePattern}`;
				const pattern = globToRegExp(prefixedPattern, { ...globOptions, globstar: true });
				patterns.push(pattern);
			} else {
				if (singlePattern.includes('.')) {
					const prefixedPattern = `**/${singlePattern}`;
					patterns.push(createRegex(globToRegExp(prefixedPattern, globOptions).source));
				} else {
					const dirPattern = `**/${singlePattern}`;
					const contentsPattern = `**/${singlePattern}/**/*`;
					patterns.push(globToRegExp(dirPattern, globOptions));
					patterns.push(globToRegExp(contentsPattern, globOptions));
				}
			}
		}
	}

	return patterns;
}