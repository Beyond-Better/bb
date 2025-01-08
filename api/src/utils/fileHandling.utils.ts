import { join, normalize, relative, resolve } from '@std/path';
//import { TextLineStream } from '@std/streams';
import { LRUCache } from 'npm:lru-cache';
import { exists, walk } from '@std/fs';
import type { WalkOptions } from '@std/fs';
import globToRegExp from 'npm:glob-to-regexp';
//import { globToRegExp } from '@std/path';

import { logger } from 'shared/logger.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';

function createMatchRegexPatterns(matchPattern: string, projectRoot: string): RegExp[] {
	// Split the pattern by '|' to handle multiple patterns
	const patterns = matchPattern.split('|');

	return patterns.map((singlePattern) => {
		// Handle directory patterns
		if (singlePattern.endsWith('/')) {
			singlePattern += '**';
		}

		// Handle simple wildcard patterns
		if (singlePattern.includes('*') && !singlePattern.includes('**')) {
			// we were just changing '*' to '**' - why was that needed (it wasn't working to match subdirectories)
			// [TODO] add more tests to search_project test to check for more complex file patterns with deeply nested sub directories
			// singlePattern = singlePattern.split('*').join('**');
			singlePattern = `**/${singlePattern}`;
		}

		// Handle bare filename (no path, no wildcards)
		if (!singlePattern.includes('/') && !singlePattern.includes('*')) {
			singlePattern = `**/${singlePattern}`;
		}

		// Prepend projectRoot to the pattern
		const fullPattern = join(projectRoot, singlePattern);
		logger.info(
			`FileHandlingUtil: createMatchRegexPatterns - creating regex from file pattern: ${fullPattern}`,
		);

		return globToRegExp(fullPattern, { extended: true, globstar: true });
		// const regexPattern = globToRegExp(fullPattern, { extended: true, globstar: true });
		// logger.info(
		// 	`FileHandlingUtil: createMatchRegexPatterns - using regex: `, regexPattern,
		// );
		// return regexPattern;
	});
}

export function createExcludeRegexPatterns(excludePatterns: string[], projectRoot: string): RegExp[] {
	return excludePatterns.flatMap((pattern) => {
		// Handle negation patterns
		if (pattern.startsWith('!')) {
			return [globToRegExp(pattern.slice(1), { extended: true, globstar: true })];
		}

		// Split the pattern by '|' to handle multiple patterns
		const patterns = pattern.split('|');

		return patterns.map((singlePattern) => {
			// Handle directory patterns
			if (singlePattern.endsWith('/')) {
				singlePattern += '**';
			}

			// Handle simple wildcard patterns
			if (singlePattern.includes('*') && !singlePattern.includes('**')) {
				singlePattern = `**/${singlePattern}`;
			}

			// Handle bare filename (no path, no wildcards)
			if (!singlePattern.includes('/') && !singlePattern.includes('*')) {
				singlePattern = `**/${singlePattern}`;
			}
			// Prepend projectRoot to the pattern
			const fullPattern = join(projectRoot, singlePattern);
			// logger.info(
			// 	`FileHandlingUtil: createExcludeRegexPatterns - creating regex from file pattern: ${fullPattern}`,
			// );

			return globToRegExp(fullPattern, { extended: true, globstar: true });
		});
	});
}

