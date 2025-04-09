import type { Resource } from 'api/types.ts';
import {
	type FileLoadOptions,
	getFileMetadata,
	IMAGE_DISPLAY_LIMIT,
	readFileWithOptions,
	TEXT_DISPLAY_LIMIT,
} from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/editor/projectEditor.ts';

export interface ResourceMCPConfig {
	serverId: string; // set in config as mcpServer[x].id
	resourceId: string; // `mcp:${serverId}:${mcpResource.name}` - mcpResource.name is server's internal resource name
	resourceName: string; // set in config as mcpServer[x].name (use id if name not set) - this is name the LLM sees
	description: string;
}

export interface ResourceMetadata {
	type: 'internal' | 'mcp';
	name: string;
	description?: string;
	uri: string;
	uriTemplate?: string;
	mimeType: string;
	path?: string;
	size?: number;
	lastModified?: Date;
	error?: string | null;
	mcpData?: ResourceMCPConfig;
}

// export interface MCPResourceMetadata extends ResourceMetadata {
// 	type: 'mcp';
// 	version: string;
// 	author: string;
// 	//license: string;
// 	category?: string | string[];
// 	config?: unknown;
// 	//mcpData?: ResourceMCPConfig;
// 	//examples?: Array<{ description: string; input: unknown }>;
// }

export class ResourceManager {
	private projectEditorRef!: WeakRef<ProjectEditor>;
	private mcpManager?: MCPManager;
	private resourceMetadata: Map<string, ResourceMetadata> = new Map();
	private resourceNameToIdMap: Map<string, string> = new Map();

	constructor(projectEditor: ProjectEditor & { projectInfo: ProjectInfo }) {
		this.projectEditorRef = new WeakRef(projectEditor);
		this.mcpManager = projectEditor.mcpManager;
	}
	async init(): Promise<ResourceManager> {
		if (this.mcpManager) await this.loadMCPResourcesMetadata(await this.mcpManager!.getServers());
		return this;
	}

	private get projectEditor(): ProjectEditor {
		const projectEditor = this.projectEditorRef.deref();
		if (!projectEditor) throw new Error('No projectEditor to deref from projectEditorRef');
		return projectEditor;
	}

	private async loadMCPResourcesMetadata(serverIds: string[]): Promise<void> {
		try {
			logger.debug(`ResourceManager: Loading resources from ${serverIds.length} MCP servers`);

			// For each MCP server (keyed by mcpServerConfig.id), load its resources
			for (const serverId of serverIds) {
				const mcpResources = await this.mcpManager!.listResources(serverId);
				const mcpServerConfig = this.mcpManager!.getMCPServerConfiguration(serverId);
				//logger.info(`ResourceManager: Found ${mcpResources.length} resources in MCP server ${serverId}`);
				if (!mcpServerConfig) {
					logger.error(`ResourceManager: Error loading MCP config for: ${serverId}`);
					continue;
				}

				// Register each resource with a unique ID
				for (const mcpResource of mcpResources) {
					const resourceId = `mcp:${serverId}:${mcpResource.name}`;
					const displayName = `${mcpResource.name}_${mcpServerConfig.name || mcpServerConfig.id}`;
					const llmResourceName = `${mcpResource.name}_${mcpServerConfig.id}`;

					// Add the MCP resource metadata
					this.resourceMetadata.set(resourceId, {
						name: llmResourceName, // LLM will see and use this name
						description: `${mcpResource.description || `MCP Resource ${displayName}`} (${
							mcpServerConfig.name || mcpServerConfig.id
						})`,
						//version: '1.0.0',
						//author: 'MCP Server',
						uri: mcpResource.uri,
						uriTemplate: mcpResource.uriTemplate,
						mimeType: mcpResource.mimeType,
						type: 'mcp',
						mcpData: {
							serverId,
							resourceId,
							resourceName: mcpResource.name, // server's internal resource name (same across server instances)
							description: mcpResource.description || 'MCP Resource',
						},
					});
					logger.info(
						`ResourceManager: Registered MCP resource ${mcpResource.name} from server ${serverId}`,
						this.resourceMetadata.get(resourceId),
					);

					// Create reverse mapping from display name to internal ID
					this.resourceNameToIdMap.set(llmResourceName, resourceId);

					//logger.debug(`ResourceManager: Registered MCP resource ${mcpResource.name} from server ${serverId}`);
				}
			}
		} catch (error) {
			logger.error(`ResourceManager: Error loading MCP resources: ${(error as Error).message}`);
		}
	}

	async loadResource(
		resource: Resource,
		options?: FileLoadOptions,
	): Promise<{ content: string | Uint8Array; metadata?: ResourceMetadata; truncated?: boolean }> {
		switch (resource.type) {
			case 'mcp':
				return this.loadMcpResource(resource.uri, options);
			case 'url':
				return this.loadUrlResource(resource.uri, options);
			case 'file':
				return this.loadFileResource(resource.uri, options);
			case 'memory':
				return this.loadMemoryResource(resource.uri, options);
			case 'api':
				return this.loadApiResource(resource.uri, options);
			case 'database':
				return this.loadDatabaseResource(resource.uri, options);
			case 'vector_search':
				return this.loadVectorSearchResource(resource.uri, options);
			default:
				throw new Error(`Unsupported resource type: ${resource.type}`);
		}
	}

	private async loadMcpResource(
		uri: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata?: ResourceMetadata; truncated?: boolean }> {
		// Check if this is an aliased name that maps to an internal ID
		const resourceId = this.resourceNameToIdMap.get(uri);

		const metadata = this.resourceMetadata.get(resourceId);
		if (!metadata) {
			logger.warn(`ResourceManager: Resource ${name} not found`);
			return undefined;
		}

		const mcpResource = await this.mcpManager!.loadResources(serverId, metadata.uri);

		return {
			content: mcpResource.content,
			metadata: {
				type: 'mcp',
				name: `MCP: ${uri}`,
				uri: uri,
				mimeType: mcpResource.mimeTYpe || 'text/plain',
				size: mcpResource.size ? parseInt(mcpResource.size) : mcpResource.content.length,
			},
		};
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
				type: 'internal',
				name: `URL: ${url}`,
				uri: url,
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
					type: 'internal',
					name: `File: ${path}`,
					uri: `file://${path}`,
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
				type: 'internal',
				name: `Memory: ${key}`,
				uri: `memory://${key}`,
				//path: key,
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
				type: 'internal',
				name: `API: ${endpoint}`,
				uri: `api://${endpoint}`,
				//path: endpoint,
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
				type: 'internal',
				name: `Database Query: ${query}`,
				uri: `db-query://${query}`,
				//path: query,
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
				type: 'internal',
				name: `Vector Query: ${query}`,
				uri: `vector://${query}`,
				//path: query,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}
}
