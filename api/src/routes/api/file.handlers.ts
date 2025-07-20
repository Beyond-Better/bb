import type { Context } from '@oak/oak';
import { basename, extname, join, resolve } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { contentType } from '@std/media-types';
import { encodeBase64 } from '@std/encoding';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { getProjectAdminDir } from 'shared/projectPath.ts';
import { isPathWithinDataSource, listDirectory, type ListDirectoryOptions } from 'api/utils/fileHandling.ts';
import {
	type FileSuggestionsForPathOptions,
	type FileSuggestionsOptions,
	suggestFiles as getSuggestions,
	suggestFilesForPath as getSuggestionsForPath,
} from 'api/utils/fileSuggestions.ts';
import type { ResourceManager } from 'api/resources/resourceManager.ts';
//import type { FileMetadata } from 'shared/types.ts';

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
	{ request, response, state: _state }: {
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
		const projectAdminDir = await getProjectAdminDir(projectId);

		// Create .uploads directory if it doesn't exist
		const uploadsDir = join(projectAdminDir, '.uploads');
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
		logger.info(`FileHandler: Wrote uploaded file to: ${filePath}`);

		// Determine MIME type and if it's an image
		const mimeType = isFileObject(file) && 'type' in file
			? file.type
			: (contentType(extname(sanitizedName)) || 'text/plain');
		const isImage = mimeType.startsWith('image/');

		// Create metadata for the file
		const metadata: UploadedFileMetadata = {
			id: fileId,
			name: sanitizedName,
			//relativePath: `.uploads/${filename}`,
			relativePath: filename,
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
				logger.error(`FileHandler: Failed to read file index: ${error}`);
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
		const projectAdminDir = await getProjectAdminDir(projectId);
		const metadataPath = join(projectAdminDir, '.uploads', '.metadata', `${fileId}.json`);

		if (!(await exists(metadataPath))) {
			response.status = 404;
			response.body = { error: 'File not found' };
			return;
		}

		// Read file metadata
		const metadataContent = await Deno.readTextFile(metadataPath);
		const metadata = JSON.parse(metadataContent);

		// Remove physical file
		const filePath = join(projectAdminDir, '.uploads', metadata.name);
		if (await exists(filePath)) {
			await Deno.remove(filePath);
		}

		// Remove metadata file
		await Deno.remove(metadataPath);

		// Update index
		const indexPath = join(projectAdminDir, '.uploads', '.metadata', 'index.json');
		if (await exists(indexPath)) {
			try {
				const indexContent = await Deno.readTextFile(indexPath);
				const index = JSON.parse(indexContent);

				if (index[fileId]) {
					delete index[fileId];
					await Deno.writeTextFile(indexPath, JSON.stringify(index, null, 2));
				}
			} catch (error) {
				logger.error(`FileHandler: Failed to update file index: ${error}`);
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

		const projectAdminDir = await getProjectAdminDir(projectId);
		const indexPath = join(projectAdminDir, '.uploads', '.metadata', 'index.json');

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
			logger.error(`FileHandler: Failed to read file index: ${error}`);
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

export const serveFile = async (
	{ params, request, response }: {
		params: { resourceUrl: string };
		request: Context['request'];
		response: Context['response'];
	},
) => {
	try {
		const { resourceUrl } = params;
		const url = new URL(request.url);
		const thumbnail = url.searchParams.get('thumbnail') === 'true';
		const projectId = url.searchParams.get('projectId');

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Project ID is required' };
			return;
		}

		// Decode the resource URL (base64 encoded to handle special characters)
		let decodedResourceUrl: string;
		try {
			decodedResourceUrl = atob(decodeURIComponent(resourceUrl));
		} catch {
			// If decoding fails, try using the URL as-is
			decodedResourceUrl = decodeURIComponent(resourceUrl);
		}
		logger.info(`FileHandler: Serving file for: ${decodedResourceUrl}`);

		// Parse the internal resource URL format: bb+filesystem+uploads+file:./resourceId
		if (!decodedResourceUrl.startsWith('bb+filesystem+uploads+file:./')) {
			response.status = 400;
			response.body = { error: 'Invalid resource URL format' };
			return;
		}

		// Strip file extension from resourceId to get the UUID for metadata lookup
		const resourceId = basename(decodedResourceUrl, extname(decodedResourceUrl));
		// let resourceId = decodedResourceUrl.replace('bb+filesystem+uploads+file:./', '');

		const projectAdminDir = await getProjectAdminDir(projectId);
		const metadataPath = join(projectAdminDir, '.uploads', '.metadata', `${resourceId}.json`);
		logger.info(`FileHandler: Checking metadata file for: ${metadataPath}`);

		if (!(await exists(metadataPath))) {
			response.status = 404;
			response.body = { error: 'File not found' };
			return;
		}

		// Read file metadata
		const metadataContent = await Deno.readTextFile(metadataPath);
		const metadata = JSON.parse(metadataContent);

		// Get the actual file path
		const filePath = join(projectAdminDir, '.uploads', metadata.relativePath);
		logger.info(`FileHandler: Checking content file for: ${filePath}`);

		if (!(await exists(filePath))) {
			response.status = 404;
			response.body = { error: 'File content not found' };
			return;
		}

		const isImage = metadata.mimeType?.startsWith('image/') || false;

		if (thumbnail && isImage) {
			// Generate thumbnail for images
			const imageData = await Deno.readFile(filePath);
			logger.info(`FileHandler: Creating thumbnail for: ${filePath}`);

			// Use ImageMagick to create thumbnail (max 200px)
			try {
				// Import ImageMagick dynamically to avoid loading if not needed
				const { ImageMagick, initialize, MagickFormat } = await import('imagemagick');
				await initialize();

				const thumbnailData = await new Promise<Uint8Array>((resolve, reject) => {
					try {
						ImageMagick.read(imageData, (image) => {
							try {
								// Resize to max 200px on either dimension
								const MAX_THUMBNAIL_SIZE = 100;
								if (image.width > MAX_THUMBNAIL_SIZE || image.height > MAX_THUMBNAIL_SIZE) {
									if (image.width > image.height) {
										image.resize(MAX_THUMBNAIL_SIZE, 0);
									} else {
										image.resize(0, MAX_THUMBNAIL_SIZE);
									}
								}
								// Convert to PNG for consistent format
								image.write(MagickFormat.Png, (data) => {
									resolve(data);
								});
							} catch (err) {
								reject(err);
							}
						});
					} catch (err) {
						reject(err);
					}
				});

				response.headers.set('Content-Type', 'image/png');
				response.headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
				response.body = thumbnailData;
				return;
			} catch (error) {
				logger.error(`FileHandler: Failed to generate thumbnail: ${(error as Error).message}`);
				// Fall through to serve original file
			}
		}

		// Serve the original file
		const fileData = await Deno.readFile(filePath);
		const mimeType = metadata.mimeType || contentType(extname(metadata.name)) || 'application/octet-stream';

		response.headers.set('Content-Type', mimeType);
		response.headers.set('Content-Length', fileData.length.toString());
		response.headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

		// Set content disposition for download (except for images)
		if (!isImage || !thumbnail) {
			response.headers.set('Content-Disposition', `attachment; filename="${metadata.name}"`);
		}

		response.body = fileData;
	} catch (error) {
		logger.error(`FileHandler: Error serving file: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to serve file' };
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
		logger.error(`FileHandler: Error getting file suggestions for path: ${(error as Error).message}`);

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
		const { dirPath, only, matchingString, includeHidden, strictRoot } = await request.body.json();
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
		if (strictRoot !== undefined) options.strictRoot = strictRoot;

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
		if (!isPathWithinDataSource(homeDir, fullPath)) {
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
