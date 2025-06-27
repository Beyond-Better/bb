/**
 * Type definitions for resource operations in the data source system.
 * These types define the parameters and results for all resource operations.
 */

import { ResourceType } from 'api/types/llms.ts';
import { DataSourceAccessMethod } from 'shared/types/dataSource.ts';

/**
 * Configurations for an MCP resource
 */
export interface ResourceMCPConfig {
	serverId: string; // set in config as mcpServer[x].id
	resourceId: string; // `mcp:${serverId}:${mcpResource.name}` - mcpResource.name is server's internal resource name
	resourceName: string; // set in config as mcpServer[x].name (use id if name not set) - this is name the LLM sees
	description: string;
}

/**
 * Resource metadata common to all resources
 */
export interface ResourceMetadata {
	accessMethod?: DataSourceAccessMethod;
	name?: string;

	/**
	 * Type of the resource (file, directory, database, etc.)
	 */
	type: ResourceType;

	/**
	 * URI of the resource
	 */
	uri: string;
	uriTemplate?: string;

	/**
	 * MIME type of the resource
	 */
	mimeType: string;

	contentType: 'text' | 'image';
	extraType?: 'directory' | 'file'; //string;

	description?: string;

	/**
	 * Size of the resource in bytes (if applicable)
	 */
	size?: number;

	/**
	 * Last modified timestamp
	 */
	lastModified: Date; //string;

	error?: string | null;
	mcpData?: ResourceMCPConfig;

	/**
	 * Additional metadata specific to the resource type
	 */
	[key: string]: unknown;
}

/**
 * Represents metadata about a specific revision of a resource
 */
export interface ResourceRevisionMetadata extends ResourceMetadata {
	/**
	 * Message / Revision identifier (for change tracking)
	 */
	messageId?: string; // also used as revisionId
	toolUseId?: string;
	lastCommit?: string;
}

/**
 * Represents a resource for conversation context
 */
export interface ResourceForInteraction {
	resourceName: string;
	resourceUri: string;
	metadata: ResourceRevisionMetadata;
}

export type ResourcesForInteraction = Array<ResourceForInteraction>;

export type InteractionResourcesMetadata = Record<string, ResourceRevisionMetadata>;

// ========================================================================
// Resource Load Operation
// ========================================================================

/**
 * Pagination information for resource listings
 */
export interface PaginationInfo {
	nextPageToken?: string;
	totalCount?: number;
	pageSize?: number;
	currentPage?: number;
}
/**
 * Result of loading a data source
 */
export interface DatasourceLoadResult {
	//resources: ResourceLoadResult[];
	resources: ResourceMetadata[];
	uriTemplate?: string;
	pagination?: PaginationInfo;
}

/**
 * Options for loading a resource
 */
export interface ResourceLoadOptions {
	/**
	 * Encoding to use when loading text content
	 */
	encoding?: string;

	/**
	 * Range of bytes to load (for large resources)
	 */
	range?: { start: number; end?: number };

	/**
	 * Whether to include metadata in the result
	 */
	includeMetadata?: boolean;
}

/**
 * Result of loading a resource
 */
export interface ResourceLoadResult {
	/**
	 * Resource content (text or binary)
	 */
	content: string | Uint8Array;

	/**
	 * Resource metadata
	 */
	metadata: ResourceMetadata;

	/**
	 * Whether the content is complete or partial
	 */
	isPartial?: boolean;
}
/**
 * Represents an item in a resource listing
 */
//export interface ResourceListItem {
//  name: string;
//  uri: string;
//  uriTerm?: string; // term value used for expression in URI template
//  uriTemplate?: string;
//  type: ResourceType;
//  accessMethod: DataSourceAccessMethod;
//  extraType?: string;
//  mimeType: string;
//  size?: number;
//  lastModified?: Date | string;
//  description?: string;
//}

// ========================================================================
// Resource List Operation
// ========================================================================

/**
 * Options for listing resources
 */
export interface ResourceListOptions {
	/**
	 * Path or pattern to filter resources
	 */
	path?: string;

	/**
	 * Maximum depth to traverse (for hierarchical sources)
	 */
	depth?: number;

	/**
	 * Maximum number of resources to return per page
	 */
	//limit?: number;
	pageSize?: number;

	/**
	 * Pagination token for continuing a previous listing
	 */
	pageToken?: string;

	/**
	 * Resource types to include (e.g., files, directories)
	 */
	includeTypes?: string[];
}

/**
 * Result of listing resources
 */
export interface ResourceListResult {
	/**
	 * Array of resource metadata
	 */
	resources: ResourceMetadata[];

	uriTemplate?: string;

	/**
	 * Pagination token for retrieving next page (if available)
	 */
	nextPageToken?: string;

	/**
	 * Whether there are more resources available
	 */
	hasMore?: boolean;

	pagination?: PaginationInfo;
}

// ========================================================================
// Resource Search Operation
// ========================================================================

/**
 * Content match information for enhanced search results
 */
export interface ContentMatch {
	/**
	 * Line number where the match was found (1-based)
	 */
	lineNumber: number;

