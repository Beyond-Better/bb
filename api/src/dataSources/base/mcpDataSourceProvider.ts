/**
 * Abstract base class for MCP-managed data source providers.
 * Extends BaseDataSourceProvider and sets the accessMethod to 'mcp'.
 */
import { BaseDataSourceProvider } from './baseDataSourceProvider.ts';
import type {
	DataSourceAccessMethod,
	DataSourceAuthMethod,
	DataSourceCapability,
	DataSourceProviderType,
} from 'shared/types/dataSource.ts';

/**
 * Abstract base class for MCP-managed data source providers
 * These are data sources delegated to external Model Context Protocol servers
 */
export abstract class MCPDataSourceProvider extends BaseDataSourceProvider {
	/**
	 * Access method is always 'mcp' for MCP-managed data sources
	 */
	public readonly accessMethod: DataSourceAccessMethod = 'mcp';

	public capabilities: DataSourceCapability[] = [
		'read',
		//'write',
		//'list',
		//'search',
		//'move',
		//'delete',
	];

	/**
	 * The ID of the MCP server that manages this data source
	 */
	public readonly serverId: string;

	/**
	 * Create a new MCPDataSourceProvider instance
	 * @param id Provider ID
	 * @param serverId MCP server ID
	 * @param name Human-readable name
	 * @param description Descriptive text
	 * @param capabilities Supported operations
	 * @param requiredConfigFields Required configuration fields
	 * @param authType Optional auth type
	 */
	constructor(
		providerType: DataSourceProviderType,
		serverId: string,
		name: string,
		description: string,
		requiredConfigFields: string[],
		authType: DataSourceAuthMethod = 'none',
		capabilities: DataSourceCapability[],
	) {
		super(providerType, name, description, requiredConfigFields, authType);
		this.capabilities = [...capabilities];
		this.serverId = serverId;
	}
}
