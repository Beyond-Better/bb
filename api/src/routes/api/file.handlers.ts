import type { Context } from '@oak/oak';
import { join, resolve } from '@std/path';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isPathWithinProject, listDirectory, type ListDirectoryOptions } from 'api/utils/fileHandling.ts';
import {
	type FileSuggestionsForPathOptions,
	type FileSuggestionsOptions,
	suggestFiles as getSuggestions,
	suggestFilesForPath as getSuggestionsForPath,
} from 'api/utils/fileSuggestions.ts';

export const addFile = async (
	{ response }: { response: Context['response'] },
) => {
	// Add file to conversation
	response.body = { message: 'File added to conversation' };
};

export const removeFile = async (
	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	// Remove file from conversation
	response.body = { message: `File ${params.id} removed from conversation` };
};

export const listFiles = async (
	{ response }: { response: Context['response'] },
) => {
	// List files in conversation
	response.body = { message: 'Files in conversation listed' };
};

export const suggestFiles = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const options: FileSuggestionsOptions = await request.body.json();

		// Validate required parameters
		if (typeof options.partialPath === 'undefined') {
			response.status = 400;
			response.body = { error: 'Partial path is required' };
			return;
		}

		if (!options.projectId) {
			response.status = 400;
			response.body = { error: 'Project ID is required' };
			return;
		}

		logger.info(`FileHandler: Getting suggestions for path: ${options.partialPath}`);

		const result = await getSuggestions(options);
		response.body = result;
	} catch (error) {
		logger.error(`FileHandler: Error getting file suggestions: ${(error as Error).message}`);

		if ((error as Error).name === ErrorType.FileHandling) {
			response.status = 400;
			response.body = { error: (error as Error).message };
		} else {
			response.status = 500;
			response.body = { error: 'Failed to get file suggestions' };
		}
	}
};

export const suggestFilesForPath = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const options: FileSuggestionsForPathOptions = await request.body.json();
		if (!options.rootPath) options.rootPath = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

		// Validate required parameters
		if (typeof options.partialPath === 'undefined') {
			response.status = 400;
			response.body = { error: 'Partial path is required' };
			return;
		}

		if (!options.rootPath) {
			response.status = 400;
			response.body = { error: 'Root path is required' };
			return;
		}

		logger.info(`FileHandler: Getting suggestions for path: ${options.partialPath} in ${options.rootPath}`);

		const result = await getSuggestionsForPath(options);
		response.body = result;
	} catch (error) {
		logger.error(`FileHandler: Error getting file suggestions: ${(error as Error).message}`);

		if ((error as Error).name === ErrorType.FileHandling) {
			response.status = 400;
			response.body = { error: (error as Error).message };
		} else {
			response.status = 500;
			response.body = { error: 'Failed to get file suggestions' };
		}
	}
};

export const listDirectoryContents = async (
  { request, response }: { request: Context['request']; response: Context['response'] },
) => {
  try {
    const { dirPath, only, matchingString, includeHidden } = await request.body.json();
	const rootDir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

    //if (!dirPath) {
    //  response.status = 400;
    //  response.body = { error: 'Directory path is required' };
    //  return;
    //}

    const options: ListDirectoryOptions = {};
    if (only) options.only = only;
    if (matchingString) options.matchingString = matchingString;
    if (includeHidden !== undefined) options.includeHidden = includeHidden;

    const result = await listDirectory(rootDir, dirPath, options);
    response.body = result;
  } catch (error) {
    logger.error(`FileHandler: Error listing directory: ${(error as Error).message}`);

    if ((error as Error).name === ErrorType.FileHandling) {
      response.status = 400;
      response.body = { error: (error as Error).message };
    } else {
      response.status = 500;
      response.body = { error: 'Failed to list directory contents' };
    }
  }
};

export const resolvePath = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const { partialPath } = await request.body.json();

		if (!partialPath) {
			response.status = 400;
			response.body = { error: 'Partial path is required' };
			return;
		}

		// Resolve the path relative to the user's home directory
		const homeDir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
		if (!homeDir) {
			throw createError(ErrorType.FileHandling, 'Unable to determine user home directory');
		}

		const fullPath = resolve(join(homeDir, partialPath));

		// Ensure resolved path is within project
		if (!isPathWithinProject(homeDir, fullPath)) {
			throw createError(ErrorType.FileHandling, 'Resolved path outside project directory');
		}

		response.body = { fullPath };
	} catch (error) {
		logger.error(`FileHandler: Error resolving path: ${(error as Error).message}`);

		if ((error as Error).name === ErrorType.FileHandling) {
			response.status = 400;
			response.body = { error: (error as Error).message };
		} else {
			response.status = 500;
			response.body = { error: 'Failed to resolve path' };
		}
	}
};
