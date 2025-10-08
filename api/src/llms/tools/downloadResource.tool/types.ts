/**
 * Type definitions for the downloadResource tool
 */

/**
 * Authentication configuration for downloadResource requests
 */
export interface AuthConfig {
	/** Authentication method */
	type: 'basic' | 'bearer' | 'apikey' | 'none';
	/** Username for basic auth */
	username?: string;
	/** Password for basic auth */
	password?: string;
	/** Bearer token or API key value */
	token?: string;
	/** Header name for API key authentication (default: 'X-API-Key') */
	headerName?: string;
	/** Whether to send API key as query parameter instead of header */
	useQueryParam?: boolean;
	/** Query parameter name for API key (default: 'api_key') */
	queryParamName?: string;
}

/**
 * Request body configuration for POST/PUT requests
 */
export interface RequestBodyConfig {
	/** Content to send in request body */
	content: string;
	/** Content-Type header value (e.g., 'application/json', 'application/x-www-form-urlencoded') */
	contentType: string;
}

/**
 * Input schema for downloadResource tool
 */
export interface LLMToolDownloadResourceInput {
	/** URL to download from */
	url: string;
	/** HTTP method to use */
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/** Custom headers to send */
	headers?: Record<string, string>;
	/** Authentication configuration */
	auth?: AuthConfig;
	/** Query parameters to append to URL */
	queryParams?: Record<string, string>;
	/** Request body for POST/PUT requests */
	requestBody?: RequestBodyConfig;
	/** Data source ID to write to */
	dataSourceId?: string;
	/** Path where to save downloaded content */
	resourcePath: string;
	/** Whether to overwrite existing file */
	overwriteExisting?: boolean;
	/** Whether to create missing directories */
	createMissingDirectories?: boolean;
	/** Whether to include content in conversation messages */
	includeInMessages?: boolean;
	/** Whether to follow HTTP redirects */
	followRedirects?: boolean;
	/** Maximum number of redirects to follow */
	maxRedirects?: number;
	/** Request timeout in milliseconds */
	timeout?: number;
	/** Maximum file size to download in bytes */
	maxFileSize?: number;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
	/** Number of bytes downloaded so far */
	bytesDownloaded: number;
	/** Total content length if available */
	totalBytes?: number;
	/** Download progress as percentage (0-100) */
	percentage?: number;
}

/**
 * Content type detection result
 */
export interface ContentTypeInfo {
	/** MIME type from response headers */
	mimeType: string;
	/** Detected content type category */
	contentType: 'text' | 'image' | 'binary';
	/** File extension derived from MIME type */
	fileExtension?: string;
	/** Whether detected type matches file path extension */
	extensionMatch: boolean;
	/** Warning message if types don't match */
	warningMessage?: string;
}

/**
 * HTTP response metadata
 */
export interface ResponseMetadata {
	/** HTTP status code */
	status: number;
	/** HTTP status text */
	statusText: string;
	/** Response headers */
	headers: Record<string, string>;
	/** Final URL after redirects */
	finalUrl: string;
	/** Number of redirects followed */
	redirectCount: number;
	/** Content length from headers */
	contentLength?: number;
	/** Content type info */
	contentTypeInfo: ContentTypeInfo;
}

/**
 * Result data for downloadResource tool
 */
export interface LLMToolDownloadResourceResultData {
	/** Original request URL */
	url: string;
	/** HTTP method used */
	method: string;
	/** Path where content was saved */
	resourcePath: string;
	/** Resource ID/URI */
	resourceId: string;
	/** Response metadata */
	response: ResponseMetadata;
	/** Size of downloaded content */
	bytesDownloaded: number;
	/** Download duration in milliseconds */
	durationMs: number;
	/** Whether this was a new resource */
	isNewResource: boolean;
	/** Data source information */
	dataSource: {
		dsConnectionId: string;
		dsConnectionName: string;
		dsProviderType: string;
	};
	/** Content for conversation inclusion (if requested) */
	conversationContent?: string;
}
