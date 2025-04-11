/**
 * DataSource class for BB system.
 * Represents any source of data (filesystem, database, MCP, etc.)
 */
import { logger } from 'shared/logger.ts';
import { generateDataSourcePrefix, generateDataSourceUri } from 'shared/dataSource.ts';
import { generateId } from 'shared/projectData.ts';

/**
 * Types of supported data sources
 */
export type DataSourceType =
	| 'filesystem' // Local file system
	| 'database' // Database connections
	| 'notion' // Notion workspaces
	| 'gdrive' // Google Drive
	| 'mcp' // Model Context Protocol servers
	| string; // Future extensions and MCP types

/**
 * How BB accesses the data source
 */
export type DataSourceAccessMethod =
	| 'bb' // Managed directly by BB
	| 'mcp'; // Delegated to MCP server

/**
 * Available authentication methods
 */
export type DataSourceAuthMethod =
	| 'none' // No authentication required
	| 'apiKey' // Simple API key
	| 'oauth2' // OAuth 2.0 (placeholder for future implementation)
	| 'basic' // Basic auth (username/password)
	| 'bearer' // Bearer token
	| 'custom'; // Custom auth method

/**
 * Authentication configuration
 */
export interface DataSourceAuth {
	method: DataSourceAuthMethod; // Authentication method
	apiKey?: string; // For apiKey auth (simple implementation)

	// References to future secure credential storage
	// These would be keys to look up in a secure storage mechanism
	credentialRefs?: string[];

	// Placeholder fields for future auth methods
	// These would be implemented later with proper secure storage
	/*
  oauth2?: {
    clientId: string;
    tokenData?: {
      expiresAt: number;
      scope: string;
      tokenType: string;
    };
  };
  basic?: {
    usernameRef: string;
    passwordRef: string;
  };
  bearer?: {
    tokenRef: string;
  };
  */
}

/**
 * MCP server configuration for a data source
 */
export interface MCPConfig {
	serverId: string; // ID of the MCP server
	description?: string; // Optional description
}

/**
 * Data source for system prompt - simplified version
 */
export interface DataSourceForSystemPrompt extends Omit<DataSourceValues, 'enabled' | 'auth' | 'accessMethod'> {
	// This interface explicitly omits fields that shouldn't be in the system prompt
}

/**
 * Data source values - used for internal representation and serialization
 */
export interface DataSourceValues {
	id: string; // Unique identifier (used in URIs)
	name: string; // Human-readable name
	type: DataSourceType; // Type of data source - also used as serverId for MCP datasources
	accessMethod: DataSourceAccessMethod; // How BB accesses this source
	capabilities: string[]; // Operations supported ("list", "read", "write", etc.)
	description: string; // User-friendly description
	enabled: boolean; // Whether the data source is active
	isPrimary: boolean; // Whether this is the primary data source
	priority: number; // Priority for ordering (higher = more important)
	uriTemplate?: string; // Optional URI template
	uriPrefix?: string; // Optional URI prefix override (default: <accessMethod>-<type>-<name>://)
	config: Record<string, unknown>; // Source-specific configuration (non-sensitive)
	auth?: DataSourceAuth; // Authentication configuration
	//mcpConfig?: MCPConfig; // MCP server configuration
}

/**
 * DataSource class representing a source of data in the BB system
 */
export class DataSource implements DataSourceValues {
	id: string;
	name: string;
	type: DataSourceType;
	accessMethod: DataSourceAccessMethod;
	capabilities: string[];
	description: string;
	enabled: boolean;
	isPrimary: boolean;
	priority: number;
	uriTemplate?: string;
	uriPrefix?: string;
	config: Record<string, unknown>;
	auth?: DataSourceAuth;
	//mcpConfig?: MCPConfig;

	/**
	 * Create a new DataSource instance
	 * @param props Properties to initialize the data source with (id is required)
	 */
	constructor(props: Partial<DataSourceValues> & { id: string }) {
		this.id = props.id;
		this.name = props.name || props.id;
		this.type = props.type || 'filesystem';
		this.uriTemplate = props.uriTemplate; // || 'file:./{path}';
		this.accessMethod = props.accessMethod || 'bb';
		this.capabilities = props.capabilities || ['read'];
		this.description = props.description ||
			`Source for ${props.name || props.id} using ${props.type || 'filesystem'}`;
		this.enabled = !!props.enabled;
		this.isPrimary = !!props.isPrimary;
		this.priority = props.priority || 0;
		this.config = props.config || {};
		this.auth = props.auth || { method: 'none' };

		// Optional properties
		if (props.uriPrefix) this.uriPrefix = props.uriPrefix;
		//if (props.mcpConfig) this.mcpConfig = { ...props.mcpConfig };
	}

