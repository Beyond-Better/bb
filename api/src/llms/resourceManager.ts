import type { Resource } from 'api/types.ts';

export class ResourceManager {
	async loadResource(resource: Resource): Promise<string | Uint8Array> {
		switch (resource.type) {
			case 'url':
				return this.loadUrlResource(resource.location);
			case 'file':
				return this.loadFileResource(resource.location);
			case 'memory':
				return this.loadMemoryResource(resource.location);
			case 'api':
				return this.loadApiResource(resource.location);
			case 'database':
				return this.loadDatabaseResource(resource.location);
			case 'vector_search':
				return this.loadVectorSearchResource(resource.location);
			default:
				throw new Error(`Unsupported resource type: ${resource.type}`);
		}
	}

	private async loadUrlResource(url: string): Promise<string> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${url}`);
		}
		return await response.text();
	}

	private async loadFileResource(path: string): Promise<string | Uint8Array> {
		try {
			if (path.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
				return await Deno.readFile(path);
			} else {
				return await Deno.readTextFile(path);
			}
		} catch (error) {
			throw new Error(`Failed to read file: ${path}. ${(error as Error).message}`);
		}
	}

	private async loadMemoryResource(_key: string): Promise<string> {
		// Implement memory resource loading logic
		throw new Error('Memory resource loading not implemented yet');
	}

	private async loadApiResource(_endpoint: string): Promise<string> {
		// Implement API resource loading logic
		throw new Error('API resource loading not implemented yet');
	}

	private async loadDatabaseResource(_query: string): Promise<string> {
		// Implement database resource loading logic
		throw new Error('Database resource loading not implemented yet');
	}

	private async loadVectorSearchResource(_query: string): Promise<string> {
		// Implement vector search resource loading logic
		throw new Error('Vector search resource loading not implemented yet');
	}
}
