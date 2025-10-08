/**
 * Types of supported data sources
 */
export type DataSourceProviderType =
	| 'filesystem' // Local file system
	| 'database' // Database connections
	| 'notion' // Notion workspaces
	| 'google' // Google Drive
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

// not used directly; can be composed from capabilities: DataSourceCapability[]
export interface DataSourceProviderCapabilities {
	// Edit operation support
	supportsSearchReplace: boolean;
	supportsRangeOperations: boolean;
	supportsBlockOperations: boolean;

	// Rich content support
	supportsTextFormatting: boolean;
	supportsParagraphFormatting: boolean;
	supportsTables: boolean;
	supportsColors: boolean;
	supportsFonts: boolean;

	supportsTextSearch: boolean;
	supportsRegexSearch: boolean;
	supportsStructuredQuerySearch: boolean;
}
export interface DataSourceProviderStructuredQuerySchema {
	description: string;
	examples: Array<Record<string, any>>;
	schema: Record<string, any>;
}

// =============================================================================
// CONTENT TYPE GUIDANCE TYPES
// =============================================================================

/**
 * Content type that a data source can accept
 */
export type AcceptedContentType = 'plainTextContent' | 'structuredContent' | 'binaryContent';

/**
 * Edit approach that a data source supports
 */
export type AcceptedEditType = 'searchReplace' | 'blocks' | 'range' | 'cellOperations' | 'structuredData';

/**
 * Primary content type classification for data sources
 */
export type PrimaryContentType = 'plain-text' | 'structured' | 'binary' | 'database';

/**
 * Example tool call for content type guidance
 */
export interface ContentTypeExample {
	/** Description of what this example demonstrates */
	description: string;
	/** Example tool call object */
	toolCall: {
		/** Name of the tool */
		tool: string;
		/** Example input parameters */
		input: Record<string, any>;
	};
}

/**
 * Content type guidance provided by data source providers
 * Helps LLMs understand what content types and operations are supported
 */
export interface ContentTypeGuidance {
	/** Primary content type classification */
	primaryContentType: PrimaryContentType;
	/** Array of content types this data source accepts */
	acceptedContentTypes: AcceptedContentType[];
	/** Array of edit approaches this data source supports */
	acceptedEditTypes: AcceptedEditType[];
	/** Preferred content type for this data source */
	preferredContentType: AcceptedContentType;
	/** Array of usage examples showing proper tool calls */
	examples: ContentTypeExample[];
	/** Additional notes or constraints specific to this data source */
	notes?: string[];

	capabilities?: DataSourceCapability[];
	editCapabilities?: DataSourceEditCapability[];
	searchCapabilities?: DataSourceSearchCapability[];
	loadCapabilities?: DataSourceLoadCapability[];

	structuredQuerySchema?: DataSourceProviderStructuredQuerySchema;
}

// =============================================================================
// DATASOURCE METADATA
// =============================================================================

export interface DataSourceMetadata {
	totalResources: number;
	resourceTypes: Record<string, number>;
	lastScanned: string;
	filesystem?: DataSourceMetadataFilesystem;
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
export type DataSourceCapability = 'read' | 'write' | 'list' | 'search' | 'move' | 'delete' | 'read' | 'edit'; // Delegated to MCP server
export type DataSourceEditCapability =
	| 'searchReplaceOperations'
	| 'rangeOperations'
	| 'blockOperations'
	| 'cellOperations'
	| 'textFormatting'
	| 'paragraphFormatting'
	| 'tables'
	| 'colors'
	| 'fonts'
	| 'formulas';
export type DataSourceSearchCapability =
	| 'textSearch'
	| 'regexSearch'
	| 'structuredQuerySearch';
export type DataSourceLoadCapability =
	| 'plainText' //  'Returns markdown for reading',
	| 'structured' //'Returns native Google Docs JSON for range operations'
	| 'both';
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

// =============================================================================
// DATASOURCE CONFIGURATION TYPES
// =============================================================================

/**
 * Structured configuration interface for data sources
 * Provides organized, extensible config sections while maintaining backward compatibility
 */
export interface DataSourceConfig {
	/** Resource suggestion behavior */
	suggestions?: {
		enabled?: boolean; // Master toggle for suggestions (default: true)
		maxDepth?: number; // Search depth limit
		maxResults?: number; // Result count limit
		searchPatterns?: string[]; // Include patterns
		excludePatterns?: string[]; // Exclude patterns
		followSymlinks?: boolean; // For filesystem types
		caseSensitive?: boolean; // Search behavior
	};

	/** UI and user experience settings */
	ui?: {
		displayOrder?: number; // Custom ordering in UI lists
		hideFromLists?: boolean; // Hide from certain UI lists
		customIcon?: string; // Custom icon identifier
	};

	/** Feature toggles and capabilities */
	features?: {
		disabledFeatures?: string[]; // ['search', 'write', 'delete']
		experimentalFeatures?: string[];
		readOnly?: boolean;
		requireConfirmation?: string[]; // Operations requiring confirmation
	};

	// === PROVIDER-SPECIFIC CONFIGURATION ===
	// These maintain backward compatibility with existing flat config keys

	// Filesystem provider
	dataSourceRoot?: string; // filesystem
	strictRoot?: boolean; // filesystem

	// Allow additional provider-specific config
	[key: string]: unknown;
}
