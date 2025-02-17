import type { Resource } from 'api/types.ts';
import {
	type FileLoadOptions,
	getFileMetadata,
	IMAGE_DISPLAY_LIMIT,
	readFileWithOptions,
	type ResourceMetadata,
	TEXT_DISPLAY_LIMIT,
} from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';

export class ResourceManager {
	constructor(private projectEditor: ProjectEditor) {}
	async loadResource(
		resource: Resource,
		options?: FileLoadOptions,
	): Promise<{ content: string | Uint8Array; metadata?: ResourceMetadata; truncated?: boolean }> {
		switch (resource.type) {
			case 'url':
				return this.loadUrlResource(resource.location, options);
			case 'file':
				return this.loadFileResource(resource.location, options);
			case 'memory':
				return this.loadMemoryResource(resource.location, options);
			case 'api':
				return this.loadApiResource(resource.location, options);
			case 'database':
				return this.loadDatabaseResource(resource.location, options);
			case 'vector_search':
				return this.loadVectorSearchResource(resource.location, options);
			default:
				throw new Error(`Unsupported resource type: ${resource.type}`);
		}
	}

	private async loadUrlResource(
		url: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata?: ResourceMetadata; truncated?: boolean }> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${url}`);
		}
		const content = await response.text();
		const contentType = response.headers.get('content-type');
		const contentLength = response.headers.get('content-length');

		return {
			content,
			metadata: {
				path: url,
				mimeType: contentType || 'text/plain',
				size: contentLength ? parseInt(contentLength) : content.length,
			},
		};
	}

	private async loadFileResource(
		path: string,
		options?: FileLoadOptions,
	): Promise<{ content: string | Uint8Array; metadata?: ResourceMetadata; truncated?: boolean }> {
		try {
			// Get file metadata first
			const metadata = await getFileMetadata(this.projectEditor.projectRoot, path);
			const isImage = metadata.mimeType.startsWith('image/');

			// Set default size limits if not provided
			const loadOptions: FileLoadOptions = {
				maxSize: isImage ? IMAGE_DISPLAY_LIMIT : TEXT_DISPLAY_LIMIT,
				...options,
			};

			// Read file with options
			const { content, truncated } = await readFileWithOptions(this.projectEditor.projectRoot, path, loadOptions);

			return {
				content,
				metadata: {
					//type: isImage ? 'image' : 'text',
					path,
					mimeType: metadata.mimeType || 'application/octet-stream',
					size: metadata.size,
					lastModified: metadata.lastModified,
				},
				truncated,
			};
		} catch (error) {
			logger.error(`ResourceManager: Failed to read file: ${path}. ${(error as Error).message}`);
			throw new Error(`Failed to read file: ${path}. ${(error as Error).message}`);
		}
	}

	private async loadMemoryResource(
		key: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata?: ResourceMetadata; truncated?: boolean }> {
		// Implement memory resource loading logic
		return {
			content: 'Memory resource loading not implemented yet',
			metadata: {
				path: key,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}

	private async loadApiResource(
		endpoint: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata?: ResourceMetadata; truncated?: boolean }> {
		// Implement API resource loading logic
		return {
			content: 'API resource loading not implemented yet',
			metadata: {
				path: endpoint,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}

	private async loadDatabaseResource(
		query: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata?: ResourceMetadata; truncated?: boolean }> {
		// Implement database resource loading logic
		return {
			content: 'Database resource loading not implemented yet',
			metadata: {
				path: query,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}

	private async loadVectorSearchResource(
		query: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata?: ResourceMetadata; truncated?: boolean }> {
		// Implement vector search resource loading logic
		return {
			content: 'Vector search resource loading not implemented yet',
			metadata: {
				path: query,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}
}
