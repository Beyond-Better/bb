/**
 * Types of supported data sources
 */
export type DataSourceProviderType =
	| 'filesystem' // Local file system
	| 'database' // Database connections
	| 'notion' // Notion workspaces
	| 'gdrive' // Google Drive
	| 'mcp' // Model Context Protocol servers
	| string; // Future extensions and MCP types

/**
 * Information about a data source type
 */
export interface DataSourceProviderInfo {
	id: string;
	name: string;
	providerType: DataSourceProviderType;
	accessMethod: 'bb' | 'mcp';
	capabilities: DataSourceCapability[];
	description?: string;
	configFields?: string[]; // For future use
}

/**
 * Access method for data sources - critical architectural distinction
 * How BB accesses the data source
 */
export type DataSourceAccessMethod =
	| 'bb' // Managed directly by BB
	| 'mcp'; // Delegated to MCP server

/**
 * Capabilities for data sources
 */
export type DataSourceCapability = 'read' | 'write' | 'list' | 'search' | 'move' | 'delete'; // Delegated to MCP server

/**
 * Available authentication methods
 */
export type DataSourceAuthMethod =
	| 'none' // No authentication required
	| 'apiKey' // Simple API key
	| 'basic' // Basic auth (username/password)
	| 'bearer' // Bearer token
	| 'oauth2' // OAuth 2.0 (placeholder for future implementation)
	| 'custom'; // Custom auth method

/**
 * Authentication configuration
 */
export interface DataSourceAuthBasic {
	usernameRef: string;
	passwordRef: string;
}
export interface DataSourceAuthBearer {
	tokenRef: string;
}
export interface DataSourceAuth {
	method: DataSourceAuthMethod; // Authentication method
	apiKey?: string; // For apiKey auth (simple implementation)

	// References to future secure credential storage
	// These would be keys to look up in a secure storage mechanism
	credentialRefs?: string[];

	basic?: DataSourceAuthBasic;
	bearer?: DataSourceAuthBearer;

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
	 */
}

/**
 * MCP server configuration for a data source
 */
export interface MCPConfig {
	serverId: string; // ID of the MCP server
	description?: string; // Optional description
}