	/**
	 * Get the data source root path (for filesystem sources)
	 * @returns The root path or empty string if not defined
	 */
	get dataSourceRoot(): string {
		return (this.config.dataSourceRoot as string) || '';
	}
	set dataSourceRoot(root: string) {
		this.config.dataSourceRoot = root;
	}
	getDataSourceRoot(): string {
		return (this.config.dataSourceRoot as string) || '';
	}
	setDataSourceRoot(root: string): void {
		this.config.dataSourceRoot = root;
	}

	/**
	 * Check if this data source supports writing
	 * @returns True if the data source supports writing
	 */
	canWrite(): boolean {
		return this.capabilities.includes('write');
	}

	/**
	 * Check if this data source supports reading
	 * @returns True if the data source supports reading
	 */
	canRead(): boolean {
		return this.capabilities.includes('read');
	}

	/**
	 * Check if this data source supports listing resources
	 * @returns True if the data source supports listing
	 */
	canList(): boolean {
		return this.capabilities.includes('list');
	}

	/**
	 * Check if this data source supports searching resources
	 * @returns True if the data source supports searching
	 */
	canSearch(): boolean {
		return this.capabilities.includes('search');
	}

	/**
	 * Set this data source as primary
	 * @param isPrimary Whether this is the primary data source
	 */
	setPrimary(isPrimary: boolean = true): void {
		this.isPrimary = isPrimary;
	}

	/**
	 * Set the priority of this data source
	 * @param priority Priority value (higher = more important)
	 */
	setPriority(priority: number): void {
		this.priority = priority;
	}

	/**
	 * Get the URI prefix for this data source
	 * @returns The URI prefix to use for resources from this data source
	 */
	getUriPrefix(): string {
		return this.uriPrefix || generateDataSourcePrefix(this.accessMethod, this.type, this.name);
	}

	/**
	 * Get the URI prefix for this data source
	 * @returns The URI prefix to use for resources from this data source
	 */
	getUriForResource(resourceUri: string): string {
		logger.info(`DataSource: getUriForResource ${resourceUri}`);
		return this.uriPrefix || generateDataSourceUri(this.accessMethod, this.type, this.name, resourceUri);
	}

	/**
	 * Create a simplified version of this data source for the system prompt
	 * @returns DataSourceForSystemPrompt object
	 */
	getForSystemPrompt(): DataSourceForSystemPrompt {
		// Destructure to remove unwanted properties
		const {
			enabled: _enabled,
			auth: _auth,
			accessMethod: _accessMethod,
			//mcpConfig: _mcpConfig,
			...rest
		} = this;
		return rest as DataSourceForSystemPrompt;
	}

	/**
	 * Create a clean version of this data source for serialization
	 * Omits sensitive auth data
	 * @returns Safe object for serialization
	 */
	toJSON(): DataSourceValues {
		const result: DataSourceValues = {
			id: this.id,
			name: this.name,
			type: this.type,
			accessMethod: this.accessMethod,
			capabilities: [...this.capabilities],
			description: this.description,
			enabled: this.enabled,
			isPrimary: this.isPrimary,
			priority: this.priority,
			config: { ...this.config },
		};

		if (this.uriPrefix) result.uriPrefix = this.uriPrefix;

		// Handle auth data - redact sensitive fields
		if (this.auth) {
			// const sanitizedAuth = { ...this.auth };
			//
			// // For API key auth, just note that it exists but don't store the key
			// if (sanitizedAuth.method === 'apiKey' && sanitizedAuth.apiKey) {
			// 	sanitizedAuth.apiKey = '[REDACTED]'; // Placeholder to indicate key exists
			// }
			//
			// result.auth = sanitizedAuth;
			result.auth = { ...this.auth };
		}

		// // Include MCP configuration if present
		// if (this.mcpConfig) {
		// 	result.mcpConfig = { ...this.mcpConfig };
		// }

		return result;
	}

	/**
	 * Create a data source from a plain object
	 * @param obj The object to create a DataSource from
	 * @returns A new DataSource instance
	 */
	static fromObject(obj: Partial<DataSourceValues> & { id: string }): DataSource {
		return new DataSource(obj);
	}

	/**
	 * Create a filesystem data source
	 * @param id The data source ID
	 * @param root The filesystem root path
	 * @param props Additional properties to set
	 * @returns A new DataSource instance configured for filesystem access
	 */
	static createFileSystem(
		name: string,
		root: string,
		props: Partial<DataSourceValues> = {},
	): DataSource {
		return new DataSource({
			id: props.id || `ds-${generateId()}`,
			name,
			type: 'filesystem',
			uriTemplate: 'file:./{path}',
			capabilities: ['read', 'write', 'list', 'search'],
			description: props.description || `Source for ${name || props.id} using 'filesystem'`,
			config: {
				dataSourceRoot: root,
				...(props.config || {}),
			},
			isPrimary: props.isPrimary || false,
			priority: props.priority || 0,
			...props,
		});
	}

