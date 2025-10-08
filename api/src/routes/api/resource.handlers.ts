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
	type ResourceSuggestionsForPathOptions,
	type ResourceSuggestionsOptions,
	suggestResources as getSuggestions,
	suggestResourcesForPath as getSuggestionsForPath,
} from '../../utils/resourceSuggestions.utils.ts';
import type { ResourceManager } from 'api/resources/resourceManager.ts';
//import type { FileMetadata } from 'shared/types.ts';

// Define file metadata interface
interface UploadedResourceMetadata {
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

export const addResource = async (
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
			response.body = { error: 'No resource provided' };
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

		// Validate resource size (5MB limit)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			response.status = 400;
			response.body = { error: 'Resource exceeds maximum size of 5MB' };
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
		const resourceId = crypto.randomUUID();
		const originalExt = isFileObject(file) && file.name ? extname(file.name) : '';
		const ext = originalExt ||
			(isFileObject(file) && file.type?.startsWith('image/') ? `.${file.type.split('/')[1]}` : '.bin');

		const filename = `${resourceId}${ext}`;
		const sanitizedName = isFileObject(file) && file.name
			? file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
			: `uploaded-file-${resourceId}${ext}`;

		// Write resource to project uploads directory
		const filePath = join(uploadsDir, filename);
		if (!isFileObject(file)) {
			throw new Error('Resource is not a valid File object');
		}
		const fileBuffer = await file.arrayBuffer();
		const fileArray = new Uint8Array(fileBuffer);
		await Deno.writeFile(filePath, fileArray);
		logger.info(`ResourceHandler: Wrote uploaded resource to: ${filePath}`);

		// Determine MIME type and if it's an image
		const mimeType = isFileObject(file) && 'type' in file
			? file.type
			: (contentType(extname(sanitizedName)) || 'text/plain');
		const isImage = mimeType.startsWith('image/');

		// Create metadata for the resource
		const metadata: UploadedResourceMetadata = {
			id: resourceId,
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

		// Store individual resource metadata
		const metadataPath = join(metadataDir, `${resourceId}.json`);
		await Deno.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2));

		// Update resource index
		const indexPath = join(metadataDir, 'index.json');
		let index: Record<string, UploadedResourceMetadata> = {};

		if (await exists(indexPath)) {
			try {
				const indexContent = await Deno.readTextFile(indexPath);
				index = JSON.parse(indexContent);
			} catch (error) {
				logger.error(`ResourceHandler: Failed to read resource index: ${error}`);
				// Continue with empty index if resource is corrupted
			}
		}

		// Add to index
		index[resourceId] = metadata;

		// Write updated index
		await Deno.writeTextFile(indexPath, JSON.stringify(index, null, 2));

		// Return success response with metadata
		response.status = 200;
		response.body = {
			success: true,
			resourceId,
			metadata,
		};
	} catch (error) {
		logger.error(`ResourceHandler: Error adding resource: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to add resource' };
	}
};

export const removeResource = async (
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

		const resourceId = params.id;
		const projectAdminDir = await getProjectAdminDir(projectId);
		const metadataPath = join(projectAdminDir, '.uploads', '.metadata', `${resourceId}.json`);

		if (!(await exists(metadataPath))) {
			response.status = 404;
			response.body = { error: 'Resource not found' };
			return;
		}

		// Read resource metadata
		const metadataContent = await Deno.readTextFile(metadataPath);
		const metadata = JSON.parse(metadataContent);

		// Remove physical file
		const filePath = join(projectAdminDir, '.uploads', metadata.name);
		if (await exists(filePath)) {
			await Deno.remove(filePath);
		}

		// Remove metadata resource
		await Deno.remove(metadataPath);

		// Update index
		const indexPath = join(projectAdminDir, '.uploads', '.metadata', 'index.json');
		if (await exists(indexPath)) {
			try {
				const indexContent = await Deno.readTextFile(indexPath);
				const index = JSON.parse(indexContent);

				if (index[resourceId]) {
					delete index[resourceId];
					await Deno.writeTextFile(indexPath, JSON.stringify(index, null, 2));
				}
			} catch (error) {
				logger.error(`ResourceHandler: Failed to update resource index: ${error}`);
			}
		}

		response.status = 200;
		response.body = {
			success: true,
			message: `Resource ${resourceId} removed from project`,
		};
	} catch (error) {
		logger.error(`ResourceHandler: Error removing resource: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to remove resource' };
	}
};

