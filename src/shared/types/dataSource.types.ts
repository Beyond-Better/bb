/**
 * Types of supported data sources
 */
export type DataSourceProviderType =
	| 'filesystem' // Local file system
	| 'database' // Database connections
	| 'notion' // Notion workspaces
	| 'googledocs' // Google Drive
	//| 'supabase' // Supabase projects
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

export interface DataSourceMetadata {
	totalResources: number;
	resourceTypes: Record<string, number>;
	lastScanned: string;
	filesystem?: DataSourceMetadataFilesystem;
	notion?: DataSourceMetadataNotion;
	googledocs?: DataSourceMetadataGoogleDocs;
}

// Filesystem-specific metadata
export interface DataSourceMetadataFilesystem {
	totalDirectories: number;
	totalFiles: number;
	largestFileSize?: number;
	deepestPathDepth?: number;
	fileExtensions?: Record<string, number>; // e.g., { '.ts': 50, '.md': 10, '.json': 5 }
	oldestFileDate?: string; // ISO 8601 string
	newestFileDate?: string; // ISO 8601 string
	// LLM-critical operational metadata
	capabilities?: {
		canRead: boolean; // We can scan, so we can read
		canWrite: boolean; // Will test below
		canDelete: boolean; // Will test below
		canMove: boolean; // Will test below
		hasRestrictedAreas: boolean; // Will detect below - Some areas may be inaccessible
	};
	contentVisibility?: {
		includesHiddenFiles: boolean; // Based on our exclude patterns - Files starting with .
		includesDotDirectories: boolean; // We skip .git, .bb, etc.
		followsSymlinks: boolean; // walk options set includeSymlinks: false
		brokenSymlinkCount: number;
		filteredByGitignore: boolean; // We use getExcludeOptions
		filteredByBBIgnore: boolean;
	};
	practicalLimits?: {
		maxFileSize: number; // Largest file that can be processed - 10MB reasonable limit for text processing
		recommendedPageSize: number; // Optimal pageSize for this datasource - Good balance for filesystem
		hasVeryLargeFiles: boolean; // Files that might timeout/fail to load - Will detect below
	};
	contentAnalysis?: {
		textFileCount: number;
		binaryFileCount: number;
		likelyEncodingIssues: number; // Files that might have encoding problems
		emptyFileCount: number;
	};
}

// Notion-specific metadata
export interface DataSourceMetadataNotion {
	totalPages: number;
	totalDatabases: number;
	pageTypes: Record<string, number>; // e.g., { 'database': 5, 'page': 25 }
	workspaceInfo?: {
		name: string;
		id: string;
	};
}

// GoogleDocs-specific metadata
export interface DataSourceMetadataGoogleDocs {
	totalDocuments: number;
	folderId?: string;
	driveId?: string;

	documentTypes?: Record<string, number>; // e.g., { 'text': 5, 'spreadsheet': 25 }
	workspaceInfo?: {
		name: string;
		id: string;
	};
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
export type DataSourceCapability = 'read' | 'write' | 'list' | 'search' | 'move' | 'delete' | 'blockRead' | 'blockEdit'; // Delegated to MCP server

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
export interface DataSourceAuthOauth2 {
	tokenType?: string;
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
	scopes?: string;
}

// Important - there is also AuthConfig interface in api/dataSources/interfaces/authentication.ts - which is the canonical definition??
export interface DataSourceAuth {
	method: DataSourceAuthMethod; // Authentication method
	apiKey?: string; // For apiKey auth (simple implementation)

	basic?: DataSourceAuthBasic;
	bearer?: DataSourceAuthBearer;

	oauth2?: DataSourceAuthOauth2;

	// References to future secure credential storage
	// These would be keys to look up in a secure storage mechanism
	credentialRefs?: string[];
}

/**
 * MCP server configuration for a data source
 */
export interface MCPConfig {
	serverId: string; // ID of the MCP server
	description?: string; // Optional description
}