	/**
	 * Create a primary filesystem data source
	 * @param id The data source ID
	 * @param root The filesystem root path
	 * @param props Additional properties to set
	 * @returns A new DataSource instance configured as primary filesystem
	 */
	static createPrimaryFileSystem(
		name: string,
		root: string,
		props: Partial<DataSourceValues> = {},
	): DataSource {
		return new DataSource({
			id: props.id || `ds-${generateId()}`,
			name,
			type: 'filesystem',
			uriTemplate: 'file:./{path}',
			capabilities: ['read', 'write', 'list', 'search'],
			description: props.description || `Source for ${name || props.id} using 'filesystem'`,
			config: {
				dataSourceRoot: root,
				...(props.config || {}),
			},
			isPrimary: true,
			priority: props.priority || 100, // High priority by default
			...props,
		});
	}

	/**
	 * Create an MCP data source
	 * @param serverId The MCP server ID
	 * @param props Additional properties to set
	 * @returns A new DataSource instance configured for MCP access
	 */
	static createMCP(serverId: string, name: string, props: Partial<DataSourceValues> = {}): DataSource {
		const id = props.id || `ds-${serverId}`;
		return new DataSource({
			id,
			name: name || `MCP: ${serverId}`,
			type: serverId,
			uriTemplate: props.uriTemplate,
			accessMethod: 'mcp',
			capabilities: ['read', 'list'],
			description: props.description || `Source for ${name || props.id} using ${serverId}`,
			//uriPrefix: `mcp-${serverId}-`,
			// mcpConfig: {
			// 	serverId,
			// 	...(props.mcpConfig || {}),
			// },
			isPrimary: props.isPrimary || false,
			priority: props.priority || 0,
			...props,
		});
	}

	/**
	 * Create a database data source
	 * @param name The data source name
	 * @param connectionString The database connection string or config
	 * @param props Additional properties to set
	 * @returns A new DataSource instance configured for database access
	 */
	static createDatabase(
		name: string,
		connectionString: string,
		props: Partial<DataSourceValues> = {},
	): DataSource {
		const id = props.id || `ds-${generateId()}`;
		return new DataSource({
			id,
			name: name || `Database: ${id}`,
			type: 'database',
			uriTemplate: props.uriTemplate || 'database://{db}{?query}',
			accessMethod: 'bb',
			capabilities: ['read', 'query'],
			description: props.description || `Source for ${name || props.id} using 'database'`,
			config: {
				connectionString,
				...(props.config || {}),
			},
			isPrimary: props.isPrimary || false,
			priority: props.priority || 0,
			...props,
		});
	}

	/**
	 * Convert DataSource objects to filesystem paths
	 */
	static getDataSourcePathsFromDataSources(dataSources: DataSourceValues[]): string[] {
		const paths: string[] = [];

		for (const dataSource of dataSources) {
			if (dataSource.type === 'filesystem' && dataSource.config.dataSourceRoot) {
				paths.push(dataSource.config.dataSourceRoot as string);
			}
		}

		return paths;
	}

	/**
	 * Convert filesystem paths to DataSource objects
	 */
	static getDataSourcesFromPaths(dataSourcePaths: string[]): DataSource[] {
		const dataSources: DataSource[] = [];

		for (let i = 0; i < dataSourcePaths.length; i++) {
			const path = dataSourcePaths[i];
			dataSources.push(
				DataSource.createFileSystem(
					i === 0 ? 'local' : `local-${i}`, //name
					path,
					{
						//id: i === 0 ? 'local' : `local-${i}`,
						isPrimary: i === 0,
						capabilities: ['read', 'write', 'list', 'search'],
					},
				),
			);
		}

		return dataSources;
	}

	/**
	 * Update this data source with values from another data source or values object
	 * @param updates Properties to update on this data source
	 */
	update(updates: Partial<DataSourceValues>): void {
		// Apply updates to properties
		//logger.info(`DataSource: Updating ${this.id}`, { updates });
		Object.keys(updates).forEach((key) => {
			const prop = key as keyof DataSourceValues;
			if (prop === 'config' && updates.config) {
				// Special handling for config - merge rather than replace
				this.config = { ...this.config, ...updates.config };
			} else if (prop !== 'id') { // Don't allow changing ID
				// @ts-ignore: Safe because we're checking key exists
				this[prop] = updates[prop];
			}
		});
	}

	/**
	 * Create a deep clone of this data source
	 * @returns A new DataSource instance with the same values
	 */
	clone(): DataSource {
		return DataSource.fromObject(this.toJSON());
	}

	/**
	 * Static helper to create a collection of data sources from values
	 * @param values Array of data source values
	 * @returns Array of DataSource instances
	 */
	static createCollection(values: DataSourceValues[]): DataSource[] {
		return values.map((value) => DataSource.fromObject(value));
	}
}