export const listResources = async (
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
				resources: [],
			};
			return;
		}

		try {
			const indexContent = await Deno.readTextFile(indexPath);
			const index = JSON.parse(indexContent);
			const resources = Object.values(index);

			response.status = 200;
			response.body = {
				success: true,
				resources,
			};
		} catch (error) {
			logger.error(`ResourceHandler: Failed to read resource index: ${error}`);
			response.status = 500;
			response.body = { error: 'Failed to read resource index' };
		}
	} catch (error) {
		logger.error(`ResourceHandler: Error listing resources: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to list resources' };
	}
};

export const suggestResources = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const options: ResourceSuggestionsOptions = await request.body.json();

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

		logger.info(`ResourceHandler: Getting suggestions for path: ${options.partialPath}`);

		const result = await getSuggestions(options);
		response.body = result;
	} catch (error) {
		logger.error(`ResourceHandler: Error getting resource suggestions: ${(error as Error).message}`);

		if ((error as Error).name === ErrorType.ResourceHandling) {
			response.status = 400;
			response.body = { error: (error as Error).message };
		} else {
			response.status = 500;
			response.body = { error: 'Failed to get resource suggestions' };
		}
	}
};

export const serveResource = async (
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
		logger.info(`ResourceHandler: Serving resource for: ${decodedResourceUrl}`);

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
		logger.info(`ResourceHandler: Checking metadata resource for: ${metadataPath}`);

		if (!(await exists(metadataPath))) {
			response.status = 404;
			response.body = { error: 'Resource not found' };
			return;
		}

		// Read resource metadata
		const metadataContent = await Deno.readTextFile(metadataPath);
		const metadata = JSON.parse(metadataContent);

		// Get the actual file path
		const filePath = join(projectAdminDir, '.uploads', metadata.relativePath);
		logger.info(`ResourceHandler: Checking content resource for: ${filePath}`);

		if (!(await exists(filePath))) {
			response.status = 404;
			response.body = { error: 'Resource content not found' };
			return;
		}

		const isImage = metadata.mimeType?.startsWith('image/') || false;

		if (thumbnail && isImage) {
			// Generate thumbnail for images
			const imageData = await Deno.readFile(filePath);
			logger.info(`ResourceHandler: Creating thumbnail for: ${filePath}`);

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
				logger.error(`ResourceHandler: Failed to generate thumbnail: ${(error as Error).message}`);
				// Fall through to serve original resource
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
		logger.error(`ResourceHandler: Error serving resource: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to serve resource' };
	}
};

export const suggestResourcesForPath = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const options: ResourceSuggestionsForPathOptions = await request.body.json();
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

		logger.info(
			`ResourceHandler: Getting suggestions for path: ${options.partialPath} in ${options.rootPath} for project: ${options.projectId}`,
		);

		const result = await getSuggestionsForPath(options);
		response.body = result;
	} catch (error) {
		logger.error(`ResourceHandler: Error getting resource suggestions for path: ${(error as Error).message}`);

		if ((error as Error).name === ErrorType.ResourceHandling) {
			response.status = 400;
			response.body = { error: (error as Error).message };
		} else {
			response.status = 500;
			response.body = { error: 'Failed to get resource suggestions' };
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
		logger.error(`ResourceHandler: Error listing directory: ${(error as Error).message}`);

		if ((error as Error).name === ErrorType.ResourceHandling) {
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
			throw createError(ErrorType.ResourceHandling, 'Unable to determine user home directory');
		}

		const fullPath = resolve(join(homeDir, partialPath));

		// Ensure resolved path is within project
		if (!isPathWithinDataSource(homeDir, fullPath)) {
			throw createError(ErrorType.ResourceHandling, 'Resolved path outside project directory');
		}

		response.body = { fullPath };
	} catch (error) {
		logger.error(`ResourceHandler: Error resolving path: ${(error as Error).message}`);

		if ((error as Error).name === ErrorType.ResourceHandling) {
			response.status = 400;
			response.body = { error: (error as Error).message };
		} else {
			response.status = 500;
			response.body = { error: 'Failed to resolve path' };
		}
	}
};
