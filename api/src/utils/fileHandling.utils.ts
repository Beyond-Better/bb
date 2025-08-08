import { join, normalize, relative, resolve } from '@std/path';
//import { TextLineStream } from '@std/streams';
import { LRUCache } from 'npm:lru-cache';
import { ensureDir, exists, walk } from '@std/fs';
import type { WalkOptions } from '@std/fs';
import {
	dirname,
	//extname,
	globToRegExp,
	isAbsolute,
} from '@std/path';
//import { contentType } from '@std/media-types';
import {
	detectContentType,
	//isTextMimeType
} from 'api/utils/contentTypes.ts';

import { logger } from 'shared/logger.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';
import type { ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { ContentMatch } from 'shared/types/dataSourceResource.ts';
import type {
	SearchReplaceContentResult,
	SearchReplaceOperation,
	SearchReplaceOperationResult,
} from 'shared/types/dataSourceResource.ts';

// Size limits in bytes
export const TEXT_DISPLAY_LIMIT = 1024 * 1024; // 1MB
export const TEXT_HARD_LIMIT = 10 * 1024 * 1024; // 10MB
export const IMAGE_DISPLAY_LIMIT = 5 * 1024 * 1024; // 5MB
export const IMAGE_HARD_LIMIT = 20 * 1024 * 1024; // 20MB

function createMatchRegexPatterns(matchPattern: string, dataSourceRoot: string): RegExp[] {
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
			// [TODO] add more tests to find_resources test to check for more complex file patterns with deeply nested sub directories
			// singlePattern = singlePattern.split('*').join('**');
			singlePattern = `**/${singlePattern}`;
		}

		// Handle bare filename (no path, no wildcards)
		if (!singlePattern.includes('/') && !singlePattern.includes('*')) {
			singlePattern = `**/${singlePattern}`;
		}

		// Prepend dataSourceRoot to the pattern
		const fullPattern = join(dataSourceRoot, singlePattern);
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

export function createExcludeRegexPatterns(excludePatterns: string[], dataSourceRoot: string): RegExp[] {
	return excludePatterns.flatMap((pattern) => {
		// Handle negation patterns (currently just converts to regex, but doesn't implement the negation logic)
		if (pattern.startsWith('!')) {
			return [globToRegExp(pattern.slice(1), { extended: true, globstar: true })];
		}

		// Split the pattern by '|' to handle multiple patterns
		const patterns = pattern.split('|');

		return patterns.map((singlePattern) => {
			// Normalize path separators for regex consistency
			singlePattern = singlePattern.replace(/\\/g, '/');

			// Handle directory patterns
			if (singlePattern.endsWith('/')) {
				singlePattern += '**';
			}

			// // Special handling for .bb, .git, .trash directories to ensure all contents are excluded
			// if (/^\.(bb|git|trash)\/\*$/.test(singlePattern)) {
			// 	singlePattern = singlePattern.replace(/\*$/, '**');
			// }

			// Handle simple wildcard patterns
			if (singlePattern.includes('*') && !singlePattern.includes('**')) {
				singlePattern = `**/${singlePattern}`;
			}

			// Handle bare filename (no path, no wildcards)
			if (!singlePattern.includes('/') && !singlePattern.includes('*')) {
				singlePattern = `**/${singlePattern}`;
			}

			// Normalize and prepend dataSourceRoot to the pattern
			const normalizedRoot = dataSourceRoot.replace(/\\/g, '/');
			const fullPattern = normalizedRoot.endsWith('/')
				? `${normalizedRoot}${singlePattern}`
				: `${normalizedRoot}/${singlePattern}`;

			return globToRegExp(fullPattern, { extended: true, globstar: true });
		});
	});
}

export async function getExcludeOptions(dataSourceRoot: string): Promise<string[]> {
	const excludeFiles = [
		join(dataSourceRoot, 'tags.ignore'),
		join(dataSourceRoot, '.gitignore'),
		join(dataSourceRoot, '.bb', 'ignore'),
		join(dataSourceRoot, '.bb', 'tags.ignore'),
	];

	// Ensure these directories are fully excluded with all subdirectories
	const patterns = ['.bb', '.git', '.trash', '.bb/**', '.git/**', '.trash/**'];

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
	//logger.debug(`FileHandlingUtil: Exclude patterns for data source: ${dataSourceRoot}`, uniquePatterns);
	return uniquePatterns;
}

/**
 * Check if a path is within a data source root directory
 * @param dataSourceRoot The root path of the data source
 * @param filePath The path to check
 * @returns True if the path is within the root, false otherwise
 */
export async function isPathWithinDataSource(dataSourceRoot: string, filePath: string): Promise<boolean> {
	const normalizedDataSourceRoot = normalize(dataSourceRoot);
	const normalizedFilePath = normalize(filePath);
	const absoluteFilePath = resolve(normalizedDataSourceRoot, normalizedFilePath);

	try {
		// For existing files, resolve symlinks
		const resolvedPath = await Deno.realPath(absoluteFilePath);
		//logger.info(`FileHandlingUtil: isPathWithinDataSource: Checking if ${resolvedPath} is within ${normalizedDataSourceRoot}`);
		return resolvedPath.startsWith(await Deno.realPath(normalizedDataSourceRoot));
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			// For non-existing files, check if the absolute path is within the data source root
			return absoluteFilePath.startsWith(normalizedDataSourceRoot);
		}
		// For other errors, re-throw
		throw error;
	}
}

