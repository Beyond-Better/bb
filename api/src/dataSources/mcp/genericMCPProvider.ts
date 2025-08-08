/**
 * GenericMCPProvider class for MCP-managed data sources.
 */
import { logger } from 'shared/logger.ts';
import { MCPDataSourceProvider } from '../base/mcpDataSourceProvider.ts';
import { GenericMCPAccessor } from './genericMCPAccessor.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type {
	DataSourceAuthMethod,
	DataSourceCapability,
	DataSourceEditCapability,
	DataSourceLoadCapability,
	DataSourceProviderStructuredQuerySchema,
	DataSourceSearchCapability,
} from 'shared/types/dataSource.ts';
import type { AcceptedContentType, AcceptedEditType, ContentTypeGuidance } from 'shared/types/dataSource.ts';

/**
 * GenericMCPProvider for MCP-managed data sources
 * Represents a data source type handled by an MCP server
 */
export class GenericMCPProvider extends MCPDataSourceProvider {
	/**
	 * Content types this provider accepts - MCP providers handle this internally
	 */
	public readonly acceptedContentTypes: AcceptedContentType[] = ['plainTextContent'];

	/**
	 * Edit approaches this provider supports - MCP providers handle this internally
	 */
	public readonly acceptedEditTypes: AcceptedEditType[] = [];

	/**
	 * Preferred content type for MCP operations
	 */
	public readonly preferredContentType: AcceptedContentType = 'plainTextContent';

	public loadCapabilities: DataSourceLoadCapability[] = [
		//'plainText',
		'structured',
		//'both',
	];
	public editCapabilities: DataSourceEditCapability[] = [
		//'searchReplaceOperations',
		//'rangeOperations',
		//'blockOperations',
		//'textFormatting', // Plain text only
		//'paragraphFormatting',
		//'tables',
		//'colors',
		//'fonts',
	];
	public searchCapabilities: DataSourceSearchCapability[] = [
		//'textSearch',
		//'regexSearch',
		//'structuredQuerySearch',
	];

	public structuredQuerySchema: DataSourceProviderStructuredQuerySchema | undefined = {
		description: 'MCP search with filters',
		examples: [
			// {
			// 	description: 'Find TypeScript files modified this week containing TODO',
			// 	query: {
			// 		text: 'TODO',
			// 		filters: {
			// 			extension: '.ts',
			// 			modifiedAfter: '2024-08-01',
			// 			path: 'src/',
			// 		},
			// 	},
			// }
		],
		schema: {
			type: 'object',
			properties: {
				// text: { type: 'string' },
				// filters: {
				// 	type: 'object',
				// 	properties: {
				// 		extension: { type: 'string' },
				// 		path: { type: 'string' },
				// 		modifiedAfter: { type: 'string', format: 'date' },
				// 		modifiedBefore: { type: 'string', format: 'date' },
				// 		sizeMin: { type: 'number' },
				// 		sizeMax: { type: 'number' },
				// 	},
				// },
			},
		},
	};

	/**
	 * Reference to the MCPManager that handles communication with MCP servers
	 */
	private mcpManager: MCPManager;

	/**
	 * MCP server capabilities (cached from server discovery)
	 */
	private serverCapabilities: Set<string>;

	/**
	 * Server configuration fields that should be required in data source connections
	 */
	private configRequirements: string[];

	/**
	 * Create a new GenericMCPProvider instance
	 * @param serverId The MCP server ID
	 * @param name Human-readable name
	 * @param description Description of the provider
	 * @param capabilities Array of supported capabilities
	 * @param requiredConfigFields Required configuration fields
	 * @param mcpManager The MCPManager instance
	 * @param authType Optional auth type
	 */
	constructor(
		serverId: string,
		name: string,
		description: string,
		requiredConfigFields: string[],
		mcpManager: MCPManager,
		authType: DataSourceAuthMethod = 'none',
		capabilities: DataSourceCapability[],
	) {
		super(
			serverId, // Provider ID is the server ID
			serverId, // Server ID
			name,
			description,
			requiredConfigFields,
			authType,
			capabilities,
		);

		this.mcpManager = mcpManager;
		this.serverCapabilities = new Set(capabilities);
		this.configRequirements = [...requiredConfigFields];

		logger.debug(`GenericMCPProvider: Created provider for MCP server ${serverId}`);
	}