export async function getExcludeOptions(projectRoot: string): Promise<string[]> {
	const excludeFiles = [
		join(projectRoot, 'tags.ignore'),
		join(projectRoot, '.gitignore'),
		join(projectRoot, '.bb', 'ignore'),
		join(projectRoot, '.bb', 'tags.ignore'),
	];

	const patterns = ['.bb/*', '.git/*', '.trash/*'];
	for (const file of excludeFiles) {
		if (await exists(file)) {
			const content = await Deno.readTextFile(file);
			patterns.push(
				...content.split('\n')
					.map((line) => line.trim())
					.filter((line) => line && !line.startsWith('#'))
					.map((line) => line.replace(/^\/*/, '')), // Remove leading slashes
			);
		}
	}

	const uniquePatterns = [...new Set(patterns)];
	//logger.debug(`FileHandlingUtil: Exclude patterns for project: ${projectRoot}`, uniquePatterns);
	return uniquePatterns;
}

export async function isPathWithinProject(projectRoot: string, filePath: string): Promise<boolean> {
	const normalizedProjectRoot = normalize(projectRoot);
	const normalizedFilePath = normalize(filePath);
	const absoluteFilePath = resolve(normalizedProjectRoot, normalizedFilePath);

	try {
		// For existing files, resolve symlinks
		const resolvedPath = await Deno.realPath(absoluteFilePath);
		return resolvedPath.startsWith(await Deno.realPath(normalizedProjectRoot));
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			// For non-existing files, check if the absolute path is within the project root
			return absoluteFilePath.startsWith(normalizedProjectRoot);
		}
		// For other errors, re-throw
		throw error;
	}
}

export async function existsWithinProject(projectRoot: string, filePath: string): Promise<boolean> {
	const normalizedProjectRoot = normalize(projectRoot);
	const normalizedFilePath = normalize(filePath);
	const absoluteFilePath = resolve(normalizedProjectRoot, normalizedFilePath);
	logger.info(`FileHandlingUtil: Checking file exists in project ${projectRoot} - ${filePath}`);
	logger.info(`FileHandlingUtil: Checking file exists - absoluteFilePath ${absoluteFilePath}`);

	return await exists(absoluteFilePath);
	// [TODO] Using isReadable is causing tests to fail - is it a real error or some other problem
	//return await exists(absoluteFilePath, { isReadable: true });
}

export async function readProjectFileContent(projectRoot: string, filePath: string): Promise<string> {
	const fullFilePath = join(projectRoot, filePath);
	logger.info(`FileHandlingUtil: Reading contents of File ${fullFilePath}`);
	try {
		const content = await Deno.readTextFile(fullFilePath);
		return content;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			throw new Error(`File not found: ${fullFilePath}`);
		}
		throw error;
	}
}

export async function updateFile(projectRoot: string, filePath: string, _content: string): Promise<void> {
	if (!await isPathWithinProject(projectRoot, filePath)) {
		throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
			name: 'update-file',
			filePath,
			operation: 'write',
		} as FileHandlingErrorOptions);
	}

	// TODO: Implement file update logic
	logger.info(`FileHandlingUtil: File ${filePath} updated in the project`);
}

const searchCache = new LRUCache<string, string[]>({ max: 100 });

interface SearchFileOptions {
	filePattern?: string;
	dateAfter?: string;
	dateBefore?: string;
	sizeMin?: number;
	sizeMax?: number;
}

const MAX_CONCURRENT = 20; // Adjust based on system capabilities

export async function searchFilesContent(
	projectRoot: string,
	contentPattern: string,
	caseSensitive: boolean,
	searchFileOptions?: SearchFileOptions,
): Promise<{ files: string[]; errorMessage: string | null }> {
	const cacheKey = `${projectRoot}:${contentPattern}:${caseSensitive ? 'caseSensitive' : 'caseInsensitive'}:${
		JSON.stringify(searchFileOptions)
	}`;
	const cachedResult = searchCache.get(cacheKey);
	if (cachedResult) {
		logger.info(`FileHandlingUtil: Returning cached result for search: ${cacheKey}`);
		return { files: cachedResult, errorMessage: null };
	}
	const matchingFiles: string[] = [];
	logger.info(`FileHandlingUtil: Starting file content search in ${projectRoot} with pattern: ${contentPattern}`);

	let regex: RegExp;
	try {
		// We're only supporting 'g' and 'i' flags at present - there are a few more we can support if needed
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags
		//const regexFlags = `${!caseSensitive ? 'i' : ''}${replaceAll ? 'g' : ''}`;
		const regexFlags = `${caseSensitive ? '' : 'i'}`;
		regex = new RegExp(contentPattern, regexFlags);
	} catch (error) {
		logger.error(`FileHandlingUtil: Invalid regular expression: ${contentPattern}`);
		return { files: [], errorMessage: `Invalid regular expression: ${(error as Error).message}` };
	}

	try {
		const filesToProcess = [];

		const excludeOptions = await getExcludeOptions(projectRoot);
		const excludeOptionsRegex = createExcludeRegexPatterns(excludeOptions, projectRoot);
		const walkOptions: WalkOptions = {
			includeDirs: false,
			skip: excludeOptionsRegex,
		};

		// Add match option if file pattern is provided
		if (searchFileOptions?.filePattern) {
			logger.info(
				`FileHandlingUtil: searchFilesContent - search in ${projectRoot} with file pattern: ${searchFileOptions?.filePattern}`,
			);
			walkOptions.match = createMatchRegexPatterns(searchFileOptions.filePattern, projectRoot);
		}
		// logger.info(
		// 	`FileHandlingUtil: searchFilesContent - Searching ${projectRoot} using walkOptions: ${
		// 		JSON.stringify(walkOptions)
		// 	}`,
		// );

		for await (const entry of walk(projectRoot, walkOptions)) {
			const relativePath = relative(projectRoot, entry.path);

			filesToProcess.push({ path: entry.path, relativePath });
		}
		logger.info(`FileHandlingUtil: File content search starting. Found ${filesToProcess.length} to search.`);
		// logger.info(
		// 	`FileHandlingUtil: searchFilesContent - Searching ${projectRoot} found files to process: ${
		// 		JSON.stringify(filesToProcess)
		// 	}`,
		// );

		const results = await Promise.all(
			chunk(filesToProcess, MAX_CONCURRENT).map(async (batch) =>
				Promise.all(
					batch.map(({ path, relativePath }) => processFile(path, regex, searchFileOptions, relativePath)),
				)
			),
		);

		matchingFiles.push(...results.flat().filter((result): result is string => result !== null));

		logger.info(`FileHandlingUtil: File content search completed. Found ${matchingFiles.length} matching files.`);
		searchCache.set(cacheKey, matchingFiles);
		return { files: matchingFiles, errorMessage: null };
	} catch (error) {
		logger.error(`FileHandlingUtil: Error in searchFilesContent: ${(error as Error).message}`);
		return { files: [], errorMessage: (error as Error).message };
	}
}

function chunk<T>(array: T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size));
}

/*
async function processFileManualBuffer(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	try {
		const stat = await Deno.stat(filePath);

		if (!passesMetadataFilters(stat, searchFileOptions)) {
			logger.debug(`FileHandlingUtil: File ${relativePath} did not pass metadata filters`);
			return null;
		}

		file = await Deno.open(filePath);
		logger.debug(`FileHandlingUtil: File opened successfully: ${relativePath}`);

		const decoder = new TextDecoder();
		const buffer = new Uint8Array(1024); // Adjust buffer size as needed
		let leftover = '';

		while (true) {
			const bytesRead = await file.read(buffer);
			if (bytesRead === null) break; // End of file

			const chunk = decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
			const lines = (leftover + chunk).split('\n');
			leftover = lines.pop() || '';

			for (const line of lines) {
				if (regex.test(line)) {
					logger.debug(`FileHandlingUtil: Match found in file: ${relativePath}`);
					return relativePath;
				}
			}
		}

		// Check the last line
		if (leftover && regex.test(leftover)) {
			logger.debug(`FileHandlingUtil: Match found in file: ${relativePath}`);
			return relativePath;
		}

		logger.debug(`FileHandlingUtil: No match found in file: ${relativePath}`);
		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${error.message}`);
		return null;
	} finally {
		logger.debug(`FileHandlingUtil: Entering finally block for file: ${relativePath}`);
		if (file) {
			try {
				file.close();
				logger.debug(`FileHandlingUtil: File closed successfully: ${relativePath}`);
			} catch (closeError) {
				logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${closeError.message}`);
			}
		}
		logger.debug(`FileHandlingUtil: Exiting finally block for file: ${relativePath}`);
	}
}

async function processFileStreamLines(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	let reader: ReadableStreamDefaultReader<string> | null = null;
	try {
		const stat = await Deno.stat(filePath);

		if (!passesMetadataFilters(stat, searchFileOptions)) {
			logger.debug(`FileHandlingUtil: File ${relativePath} did not pass metadata filters`);
			return null;
		}

		file = await Deno.open(filePath);
		logger.debug(`FileHandlingUtil: File opened successfully: ${relativePath}`);
		const lineStream = file.readable
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(new TextLineStream());

		reader = lineStream.getReader();
		while (true) {
			const { done, value: line } = await reader.read();
			if (done) {
				logger.debug(`FileHandlingUtil: Finished reading file: ${relativePath}`);
				break;
			}
			if (regex.test(line)) {
				logger.debug(`FileHandlingUtil: Match found in file: ${relativePath}`);
				return relativePath;
			}
		}
		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${error.message}`);
		return null;
	} finally {
		logger.debug(`FileHandlingUtil: Entering finally block for file: ${relativePath}`);
		if (reader) {
			try {
				await reader.cancel();
				logger.debug(`FileHandlingUtil: Reader cancelled for file: ${relativePath}`);
			} catch (cancelError) {
				logger.warn(`FileHandlingUtil: Error cancelling reader for ${filePath}: ${cancelError.message}`);
			}
			reader.releaseLock();
			logger.debug(`FileHandlingUtil: Reader lock released for file: ${relativePath}`);
		}
		if (file) {
			try {
				file.close();
				logger.debug(`FileHandlingUtil: File closed successfully: ${relativePath}`);
			} catch (closeError) {
				if (closeError instanceof Deno.errors.BadResource) {
					logger.debug(`FileHandlingUtil: File was already closed: ${relativePath}`);
				} else {
					logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${closeError.message}`);
				}
			}
		}
		logger.debug(`FileHandlingUtil: Exiting finally block for file: ${relativePath}`);
	}
}

async function processFileStreamBuffer(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	let reader: ReadableStreamDefaultReader<string> | null = null;
	try {
		const stat = await Deno.stat(filePath);
		if (!passesMetadataFilters(stat, searchFileOptions)) {
			return null;
		}

		file = await Deno.open(filePath);
		const textStream = file.readable
			.pipeThrough(new TextDecoderStream());

		reader = textStream.getReader();
		let buffer = '';
		const maxBufferSize = 1024 * 1024; // 1MB, adjust as needed

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += value;

			// Check for matches
			if (regex.test(buffer)) {
				return relativePath;
			}

			// Trim buffer if it gets too large
			if (buffer.length > maxBufferSize) {
				buffer = buffer.slice(-maxBufferSize);
			}
		}

		// Final check on remaining buffer
		if (regex.test(buffer)) {
			return relativePath;
		}

		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${error.message}`);
		return null;
	} finally {
		if (reader) {
			try {
				await reader.cancel();
				reader.releaseLock();
			} catch (cancelError) {
				logger.warn(`FileHandlingUtil: Error cancelling reader for ${filePath}: ${cancelError.message}`);
			}
		}
		if (file) {
			try {
				file.close();
			} catch (closeError) {
				if (closeError instanceof Deno.errors.BadResource) {
					logger.debug(`FileHandlingUtil: File was already closed: ${relativePath}`);
				} else {
					logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${closeError.message}`);
				}
			}
		}
	}
}
 */

async function processFile(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
): Promise<string | null> {
	logger.debug(`FileHandlingUtil: Starting to process file: ${relativePath}`);
	let file: Deno.FsFile | null = null;
	let reader: ReadableStreamDefaultReader<string> | null = null;
	try {
		const stat = await Deno.stat(filePath);
		if (!passesMetadataFilters(stat, searchFileOptions)) {
			return null;
		}

		file = await Deno.open(filePath);
		const textStream = file.readable
			.pipeThrough(new TextDecoderStream());

		reader = textStream.getReader();
		let buffer = '';
		const maxBufferSize = 1024 * 1024; // 1MB, adjust as needed
		const overlapSize = 1024; // Size of overlap between buffers, adjust based on expected pattern size

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += value;

			// Check for matches
			if (regex.test(buffer)) {
				return relativePath;
			}

			// Trim buffer if it gets too large, keeping overlap
			if (buffer.length > maxBufferSize) {
				buffer = buffer.slice(-maxBufferSize - overlapSize);
			}
		}

		// Final check on remaining buffer
		if (regex.test(buffer)) {
			return relativePath;
		}

		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file ${filePath}: ${(error as Error).message}`);
		return null;
	} finally {
		if (reader) {
			try {
				await reader.cancel();
				reader.releaseLock();
			} catch (cancelError) {
				logger.warn(
					`FileHandlingUtil: Error cancelling reader for ${filePath}: ${(cancelError as Error).message}`,
				);
			}
		}
		if (file) {
			try {
				file.close();
			} catch (closeError) {
				if (closeError instanceof Deno.errors.BadResource) {
					logger.debug(`FileHandlingUtil: File was already closed: ${relativePath}`);
				} else {
					logger.warn(`FileHandlingUtil: Error closing file ${filePath}: ${(closeError as Error).message}`);
				}
			}
		}
	}
}

function passesMetadataFilters(stat: Deno.FileInfo, searchFileOptions: SearchFileOptions | undefined): boolean {
	if (!searchFileOptions) return true;
	if (searchFileOptions.dateAfter && stat.mtime && stat.mtime < new Date(searchFileOptions.dateAfter)) return false;
	if (searchFileOptions.dateBefore && stat.mtime && stat.mtime > new Date(searchFileOptions.dateBefore)) return false;
	if (searchFileOptions.sizeMin !== undefined && stat.size < searchFileOptions.sizeMin) return false;
	if (searchFileOptions.sizeMax !== undefined && stat.size > searchFileOptions.sizeMax) return false;
	return true;
}

export interface ListDirectoryOptions {
	only?: 'files' | 'directories';
	matchingString?: string;
	includeHidden?: boolean;
}
export interface ListDirectoryResponse {
	items: Array<{ name: string; path: string; isDirectory: boolean }>;
	errorMessage: string | null;
}

export async function listDirectory(
	rootDir: string,
	dirPath: string,
	options: ListDirectoryOptions = {},
): Promise<ListDirectoryResponse> {
	try {
		const fullPath = join(rootDir, dirPath);
		if (!await isPathWithinProject(rootDir, fullPath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${dirPath} is outside the project directory`);
		}

		const items: Array<{ name: string; path: string; isDirectory: boolean }> = [];
		const matchRegex = options.matchingString
			? globToRegExp(options.matchingString, { extended: true, globstar: true })
			: null;

		for await (const entry of Deno.readDir(fullPath)) {
			// Skip if filtering by type
			if (options.only === 'files' && entry.isDirectory) continue;
			if (options.only === 'directories' && !entry.isDirectory) continue;

			// Skip hidden files unless explicitly included
			if (!options.includeHidden && entry.name.startsWith('.')) continue;

			// Skip if doesn't match pattern
			if (matchRegex && !matchRegex.test(entry.name)) continue;

			const relativePath = join(dirPath, entry.name);
			items.push({
				name: entry.name,
				path: relativePath,
				isDirectory: entry.isDirectory,
			});
		}

		// Sort directories first, then alphabetically
		items.sort((a, b) => {
			if (a.isDirectory && !b.isDirectory) return -1;
			if (!a.isDirectory && b.isDirectory) return 1;
			return a.name.localeCompare(b.name);
		});

		return { items, errorMessage: null };
	} catch (error) {
		logger.error(`FileHandlingUtil: Error listing directory ${dirPath}: ${(error as Error).message}`);
		return { items: [], errorMessage: (error as Error).message };
	}
}

export async function searchFilesMetadata(
	projectRoot: string,
	searchFileOptions: {
		filePattern?: string;
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
	},
): Promise<{ files: string[]; errorMessage: string | null }> {
	logger.info(
		`FileHandlingUtil: Starting file metadata search in ${projectRoot} with file pattern: ${searchFileOptions?.filePattern}`,
	);
	try {
		const matchingFiles: string[] = [];

		const excludeOptions = await getExcludeOptions(projectRoot);
		const excludeOptionsRegex = createExcludeRegexPatterns(excludeOptions, projectRoot);
		const walkOptions: WalkOptions = {
			includeDirs: false,
			skip: excludeOptionsRegex,
		};

		// Add match option if file pattern is provided
		if (searchFileOptions?.filePattern) {
			walkOptions.match = createMatchRegexPatterns(searchFileOptions?.filePattern, projectRoot);
		}
		// logger.info(
		// 	`FileHandlingUtil: searchFilesMetadata - Searching ${projectRoot} using walkOptions: ${
		// 		JSON.stringify(walkOptions)
		// 	}`,
		// );

		for await (const entry of walk(projectRoot, walkOptions)) {
			const relativePath = relative(projectRoot, entry.path);

			const stat = await Deno.stat(entry.path);

			// Check date range
			if (!stat.mtime) {
				logger.info(`FileHandlingUtil: File ${relativePath} has no modification time, excluding from results`);
				continue;
			}
			if (searchFileOptions.dateAfter) {
				const afterDate = new Date(searchFileOptions.dateAfter);
				//if (stat.mtime < afterDate || stat.mtime > now) {
				if (stat.mtime < afterDate) {
					logger.info(
						`FileHandlingUtil: File ${relativePath} modified at ${stat.mtime.toISOString()} is outside the valid range (after ${searchFileOptions.dateAfter})`,
					);
					continue;
				}
			}
			if (searchFileOptions.dateBefore) {
				const beforeDate = new Date(searchFileOptions.dateBefore);
				//if (stat.mtime >= beforeDate || stat.mtime > now) {
				if (stat.mtime >= beforeDate) {
					logger.info(
						`FileHandlingUtil: File ${relativePath} modified at ${stat.mtime.toISOString()} is outside the valid range (before ${searchFileOptions.dateBefore})`,
					);
					continue;
				}
			}

			// Check file size
			if (searchFileOptions.sizeMin !== undefined && stat.size < searchFileOptions.sizeMin) continue;
			if (searchFileOptions.sizeMax !== undefined && stat.size > searchFileOptions.sizeMax) continue;

			//logger.info(`FileHandlingUtil: File ${relativePath} matches all criteria`);
			matchingFiles.push(relativePath);
		}

		logger.info(`FileHandlingUtil: File metadata search completed. Found ${matchingFiles.length} matching files.`);

		return { files: matchingFiles, errorMessage: null };
	} catch (error) {
		logger.error(`FileHandlingUtil: Error in searchFilesMetadata: ${(error as Error).message}`);
		return { files: [], errorMessage: (error as Error).message };
	}
}