export async function existsWithinDataSource(dataSourceRoot: string, filePath: string): Promise<boolean> {
	const normalizedDataSourceRoot = normalize(dataSourceRoot);
	const normalizedFilePath = normalize(filePath);
	const absoluteFilePath = resolve(normalizedDataSourceRoot, normalizedFilePath);
	logger.info(`FileHandlingUtil: Checking file exists in data source ${dataSourceRoot} - ${filePath}`);
	logger.info(`FileHandlingUtil: Checking file exists - absoluteFilePath ${absoluteFilePath}`);

	return await exists(absoluteFilePath);
	// [TODO] Using isReadable is causing tests to fail - is it a real error or some other problem
	//return await exists(absoluteFilePath, { isReadable: true });
}

export async function readFileContent(dataSourceRoot: string, filePath: string): Promise<string> {
	const fullFilePath = join(dataSourceRoot, filePath);
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

/**
 * Safely check if a file or directory exists without throwing
 * @param path The path to check
 * @returns True if the path exists, false otherwise
 */
export async function safeExists(path: string): Promise<boolean> {
	try {
		return await exists(path);
	} catch (error) {
		logger.error(`filesystemUtils: Error checking if path exists: ${path}`, error);
		return false;
	}
}

/**
 * Create parent directories for a path if they don't exist
 * @param absolutePath The absolute path to ensure parent directories for
 */
export async function ensureParentDirectories(absolutePath: string): Promise<void> {
	const parentDir = dirname(absolutePath);
	await ensureDir(parentDir);
}

/**
 * Convert a relative resource path to an absolute filesystem path
 * @param dataSourceRoot The data source root path
 * @param resourcePath The relative resource path
 * @returns The absolute filesystem path
 */
export function resourcePathToAbsolute(dataSourceRoot: string, resourcePath: string): string {
	// Handle already absolute paths (should not happen for well-formed resource paths)
	if (isAbsolute(resourcePath)) {
		logger.warn(`filesystemUtils: Given resource path is already absolute: ${resourcePath}`);
		return resourcePath;
	}

	// Join the root path and the resource path
	return join(dataSourceRoot, resourcePath);
}

/**
 * Convert an absolute filesystem path to a relative resource path
 * @param dataSourceRoot The data source root path
 * @param absolutePath The absolute filesystem path
 * @returns The relative resource path
 */
export async function absolutePathToResource(dataSourceRoot: string, absolutePath: string): Promise<string> {
	// Make sure the path is within the data source
	if (!await isPathWithinDataSource(absolutePath, dataSourceRoot)) {
		throw new Error(`Path is not within data source: ${absolutePath}`);
	}

	// Get the relative path
	let relativePath = relative(dataSourceRoot, absolutePath);

	// Convert empty string to '.' to represent the root
	if (relativePath === '') {
		relativePath = '.';
	}

	return relativePath;
}

export interface FileLoadOptions {
	maxSize?: number;
	truncateAt?: number;
}

/**
 * Get file metadata for a filePath
 * @param fullPath The path to the file
 * @returns Basic file metadata object
 */
export async function getFileMetadataAbsolute(
	fullPath: string,
): Promise<Omit<ResourceMetadata, 'uri'>> {
	// Check if the file exists
	//if (!await safeExists(fullPath)) {
	//	throw createError(
	//		ErrorType.FileHandling,
	//		`FileEntry not found: ${fullPath}`,
	//		{
	//			filePath: fullPath,
	//			operation: 'read',
	//		} as FileHandlingErrorOptions,
	//	);
	//}

	try {
		const fileInfo = await Deno.stat(fullPath); // Deno.FileInfo
		const mimeType = fileInfo.isDirectory ? 'application/directory' : (await detectContentType(fullPath) || '');
		//logger.info(`FileHandlingUtil: Getting metadata for ${fullPath}`, { mimeType });

		// Determine content type category
		const isImage = mimeType.startsWith('image/');
		//const isText = isTextMimeType(mimeType);
		//logger.debug(`FileHandlingUtil: Getting metadata for ${fullPath}: ${mimeType} (${isText ? 'text' : 'binary'})`);

		return {
			//contentType: isImage ? 'image' : (isText ? 'text' : 'binary'),
			contentType: isImage ? 'image' : 'text', // LLM (anthropic) only supports image or text types for content blocks
			accessMethod: 'bb',
			type: 'file',
			name: `File: ${fullPath}`,
			isFile: fileInfo.isFile,
			isDirectory: fileInfo.isDirectory,
			uriAbsolute: `file://${fullPath}`, // Store full path as URI
			mimeType: mimeType as LLMMessageContentPartImageBlockSourceMediaType,
			lastModified: fileInfo.mtime || new Date(),
			size: fileInfo.isFile ? fileInfo.size : undefined,
			error: null,
		};
	} catch (error) {
		logger.error(`FileHandlingUtil: Error getting metadata for ${fullPath}: ${(error as Error).message}`);
		throw createError(
			ErrorType.FileHandling,
			`Failed to get file metadata: ${(error as Error).message}`,
			{
				name: 'get-metadata',
				filePath: fullPath,
				operation: 'read',
			} as FileHandlingErrorOptions,
		);
	}
}

export async function getFileMetadata(
	dataSourceRoot: string,
	filePath: string,
): Promise<ResourceMetadata> {
	const fullPath = join(dataSourceRoot, filePath);
	const metadata = await getFileMetadataAbsolute(fullPath) as ResourceMetadata;
	return {
		...metadata,
		name: `${metadata.isDirectory ? 'Directory' : 'File'}: ${filePath || '.'}`,
		uri: `file:./${filePath}`, // Store relative path in metadata
		uriTerm: filePath,
	} as ResourceMetadata;
}

export function checkSizeLimits(size: number, isImage: boolean): {
	exceedsHardLimit: boolean;
	exceedsDisplayLimit: boolean;
	truncateAt?: number;
} {
	if (isImage) {
		return {
			exceedsHardLimit: size > IMAGE_HARD_LIMIT,
			exceedsDisplayLimit: size > IMAGE_DISPLAY_LIMIT,
		};
	} else {
		return {
			exceedsHardLimit: size > TEXT_HARD_LIMIT,
			exceedsDisplayLimit: size > TEXT_DISPLAY_LIMIT,
			truncateAt: size > TEXT_DISPLAY_LIMIT ? TEXT_DISPLAY_LIMIT : undefined,
		};
	}
}

export async function readFileWithOptions(
	fileRoot: string,
	filePath: string,
	options?: FileLoadOptions,
): Promise<{ content: string | Uint8Array; truncated?: boolean }> {
	const fullPath = join(fileRoot, filePath);
	const mimeType = await detectContentType(fullPath) || 'text/plain';
	const isImage = mimeType.startsWith('image/');

	try {
		const fileInfo = await Deno.stat(fullPath);
		const sizeLimits = checkSizeLimits(fileInfo.size, isImage);

		// Check hard limit first
		if (options?.maxSize && fileInfo.size > options.maxSize || sizeLimits.exceedsHardLimit) {
			throw createError(
				ErrorType.FileHandling,
				`File size exceeds maximum limit`,
				{
					name: 'read-file',
					filePath: filePath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		// For images, we don't truncate, we either load or reject
		if (isImage) {
			if (sizeLimits.exceedsDisplayLimit) {
				throw createError(
					ErrorType.FileHandling,
					`Image file size exceeds display limit`,
					{
						name: 'read-file',
						filePath: filePath,
						operation: 'read',
					} as FileHandlingErrorOptions,
				);
			}
			return { content: await Deno.readFile(fullPath) };
		}

		// For text files, we can truncate if needed
		const truncateAt = options?.truncateAt || (sizeLimits.truncateAt);
		if (truncateAt) {
			const file = await Deno.open(fullPath);
			const buffer = new Uint8Array(truncateAt);
			const bytesRead = await file.read(buffer);
			file.close();
			if (bytesRead === null) {
				throw new Error('Failed to read file');
			}
			const content = new TextDecoder().decode(buffer.subarray(0, bytesRead));
			return { content, truncated: true };
		}

		// No truncation needed
		return { content: await Deno.readTextFile(fullPath) };
	} catch (error) {
		logger.error(`FileHandlingUtil: Error reading file ${fullPath}: ${(error as Error).message}`);
		throw createError(
			ErrorType.FileHandling,
			`Failed to read file: ${(error as Error).message}`,
			{
				name: 'read-file',
				filePath: filePath,
				operation: 'read',
			} as FileHandlingErrorOptions,
		);
	}
}

export async function updateFile(dataSourceRoot: string, filePath: string, _content: string): Promise<void> {
	if (!await isPathWithinDataSource(dataSourceRoot, filePath)) {
		throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the data source directory`, {
			name: 'update-file',
			filePath,
			operation: 'write',
		} as FileHandlingErrorOptions);
	}

	// TODO: Implement file update logic
	logger.info(`FileHandlingUtil: File ${filePath} updated in the data source`);
}

const searchCache = new LRUCache<string, string[]>({ max: 100 });

interface SearchFileOptions {
	resourcePattern?: string;
	dateAfter?: string;
	dateBefore?: string;
	sizeMin?: number;
	sizeMax?: number;
	// Context options for content searches
	contextLines?: number;
	maxMatchesPerFile?: number;
	includeContent?: boolean;
}

export interface ContentResourceMatch {
	resourcePath: string;
	contentMatches?: ContentMatch[];
}

export interface ContentSearchResult {
	matches: ContentResourceMatch[];
	errorMessage: string | null;
}

const MAX_CONCURRENT = 20; // Adjust based on system capabilities

export async function searchFilesContent(
	dataSourceRoot: string,
	contentPattern: string,
	caseSensitive: boolean,
	searchFileOptions?: SearchFileOptions,
): Promise<ContentSearchResult> {
	const cacheKey = `${dataSourceRoot}:${contentPattern}:${caseSensitive ? 'caseSensitive' : 'caseInsensitive'}:${
		JSON.stringify(searchFileOptions)
	}`;
	const cachedResult = searchCache.get(cacheKey);
	if (cachedResult && !searchFileOptions?.includeContent) {
		// Only use cache for simple file list results
		logger.info(`FileHandlingUtil: Returning cached result for search: ${cacheKey}`);
		return { matches: cachedResult.map((file) => ({ resourcePath: file })), errorMessage: null };
	}

	logger.info(`FileHandlingUtil: Starting file content search in ${dataSourceRoot} with pattern: ${contentPattern}`);

	// Default options for content extraction
	const contextLines = searchFileOptions?.contextLines ?? 2;
	const maxMatchesPerFile = searchFileOptions?.maxMatchesPerFile ?? 5;
	const includeContent = searchFileOptions?.includeContent ?? false;

	let regex: RegExp;
	try {
		// We're only supporting 'g' and 'i' flags at present - there are a few more we can support if needed
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags
		// For error validation, use only case sensitivity flag to maintain backward compatibility
		// The global flag will be applied later for actual content extraction if needed
		const regexFlags = caseSensitive ? '' : 'i';
		regex = new RegExp(contentPattern, regexFlags);
	} catch (error) {
		logger.error(`FileHandlingUtil: Invalid regular expression: ${contentPattern}`);
		return { matches: [], errorMessage: (error as Error).message };
	}

	try {
		const filesToProcess = [];

		const excludeOptions = await getExcludeOptions(dataSourceRoot);
		const excludeOptionsRegex = createExcludeRegexPatterns(excludeOptions, dataSourceRoot);
		const walkOptions: WalkOptions = {
			includeDirs: false,
			skip: excludeOptionsRegex,
		};

		// Add match option if file pattern is provided
		if (searchFileOptions?.resourcePattern) {
			logger.info(
				`FileHandlingUtil: searchFilesContent - search in ${dataSourceRoot} with file pattern: ${searchFileOptions?.resourcePattern}`,
			);
			walkOptions.match = createMatchRegexPatterns(searchFileOptions.resourcePattern, dataSourceRoot);
		}

		for await (const entry of walk(dataSourceRoot, walkOptions)) {
			const relativePath = relative(dataSourceRoot, entry.path);
			filesToProcess.push({ path: entry.path, relativePath });
		}
		logger.info(`FileHandlingUtil: File content search starting. Found ${filesToProcess.length} to search.`);

		if (includeContent) {
			// Create a global regex for content matching
			const globalRegex = new RegExp(contentPattern, `g${caseSensitive ? '' : 'i'}`);
			// Process files with content extraction
			const contentResults = await Promise.all(
				chunk(filesToProcess, MAX_CONCURRENT).map(async (batch) =>
					Promise.all(
						batch.map(({ path, relativePath }) =>
							processFileWithContent(
								path,
								globalRegex,
								searchFileOptions,
								relativePath,
								contextLines,
								maxMatchesPerFile,
							)
						),
					)
				),
			);

			const validResults = contentResults.flat().filter((result): result is ContentResourceMatch =>
				result !== null
			);
			logger.info(
				`FileHandlingUtil: File content search with context completed. Found ${validResults.length} matching files.`,
			);
			return { matches: validResults, errorMessage: null };
		} else {
			// Process files for simple matching
			const simpleResults = await Promise.all(
				chunk(filesToProcess, MAX_CONCURRENT).map(async (batch) =>
					Promise.all(
						batch.map(({ path, relativePath }) =>
							processFile(path, regex, searchFileOptions, relativePath)
						),
					)
				),
			);

			const validFiles = simpleResults.flat().filter((result): result is string => result !== null);
			logger.info(`FileHandlingUtil: File content search completed. Found ${validFiles.length} matching files.`);
			searchCache.set(cacheKey, validFiles);
			return { matches: validFiles.map((file) => ({ resourcePath: file })), errorMessage: null };
		}
	} catch (error) {
		logger.error(`FileHandlingUtil: Error in searchFilesContent: ${(error as Error).message}`);
		return { matches: [], errorMessage: (error as Error).message };
	}
}

function chunk<T>(array: T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size));
}

async function processFileWithContent(
	filePath: string,
	regex: RegExp,
	searchFileOptions: SearchFileOptions | undefined,
	relativePath: string,
	contextLines: number,
	maxMatchesPerFile: number,
): Promise<ContentResourceMatch | null> {
	logger.debug(`FileHandlingUtil: Starting to process file with content: ${relativePath}`);
	try {
		const fileInfo = await Deno.stat(filePath);
		if (!passesMetadataFilters(fileInfo, searchFileOptions)) {
			return null;
		}

		const content = await Deno.readTextFile(filePath);
		const lines = content.split('\n');
		const contentMatches: ContentMatch[] = [];
		let matchCount = 0;

		// Reset regex lastIndex
		regex.lastIndex = 0;

		// Check if pattern contains newlines (multi-line pattern)
		const isMultiLinePattern = regex.source.includes('\\n');

		if (isMultiLinePattern) {
			// For multi-line patterns, search the entire content
			let match;
			regex.lastIndex = 0;

			while ((match = regex.exec(content)) !== null && matchCount < maxMatchesPerFile) {
				// Find which line this match starts on
				const beforeMatch = content.substring(0, match.index);
				const lineNumber = beforeMatch.split('\n').length;
				const lineIndex = lineNumber - 1;

				// Get the line where the match starts
				const matchLine = lines[lineIndex] || '';

				// Calculate match position within the starting line
				const lineStart = beforeMatch.lastIndexOf('\n') + 1;
				const matchStartInLine = match.index - lineStart;

				const contextBefore = lines.slice(Math.max(0, lineIndex - contextLines), lineIndex);
				const contextAfter = lines.slice(lineIndex + 1, Math.min(lines.length, lineIndex + 1 + contextLines));

				contentMatches.push({
					lineNumber: lineNumber, // 1-based line numbers
					content: matchLine,
					contextBefore,
					contextAfter,
					matchStart: Math.max(0, matchStartInLine),
					matchEnd: Math.min(matchLine.length, matchStartInLine + match[0].length),
				});

				matchCount++;

				// Break if regex doesn't have global flag
				if (!regex.global) break;
			}
		} else {
			// For single-line patterns, search line by line (original behavior)
			for (let lineIndex = 0; lineIndex < lines.length && matchCount < maxMatchesPerFile; lineIndex++) {
				const line = lines[lineIndex];
				let match;
				regex.lastIndex = 0; // Reset for each line

				while ((match = regex.exec(line)) !== null && matchCount < maxMatchesPerFile) {
					const contextBefore = lines.slice(Math.max(0, lineIndex - contextLines), lineIndex);
					const contextAfter = lines.slice(
						lineIndex + 1,
						Math.min(lines.length, lineIndex + 1 + contextLines),
					);

					contentMatches.push({
						lineNumber: lineIndex + 1, // 1-based line numbers
						content: line,
						contextBefore,
						contextAfter,
						matchStart: match.index,
						matchEnd: match.index + match[0].length,
					});

					matchCount++;

					// Break if regex doesn't have global flag
					if (!regex.global) break;
				}
			}
		}

		if (contentMatches.length > 0) {
			return {
				resourcePath: relativePath,
				contentMatches,
			};
		}

		return null;
	} catch (error) {
		logger.warn(`FileHandlingUtil: Error processing file with content ${filePath}: ${(error as Error).message}`);
		return null;
	}
}

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
		const fileInfo = await Deno.stat(filePath);
		if (!passesMetadataFilters(fileInfo, searchFileOptions)) {
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

function passesMetadataFilters(fileInfo: Deno.FileInfo, searchFileOptions: SearchFileOptions | undefined): boolean {
	if (!searchFileOptions) return true;
	if (searchFileOptions.dateAfter && fileInfo.mtime && fileInfo.mtime < new Date(searchFileOptions.dateAfter)) {
		return false;
	}
	if (searchFileOptions.dateBefore && fileInfo.mtime && fileInfo.mtime > new Date(searchFileOptions.dateBefore)) {
		return false;
	}
	if (searchFileOptions.sizeMin !== undefined && fileInfo.size < searchFileOptions.sizeMin) return false;
	if (searchFileOptions.sizeMax !== undefined && fileInfo.size > searchFileOptions.sizeMax) return false;
	return true;
}

export interface ListDirectoryOptions {
	only?: 'files' | 'directories';
	matchingString?: string;
	includeHidden?: boolean;
	strictRoot?: boolean;
}
export interface ListDirectoryResponse {
	items: Array<{ name: string; path: string; isDirectory: boolean }>;
	errorMessage: string | null;
}

export async function listDirectory(
	rootDir: string,
	dirPath: string,
	options: ListDirectoryOptions = { strictRoot: true },
): Promise<ListDirectoryResponse> {
	try {
		const fullPath = join(rootDir, dirPath);
		logger.info(`FileHandlingUtil: Checking if ${fullPath} is within ${rootDir}`);
		if (options.strictRoot && !await isPathWithinDataSource(rootDir, fullPath)) {
			throw createError(
				ErrorType.FileHandling,
				`Access denied: ${dirPath} is outside the data source directory`,
				{
					name: 'list-directory',
					filePath: fullPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		const items: Array<{ name: string; path: string; isDirectory: boolean }> = [];
		const matchRegex = options.matchingString
			? globToRegExp(options.matchingString, { extended: true, globstar: true })
			: null;

		let resolvedPath: string;
		try {
			// For existing files, resolve symlinks
			resolvedPath = await Deno.realPath(fullPath);
		} catch (error) {
			logger.error(`FileHandlingUtil: Could not get realPath for ${fullPath}: ${(error as Error).message}`);
			throw error;
		}

		for await (const entry of Deno.readDir(resolvedPath)) {
			// Resolve symlinks to determine actual type
			let isDirectory = entry.isDirectory;
			if (entry.isSymlink) {
				try {
					const symlinkPath = join(resolvedPath, entry.name);
					const stat = await Deno.stat(symlinkPath); // This follows symlinks
					isDirectory = stat.isDirectory;
				} catch (_error) {
					// If symlink is broken, skip it or treat as file
					console.warn(`Broken symlink detected: ${entry.name}`);
					isDirectory = false; // or continue to skip broken symlinks
				}
			}

			// Skip if filtering by type
			if (options.only === 'files' && isDirectory) continue;
			if (options.only === 'directories' && !isDirectory) continue;

			// Skip hidden files unless explicitly included
			if (!options.includeHidden && entry.name.startsWith('.')) continue;

			// Skip if doesn't match pattern
			if (matchRegex && !matchRegex.test(entry.name)) continue;

			const relativePath = join(dirPath, entry.name);
			items.push({
				name: entry.name,
				path: relativePath,
				isDirectory,
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

const MIN_SEARCH_LENGTH = 1;

/**
 * Apply search and replace operations to text content
 * @param content The original content to process
 * @param operations Array of search and replace operations
 * @param defaults Default values for operation properties
 * @param isNewResource Whether this is a new resource (affects validation)
 * @returns Result with processed content and operation details
 */
export function applySearchAndReplaceToContent(
	content: string,
	operations: SearchReplaceOperation[],
	defaults: {
		caseSensitive?: boolean;
		regexPattern?: boolean;
		replaceAll?: boolean;
	} = {},
	isNewResource = false,
): SearchReplaceContentResult {
	const {
		caseSensitive = true,
		regexPattern = false,
		replaceAll = false,
	} = defaults;

	let processedContent = content;
	const operationResults: SearchReplaceOperationResult[] = [];
	const successfulOperations: SearchReplaceOperation[] = [];
	let allOperationsFailed = true;
	let allOperationsSucceeded = true;

	for (const [index, operation] of operations.entries()) {
		const {
			search,
			replace,
			regexPattern: opRegex = regexPattern,
			replaceAll: opReplaceAll = replaceAll,
			caseSensitive: opCaseSensitive = caseSensitive,
		} = operation;
		const operationWarnings: string[] = [];
		let operationSuccess = false;

		// Validate search string
		if (!isNewResource && search.length < MIN_SEARCH_LENGTH) {
			operationWarnings.push(
				`Search string is too short (minimum ${MIN_SEARCH_LENGTH} character(s)) for existing resource.`,
			);
			continue;
		}

		// Validate that search and replace strings are different
		if (search === replace) {
			operationWarnings.push('Search and replace strings are identical.');
			continue;
		}

		const originalContent = processedContent;

		let searchPattern: string | RegExp;
		const escapeRegExp = (str: string) => str.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
		const flags = `${opReplaceAll ? 'g' : ''}${opCaseSensitive ? '' : 'i'}`;

		if (opRegex) {
			searchPattern = new RegExp(search, flags);
		} else if (!opCaseSensitive) {
			// literal search, but case insensitive so must use a regex - escape regex special characters
			searchPattern = new RegExp(escapeRegExp(search), flags);
		} else {
			// literal search that is case sensitive
			searchPattern = search;
		}

		processedContent = opReplaceAll && searchPattern instanceof RegExp
			? processedContent.replaceAll(searchPattern, replace)
			: processedContent.replace(searchPattern, replace);

		// Check if the content actually changed
		if (processedContent !== originalContent) {
			operationSuccess = true;
			allOperationsFailed = false;
			successfulOperations.push(operation);
		} else {
			operationWarnings.push(
				'No changes were made. The search string was not found in the resource content.',
			);
			allOperationsSucceeded = false;
		}

		const resultStatus = operationWarnings.length > 0 ? 'warning' : (operationSuccess ? 'success' : 'warning');
		const resultMessage = operationWarnings.length > 0
			? `Operation ${index + 1} warnings: ${operationWarnings.join(' ')}`
			: (operationSuccess
				? `Operation ${index + 1} completed successfully`
				: `Operation ${index + 1} failed: No changes were made`);

		operationResults.push({
			operationIndex: index,
			status: resultStatus,
			message: resultMessage,
			success: operationSuccess,
			warnings: operationWarnings,
		});

		if (!operationSuccess) {
			allOperationsSucceeded = false;
		}
	}

	return {
		processedContent,
		operationResults,
		successfulOperations,
		allOperationsSucceeded,
		allOperationsFailed,
	};
}

export async function searchFilesMetadata(
	dataSourceRoot: string,
	searchFileOptions: {
		resourcePattern?: string;
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
	},
): Promise<{ files: string[]; errorMessage: string | null }> {
	logger.info(
		`FileHandlingUtil: Starting file metadata search in ${dataSourceRoot} with file pattern: ${searchFileOptions?.resourcePattern}`,
	);
	try {
		const matchingFiles: string[] = [];

		const excludeOptions = await getExcludeOptions(dataSourceRoot);
		const excludeOptionsRegex = createExcludeRegexPatterns(excludeOptions, dataSourceRoot);
		const walkOptions: WalkOptions = {
			includeDirs: false,
			skip: excludeOptionsRegex,
		};

		// Add match option if file pattern is provided
		if (searchFileOptions?.resourcePattern) {
			walkOptions.match = createMatchRegexPatterns(searchFileOptions?.resourcePattern, dataSourceRoot);
		}
		// logger.info(
		// 	`FileHandlingUtil: searchFilesMetadata - Searching ${dataSourceRoot} using walkOptions: ${
		// 		JSON.stringify(walkOptions)
		// 	}`,
		// );

		for await (const entry of walk(dataSourceRoot, walkOptions)) {
			const relativePath = relative(dataSourceRoot, entry.path);

			const fileInfo = await Deno.stat(entry.path);

			// Check date range
			if (!fileInfo.mtime) {
				logger.info(`FileHandlingUtil: File ${relativePath} has no modification time, excluding from results`);
				continue;
			}
			if (searchFileOptions.dateAfter) {
				const afterDate = new Date(searchFileOptions.dateAfter);
				//if (fileInfo.mtime < afterDate || fileInfo.mtime > now) {
				if (fileInfo.mtime < afterDate) {
					logger.info(
						`FileHandlingUtil: File ${relativePath} modified at ${fileInfo.mtime.toISOString()} is outside the valid range (after ${searchFileOptions.dateAfter})`,
					);
					continue;
				}
			}
			if (searchFileOptions.dateBefore) {
				const beforeDate = new Date(searchFileOptions.dateBefore);
				//if (fileInfo.mtime >= beforeDate || fileInfo.mtime > now) {
				if (fileInfo.mtime >= beforeDate) {
					logger.info(
						`FileHandlingUtil: File ${relativePath} modified at ${fileInfo.mtime.toISOString()} is outside the valid range (before ${searchFileOptions.dateBefore})`,
					);
					continue;
				}
			}

			// Check file size
			if (searchFileOptions.sizeMin !== undefined && fileInfo.size < searchFileOptions.sizeMin) continue;
			if (searchFileOptions.sizeMax !== undefined && fileInfo.size > searchFileOptions.sizeMax) continue;

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
