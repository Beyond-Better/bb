import type { Context } from '@oak/oak';
import { join, resolve } from '@std/path';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { type FileSuggestionsOptions, suggestFiles as getSuggestions } from 'api/utils/fileSuggestions.ts';

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

		if (!options.startDir) {
			response.status = 400;
			response.body = { error: 'Start directory is required' };
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
