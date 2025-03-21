import type { Context } from '@oak/oak';
import { extname, join, resolve } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isPathWithinProject, listDirectory, type ListDirectoryOptions } from 'api/utils/fileHandling.ts';
import { getProjectRoot } from 'shared/dataDir.ts';
import {
	type FileSuggestionsForPathOptions,
	type FileSuggestionsOptions,
	suggestFiles as getSuggestions,
	suggestFilesForPath as getSuggestionsForPath,
} from 'api/utils/fileSuggestions.ts';
import { ResourceManager } from 'api/llms/resourceManager.ts';
import { getContentType } from 'api/utils/contentTypes.ts';
import type { FileMetadata } from 'shared/types.ts';

// Define file metadata interface
interface UploadedFileMetadata {
	id: string;
	name: string;
	relativePath: string;
	size: number;
	type: string;
	mimeType: string;
	uploadedAt: string;
	description?: string;
	tags?: string[];
}

export const addFile = async (
	{ request, response, state }: {
		request: Context['request'];
		response: Context['response'];
		state: { resourceManager: ResourceManager };
	},
) => {
	try {
		const formData = await request.body.formData();

		const projectId = formData.get('projectId') as string;
		const file = formData.get('file');
		const description = formData.get('description') ? String(formData.get('description')) : '';
		const tags = formData.has('tags') && formData.get('tags') ? JSON.parse(String(formData.get('tags'))) : [];

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Project ID is required' };
			return;
		}

		if (!file) {
			response.status = 400;
			response.body = { error: 'No file provided' };
			return;
		}

		const isFileObject = (value: unknown): value is File => {
			return value !== null && typeof value === 'object' && 'size' in value && 'name' in value;
		};
		if (!isFileObject(file)) {
			response.status = 400;
			response.body = { error: 'Invalid file format' };
			return;
		}

		// Validate file size (5MB limit)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			response.status = 400;
			response.body = { error: 'File exceeds maximum size of 5MB' };
			return;
		}

		// Get project path
		const projectRoot = await getProjectRoot(projectId);

		// Create .uploads directory if it doesn't exist
		const uploadsDir = join(projectRoot, '.uploads');
		await ensureDir(uploadsDir);

		// Create .metadata directory
		const metadataDir = join(uploadsDir, '.metadata');
		await ensureDir(metadataDir);

		// Generate a unique filename
		const fileId = crypto.randomUUID();
		const originalExt = isFileObject(file) && file.name ? extname(file.name) : '';
		const ext = originalExt ||
			(isFileObject(file) && file.type?.startsWith('image/') ? `.${file.type.split('/')[1]}` : '.bin');

		const filename = `${fileId}${ext}`;
		const sanitizedName = isFileObject(file) && file.name
			? file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
			: `uploaded-file-${fileId}${ext}`;

		// Write file to project uploads directory
		const filePath = join(uploadsDir, filename);
		if (!isFileObject(file)) {
			throw new Error('File is not a valid File object');
		}
		const fileBuffer = await file.arrayBuffer();
		const fileArray = new Uint8Array(fileBuffer);
		await Deno.writeFile(filePath, fileArray);

		// Determine MIME type and if it's an image
		const mimeType = isFileObject(file) && 'type' in file ? file.type : getContentType(sanitizedName);
		const isImage = mimeType.startsWith('image/');

		// Create metadata for the file
		const metadata: UploadedFileMetadata = {
			id: fileId,
			name: sanitizedName,
			relativePath: `.uploads/${filename}`,
			size: isFileObject(file) ? file.size : 0,
			type: isImage ? 'image' : 'text',
			mimeType: mimeType,
			uploadedAt: new Date().toISOString(),
			description: String(description),
			tags,
		};

		// Store individual file metadata
		const metadataPath = join(metadataDir, `${fileId}.json`);
		await Deno.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2));

		// Update file index
		const indexPath = join(metadataDir, 'index.json');
		let index: Record<string, UploadedFileMetadata> = {};

		if (await exists(indexPath)) {
			try {
				const indexContent = await Deno.readTextFile(indexPath);
				index = JSON.parse(indexContent);
			} catch (error) {
				logger.error(`Failed to read file index: ${error}`);
				// Continue with empty index if file is corrupted
			}
		}

		// Add to index
		index[fileId] = metadata;

		// Write updated index
		await Deno.writeTextFile(indexPath, JSON.stringify(index, null, 2));

		// Return success response with metadata
		response.status = 200;
		response.body = {
			success: true,
			fileId,
			metadata,
		};
	} catch (error) {
		logger.error(`FileHandler: Error adding file: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to add file' };
	}
};

export const removeFile = async (
	{ params, request, response }: {
		params: { id: string };
		request: Context['request'];
		response: Context['response'];
	},
) => {
	try {
		const { projectId } = await request.body.json();

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Project ID is required' };
			return;
		}

		const fileId = params.id;
		const projectRoot = await getProjectRoot(projectId);
		const metadataPath = join(projectRoot, '.uploads', '.metadata', `${fileId}.json`);

		if (!(await exists(metadataPath))) {
			response.status = 404;
			response.body = { error: 'File not found' };
			return;
		}

		// Read file metadata
		const metadataContent = await Deno.readTextFile(metadataPath);
		const metadata = JSON.parse(metadataContent);

		// Remove physical file
		const filePath = join(projectRoot, '.uploads', metadata.name);
		if (await exists(filePath)) {
			await Deno.remove(filePath);
		}

		// Remove metadata file
		await Deno.remove(metadataPath);

		// Update index
		const indexPath = join(projectRoot, '.uploads', '.metadata', 'index.json');
		if (await exists(indexPath)) {
			try {
				const indexContent = await Deno.readTextFile(indexPath);
				const index = JSON.parse(indexContent);

				if (index[fileId]) {
					delete index[fileId];
					await Deno.writeTextFile(indexPath, JSON.stringify(index, null, 2));
				}
			} catch (error) {
				logger.error(`Failed to update file index: ${error}`);
			}
		}

		response.status = 200;
		response.body = {
			success: true,
			message: `File ${fileId} removed from project`,
		};
	} catch (error) {
		logger.error(`FileHandler: Error removing file: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to remove file' };
	}
};

export const listFiles = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const { projectId } = await request.body.json();

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Project ID is required' };
			return;
		}

		const projectRoot = await getProjectRoot(projectId);
		const indexPath = join(projectRoot, '.uploads', '.metadata', 'index.json');

		if (!(await exists(indexPath))) {
			response.body = {
				success: true,
				files: [],
			};
			return;
		}

		try {
			const indexContent = await Deno.readTextFile(indexPath);
			const index = JSON.parse(indexContent);
			const files = Object.values(index);

			response.status = 200;
			response.body = {
				success: true,
				files,
			};
		} catch (error) {
			logger.error(`Failed to read file index: ${error}`);
			response.status = 500;
			response.body = { error: 'Failed to read file index' };
		}
	} catch (error) {
		logger.error(`FileHandler: Error listing files: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to list files' };
	}
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