	/**
	 * The actual content of the matching line
	 */
	content: string;

	/**
	 * Lines of context before the match
	 */
	contextBefore: string[];

	/**
	 * Lines of context after the match
	 */
	contextAfter: string[];

	/**
	 * Character position where match starts in the line
	 */
	matchStart: number;

	/**
	 * Character position where match ends in the line
	 */
	matchEnd: number;
}

/**
 * Options for searching resources
 */
export interface ResourceSearchOptions {
	/**
	 * Path or pattern to restrict search scope
	 */
	path?: string;

	/**
	 * Whether to perform a case-sensitive search
	 */
	caseSensitive?: boolean;

	/**
	 * Maximum number of results to return
	 */
	//limit?: number;
	pageSize?: number;

	/**
	 * Resource types to include in search
	 */
	includeTypes?: string[];

	/**
	 * File pattern to filter by name (glob syntax)
	 */
	filePattern?: string;

	/**
	 * Content pattern (regex) to search within resources
	 */
	contentPattern?: string;

	/**
	 * Resource name pattern (glob) to filter resources
	 */
	resourcePattern?: string;

	/**
	 * Include only resources modified after this date (YYYY-MM-DD)
	 */
	dateAfter?: string;

	/**
	 * Include only resources modified before this date (YYYY-MM-DD)
	 */
	dateBefore?: string;

	/**
	 * Minimum resource size in bytes
	 */
	sizeMin?: number;

	/**
	 * Maximum resource size in bytes
	 */
	sizeMax?: number;

	/**
	 * Number of context lines to include around matches (0-10)
	 */
	contextLines?: number;

	/**
	 * Maximum number of matches per resource (1-20)
	 */
	maxMatchesPerFile?: number;

	/**
	 * Whether to include content extraction for matches
	 */
	includeContent?: boolean;
}

/**
 * Enhanced resource match information
 */
export interface ResourceMatch {
	/**
	 * Resource metadata
	 */
	resource: ResourceMetadata;

	/**
	 * Matched content snippets (if basic content search)
	 */
	snippets?: string[];

	/**
	 * Enhanced content matches with context (if content search with context)
	 */
	contentMatches?: ContentMatch[];

	/**
	 * Match score/relevance (0-1)
	 */
	score?: number;
}

/**
 * Result of searching resources
 */
export interface ResourceSearchResult {
	/**
	 * Array of matching resources with metadata
	 */
	matches: ResourceMatch[];

	/**
	 * Total number of matches found (may be more than returned)
	 */
	totalMatches?: number;

	/**
	 * Error message if search encountered issues
	 */
	errorMessage?: string | null;
}

// ========================================================================
// Resource Write Operation
// ========================================================================

/**
 * Options for writing a resource
 */
export interface ResourceWriteOptions {
	/**
	 * Whether to create parent directories if they don't exist
	 */
	createMissingDirectories?: boolean;

	/**
	 * Whether to overwrite existing resource
	 */
	overwrite?: boolean;

	/**
	 * Encoding to use when writing text content
	 */
	encoding?: string;

	/**
	 * Content type (MIME type) to set on the resource
	 */
	contentType?: string;

	/**
	 * Additional metadata to set on the resource
	 */
	metadata?: Record<string, unknown>;
}

/**
 * Result of writing a resource
 */
export interface ResourceWriteResult {
	/**
	 * Whether the write operation was successful
	 */
	success: boolean;

	/**
	 * URI of the written resource
	 */
	uri: string;

	/**
	 * Updated metadata for the resource
	 */
	metadata: ResourceMetadata;

	/**
	 * Size of the written content in bytes
	 */
	bytesWritten?: number;
}

// ========================================================================
// Resource Move Operation
// ========================================================================

/**
 * Options for moving a resource
 */
export interface ResourceMoveOptions {
	/**
	 * Whether to create parent directories if they don't exist
	 */
	createMissingDirectories?: boolean;

	/**
	 * Whether to overwrite existing resource at destination
	 */
	overwrite?: boolean;
}

/**
 * Result of moving a resource
 */
export interface ResourceMoveResult {
	/**
	 * Whether the move operation was successful
	 */
	success: boolean;

	/**
	 * Original URI of the resource
	 */
	sourceUri: string;

	/**
	 * New URI of the resource
	 */
	destinationUri: string;

	/**
	 * Updated metadata for the resource
	 */
	metadata: ResourceMetadata;
}

// ========================================================================
// Resource Delete Operation
// ========================================================================

/**
 * Options for deleting a resource
 */
export interface ResourceDeleteOptions {
	/**
	 * Whether to recursively delete directories
	 */
	recursive?: boolean;

	/**
	 * Whether to permanently delete or move to trash
	 */
	permanent?: boolean;
}

/**
 * Result of deleting a resource
 */
export interface ResourceDeleteResult {
	/**
	 * Whether the delete operation was successful
	 */
	success: boolean;

	/**
	 * URI of the deleted resource
	 */
	uri: string;

	/**
	 * Type of resource that was deleted
	 */
	type: string;

	/**
	 * URI of trash location (if not permanently deleted)
	 */
	trashUri?: string;
}