	/**
	 * Get content type guidance for MCP data source
	 * @returns ContentTypeGuidance with MCP-specific information
	 */
	getContentTypeGuidance(): ContentTypeGuidance {
		return {
			primaryContentType: 'plain-text',
			acceptedContentTypes: this.acceptedContentTypes,
			acceptedEditTypes: this.acceptedEditTypes,
			preferredContentType: this.preferredContentType,
			capabilities: this.capabilities,
			editCapabilities: this.editCapabilities,
			searchCapabilities: this.searchCapabilities,
			structuredQuerySchema: this.structuredQuerySchema,
			examples: [
				{
					description: 'MCP data sources are managed by external servers',
					toolCall: {
						tool: 'mcp',
						input: {
							serverName: this.serverId,
							toolName: 'example-tool',
							toolInput: 'server-specific-parameters',
						},
					},
				},
			],
			notes: [
				'MCP data sources are handled by external Model Context Protocol servers',
				'Content type handling varies by specific MCP server implementation',
				'Use the mcp tool for operations on MCP-managed resources',
				'Capabilities and supported operations depend on the MCP server',
			],
		};
	}

	/**
	 * Create a ResourceAccessor for this MCP data source
	 * @param connection The connection to create an accessor for
	 * @returns A GenericMCPAccessor instance
	 */
	createAccessor(connection: DataSourceConnection): ResourceAccessor {
		// Verify the connection is for this provider
		if (connection.providerType !== this.providerType) {
			throw new Error(
				`Connection provider ID mismatch: expected ${this.providerType}, got ${connection.providerType}`,
			);
		}

		// Create a new GenericMCPAccessor
		return new GenericMCPAccessor(connection, this.mcpManager, this.serverId);
	}

	/**
	 * Validate configuration for this MCP data source
	 * @param config The configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	override validateConfig(config: Record<string, unknown>): boolean {
		// First check using the base validation
		if (!super.validateConfig(config)) {
			return false;
		}

		// Additional validation specific to this MCP server could be added here
		// This would depend on the specific requirements of the MCP server

		return true;
	}

	/**
	 * Get the capabilities supported by this MCP server
	 * @returns Array of capability strings
	 */
	getServerCapabilities(): string[] {
		return Array.from(this.serverCapabilities);
	}

	/**
	 * Check if this provider supports a specific capability
	 * @param capability The capability to check
	 * @returns True if the capability is supported
	 */
	override hasCapability(capability: string): boolean {
		return this.serverCapabilities.has(capability);
	}

	/**
	 * Factory method to create a GenericMCPProvider for an MCP server
	 * @param serverId The MCP server ID
	 * @param registry The DataSourceRegistry instance
	 * @returns Promise that resolves to the provider or null if the server isn't available
	 */
	static async createForServer(serverId: string): Promise<GenericMCPProvider | null> {
		try {
			const mcpManager = await getMCPManager();

			// Get the server configuration
			const serverConfig = mcpManager.getMCPServerConfiguration(serverId);
			if (!serverConfig) {
				logger.warn(`GenericMCPProvider: No configuration found for MCP server ${serverId}`);
				return null;
			}

			// Get the server capabilities
			let capabilities: DataSourceCapability[] = ['read', 'list']; // Minimum capabilities
			try {
				// This would be implemented in the future to query actual server capabilities
				// For now, we assume basic capabilities
				const serverCapabilities = mcpManager.getServerCapabilities(serverId);
				if (serverCapabilities) capabilities = serverCapabilities;
			} catch (error) {
				logger.warn(`GenericMCPProvider: Error getting capabilities for MCP server ${serverId}:`, error);
			}

			// Create the provider
			return new GenericMCPProvider(
				serverId,
				serverConfig.name || `MCP: ${serverId}`,
				serverConfig.description || `MCP Server: ${serverId}`,
				[], // No required config fields for now
				mcpManager,
				'none',
				capabilities,
			);
		} catch (error) {
			logger.error(`GenericMCPProvider: Error creating provider for MCP server ${serverId}:`, error);
			return null;
		}
	}

	/**
	 * Create an MCP data source with the specified configuration
	 * @param serverId The MCP server ID
	 * @param name Human-readable name for the data source
	 * @param config Provider-specific configuration
	 * @param registry Object that can create connections
	 * @param options Additional options
	 * @returns A new DataSourceConnection for an MCP data source
	 */
	// // Doesn't have access to projectConfig
	// static createMCPDataSource(
	// 	serverId: string,
	// 	name: string,
	// 	config: Record<string, unknown>,
	// 	registry: DataSourceRegistry,
	// 	options: {
	// 		id?: string;
	// 		enabled?: boolean;
	// 		isPrimary?: boolean;
	// 		priority?: number;
	// 	} = {},
	// ): DataSourceConnection {
	// 	const provider = registry.getProvider(
	// 		serverId, // Provider Type is the server ID for MCP providers
	// 		'mcp',
	// 	);
	// 	if (!provider) throw new Error('Could not load provider');
	// 	return registry.createConnection(
	// 		provider,
	// 		name,
	// 		config,
	// 		options,
	// 	);
	// }
}
