/**
 * Defines various types and interfaces related to data sources within the BB project.
 */

// Denotes how a data source is primarily accessed (e.g., local file system, remote API).
export type DataSourceAccessMethod = 'filesystem' | 'api' | 'database';

// Defines the authentication method for a data source.
export type DataSourceAuthMethod = 'none' | 'apiKey' | 'oauth2' | 'basicAuth';

// Represents authentication configuration for a data source.
export interface DataSourceAuth {
	method: DataSourceAuthMethod;
	[key: string]: string; // Allows for flexible key-value pairs for auth details
}

// Capabilities supported by a data source (e.g., read, write, list resources).
export type DataSourceCapability = 'read' | 'write' | 'list' | 'search' | 'move' | 'delete';

// Identifies the specific type of data source provider (e.g., 'local', 'notion', 'supabase').
export type DataSourceProviderType = 'filesystem' | 'notion' | 'supabase';

// Interface for data source metadata - provider-agnostic base
export interface DataSourceMetadata {
	totalResources?: number;
	resourceTypes?: { [key: string]: number }; // e.g., { 'file': 100, 'directory': 20, 'document': 50 }
	lastScanned?: string; // ISO 8601 string when metadata was last collected

	// Provider-specific metadata extensions
	filesystem?: FilesystemMetadata;
	notion?: NotionMetadata;
	// Add other provider-specific metadata as needed
}

// Filesystem-specific metadata
export interface FilesystemMetadata {
	deepestPathDepth?: number;
	totalDirectories?: number;
	totalFiles?: number;
	largestFileSize?: number;
	oldestFileDate?: string; // ISO 8601 string
	newestFileDate?: string; // ISO 8601 string
	fileExtensions?: { [extension: string]: number }; // e.g., { '.ts': 50, '.md': 10, '.json': 5 }

	// LLM-critical operational metadata
	capabilities?: {
		canRead: boolean;
		canWrite: boolean;
		canDelete: boolean;
		canMove: boolean;
		hasRestrictedAreas: boolean; // Some areas may be inaccessible
	};

	contentVisibility?: {
		includesHiddenFiles: boolean; // Files starting with .
		includesDotDirectories: boolean; // .git, .bb, etc.
		followsSymlinks: boolean;
		brokenSymlinkCount?: number;
		filteredByGitignore: boolean;
		filteredByBBIgnore: boolean;
	};

	practicalLimits?: {
		maxFileSize?: number; // Largest file that can be processed
		recommendedPageSize?: number; // Optimal pageSize for this datasource
		hasVeryLargeFiles: boolean; // Files that might timeout/fail to load
	};

	contentAnalysis?: {
		textFileCount: number;
		binaryFileCount: number;
		likelyEncodingIssues: number; // Files that might have encoding problems
		emptyFileCount: number;
	};
}

// Notion-specific metadata
export interface NotionMetadata {
	totalPages?: number;
	totalDatabases?: number;
	workspaceInfo?: {
		name?: string;
		id?: string;
	};
	pageTypes?: { [type: string]: number }; // e.g., { 'database': 5, 'page': 25 }
}
