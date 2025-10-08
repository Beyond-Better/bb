//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type {
	AuthConfig,
	ContentTypeInfo,
	LLMToolDownloadResourceInput,
	LLMToolDownloadResourceResultData,
	RequestBodyConfig,
	ResponseMetadata,
} from './types.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type {
	DataSourceHandlingErrorOptions,
	ResourceHandlingErrorOptions,
	ToolHandlingErrorOptions,
} from 'api/errors/error.ts';
import { isResourceNotFoundError } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { checkDatasourceAccess } from 'api/utils/featureAccess.ts';
import { enhanceDatasourceError } from '../../../utils/datasourceErrorEnhancement.ts';
import { type DOMConfig, extractTextFromHtml, validateHtml } from '../../../utils/dom.utils.ts';
import { getContentType, isTextMimeType } from '../../../utils/contentTypes.utils.ts';
import type { ResourceMetadata } from 'shared/types/dataSourceResource.ts';

// Constants for download limits and timeouts
const DEFAULT_TIMEOUT = 60 * 1000; // 60 seconds
const DEFAULT_MAX_REDIRECTS = 10;
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_CONTENT_FOR_MESSAGES = 1024 * 1024; // 1MB for conversation inclusion

export default class LLMToolDownloadResource extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					description:
						`The complete URL of the resource to download. Supports HTTP and HTTPS protocols. Important considerations:

1. URL Requirements:
   * Must include protocol (http:// or https://)
   * URLs with special characters must be properly encoded (e.g., spaces as %20)
   * Tool automatically handles encoding of query parameter values only
   * Must be accessible from the server
   Examples:
   * "https://api.github.com/repos/owner/repo/archive/main.zip"
   * "https://example.com/data/file.json"
   * "https://example.com/path%20with%20spaces/file.pdf" (spaces must be pre-encoded)
   * "http://localhost:3000/api/export.csv"

2. Supported Content Types:
   * Text files: JSON, CSV, XML, plain text, code files
   * Binary files: Images, PDFs, archives, executables
   * Will auto-detect content type from response headers

3. Common Error Scenarios:
   * HTTP 403/401: Authentication required or access denied
   * HTTP 404: Resource not found at the specified URL
   * HTTP 429: Rate limit exceeded, retry after delay
   * HTTP 500-series: Server errors, may be temporary
   * Network timeouts: Server may be slow or unreachable
   * SSL/TLS errors: Certificate issues with HTTPS URLs
   * File size limits: Downloads exceeding maxFileSize will be rejected`,
				},
				method: {
					type: 'string',
					enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
					default: 'GET',
					description: 'HTTP method to use for the request. GET is most common for downloads.',
				},
				headers: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description: `Custom headers to include in the request. Common examples:
   * "Accept": "application/json" - Request specific content type
   * "User-Agent": "MyApp/1.0" - Identify your application
   * "Referer": "https://example.com" - Specify referring page
   * Custom API headers as needed`,
				},
				auth: {
					type: 'object',
					description: 'Authentication configuration for the request.',
					properties: {
						type: {
							type: 'string',
							enum: ['basic', 'bearer', 'apikey', 'none'],
							description: 'Type of authentication to use.',
						},
						username: {
							type: 'string',
							description: 'Username for basic authentication.',
						},
						password: {
							type: 'string',
							description: 'Password for basic authentication.',
						},
						token: {
							type: 'string',
							description: 'Bearer token or API key value.',
						},
						headerName: {
							type: 'string',
							default: 'X-API-Key',
							description: 'Header name for API key authentication.',
						},
						useQueryParam: {
							type: 'boolean',
							default: false,
							description: 'Send API key as query parameter instead of header.',
						},
						queryParamName: {
							type: 'string',
							default: 'api_key',
							description: 'Query parameter name for API key.',
						},
					},
					required: ['type'],
				},
				queryParams: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description: 'Query parameters to append to the URL.',
				},
				requestBody: {
					type: 'object',
					description: 'Request body configuration for POST/PUT requests.',
					properties: {
						content: {
							type: 'string',
							description: 'Content to send in request body.',
						},
						contentType: {
							type: 'string',
							description:
								'Content-Type header value (e.g., "application/json", "application/x-www-form-urlencoded").',
						},
					},
					required: ['content', 'contentType'],
				},
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				resourcePath: {
					type: 'string',
					description:
						'The path where to save the downloaded content, relative to the data source root. Must be within the data source directory. Example: "downloads/data.json", "assets/image.png".',
				},
				overwriteExisting: {
					type: 'boolean',
					default: false,
					description: 'Whether to overwrite the resource if it already exists. Default is false.',
				},
				createMissingDirectories: {
					type: 'boolean',
					default: true,
					description: 'Whether to create missing parent directories. Default is true.',
				},
				includeInMessages: {
					type: 'boolean',
					default: false,
					description:
						'Whether to include the downloaded content in conversation messages. Only applies to text content under 1MB. Binary content is never included.',
				},
				followRedirects: {
					type: 'boolean',
					default: true,
					description: 'Whether to follow HTTP redirects. Default is true.',
				},
				maxRedirects: {
					type: 'number',
					default: DEFAULT_MAX_REDIRECTS,
					minimum: 0,
					maximum: 20,
					description: 'Maximum number of redirects to follow.',
				},
				timeout: {
					type: 'number',
					default: DEFAULT_TIMEOUT,
					minimum: 1000,
					maximum: 300000,
					description: 'Request timeout in milliseconds. Default is 60 seconds.',
				},
				maxFileSize: {
					type: 'number',
					default: DEFAULT_MAX_FILE_SIZE,
					minimum: 1024,
					maximum: 100 * 1024 * 1024,
					description: 'Maximum file size to download in bytes. Default is 50MB.',
				},
			},
			required: ['url', 'resourcePath'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	/**
	 * Extract resource ID from URI based on provider type
	 */
	private extractResourceIdFromUri(uri: string, providerType: string): string {
		try {
			switch (providerType) {
				case 'filesystem':
				default: {
					const match = uri.match(/filesystem[^:]*:\.\/(.+)$/);
					return match ? match[1] : uri;
				}
			}
		} catch (error) {
			return uri;
		}
	}

	/**
	 * Detect content type and validate against file extension
	 */
	private detectContentType(mimeType: string, resourcePath: string): ContentTypeInfo {
		// Normalize MIME type
		const normalizedMimeType = mimeType.toLowerCase().split(';')[0].trim();

		// Determine content type category using existing utility
		let contentType: 'text' | 'image' | 'binary';
		if (isTextMimeType(normalizedMimeType)) {
			contentType = 'text';
		} else if (normalizedMimeType.startsWith('image/')) {
			contentType = 'image';
		} else {
			contentType = 'binary';
		}

		// Get expected MIME type from file extension
		const expectedMimeType = getContentType(resourcePath);
		const pathExtension = resourcePath.split('.').pop()?.toLowerCase();

		// Check if the response MIME type matches the expected type from extension
		const mimeTypeMatch = normalizedMimeType === expectedMimeType ||
			// Allow some common variations
			(normalizedMimeType === 'image/jpeg' && expectedMimeType === 'image/jpg') ||
			(normalizedMimeType === 'application/javascript' && expectedMimeType === 'text/javascript');

		let warningMessage: string | undefined;
		if (!mimeTypeMatch && pathExtension && expectedMimeType !== 'application/octet-stream') {
			warningMessage =
				`Content type mismatch: response MIME type '${normalizedMimeType}' doesn't match file extension '${pathExtension}' (expected '${expectedMimeType}')`;
		}

		return {
			mimeType: normalizedMimeType,
			contentType,
			fileExtension: pathExtension,
			extensionMatch: mimeTypeMatch,
			warningMessage,
		};
	}

	/**
	 * Build the complete URL with query parameters
	 */
	private buildUrlWithParams(baseUrl: string, queryParams?: Record<string, string>, auth?: AuthConfig): string {
		const url = new URL(baseUrl);

		// Add regular query parameters
		if (queryParams) {
			Object.entries(queryParams).forEach(([key, value]) => {
				url.searchParams.append(key, value);
			});
		}

		// Add API key as query parameter if configured
		if (auth?.type === 'apikey' && auth.useQueryParam && auth.token) {
			const paramName = auth.queryParamName || 'api_key';
			url.searchParams.append(paramName, auth.token);
		}

		return url.toString();
	}

	/**
	 * Build headers for the request
	 */
	private buildHeaders(
		headers?: Record<string, string>,
		auth?: AuthConfig,
		requestBody?: RequestBodyConfig,
	): HeadersInit {
		const requestHeaders: Record<string, string> = { ...headers };

		// Add authentication headers
		if (auth) {
			switch (auth.type) {
				case 'basic':
					if (auth.username && auth.password) {
						const credentials = btoa(`${auth.username}:${auth.password}`);
						requestHeaders['Authorization'] = `Basic ${credentials}`;
					}
					break;
				case 'bearer':
					if (auth.token) {
						requestHeaders['Authorization'] = `Bearer ${auth.token}`;
					}
					break;
				case 'apikey':
					if (auth.token && !auth.useQueryParam) {
						const headerName = auth.headerName || 'X-API-Key';
						requestHeaders[headerName] = auth.token;
					}
					break;
			}
		}

		// Add Content-Type for request body
		if (requestBody) {
			requestHeaders['Content-Type'] = requestBody.contentType;
		}

		return requestHeaders;
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const {
			url,
			method = 'GET',
			headers,
			auth,
			queryParams,
			requestBody,
			dataSourceId = undefined,
			resourcePath,
			overwriteExisting = false,
			createMissingDirectories = true,
			includeInMessages = false,
			followRedirects = true,
			maxRedirects = DEFAULT_MAX_REDIRECTS,
			timeout = DEFAULT_TIMEOUT,
			maxFileSize = DEFAULT_MAX_FILE_SIZE,
		} = toolInput as LLMToolDownloadResourceInput;

		// Get datasource connections
		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);

		const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
		const dsConnectionToUseId = dsConnectionToUse.id;
		if (!dsConnectionToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		if (!dsConnectionToUse) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		// Check datasource write access
		const hasWriteAccess = await checkDatasourceAccess(
			projectEditor.userContext,
			dsConnectionToUse.providerType,
			'write',
		);
		if (!hasWriteAccess) {
			throw createError(
				ErrorType.ToolHandling,
				`Write access for ${dsConnectionToUse.providerType} not available on your current plan`,
				{
					toolName: 'download_resource',
					operation: 'capability-check',
				} as ToolHandlingErrorOptions,
			);
		}

		// Get resource accessor
		const resourceAccessor = await dsConnectionToUse.getResourceAccessor();
		if (!resourceAccessor.writeResource) {
			throw createError(ErrorType.ToolHandling, `No writeResource method on resourceAccessor`, {
				toolName: 'download_resource',
				operation: 'tool-run',
			} as ToolHandlingErrorOptions);
		}

		// Validate resource path is within datasource
		const resourceUri = (resourcePath.includes('://') || resourcePath.startsWith('file:'))
			? dsConnectionToUse.getUriForResource(resourcePath)
			: dsConnectionToUse.getUriForResource(`file:./${resourcePath}`);

		if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
			throw createError(
				ErrorType.ResourceHandling,
				`Access denied: ${resourcePath} is outside the data source directory`,
				{
					name: 'download-resource',
					filePath: resourcePath,
					operation: 'write',
				} as ResourceHandlingErrorOptions,
			);
		}

		const startTime = Date.now();
		let redirectCount = 0;
		let finalUrl = url;
		let isNewResource = true;

		try {
			// Check if resource exists
			try {
				await resourceAccessor.loadResource(resourceUri);
				isNewResource = false;

				if (!overwriteExisting) {
					throw createError(
						ErrorType.ResourceHandling,
						`Resource ${resourcePath} already exists and overwriteExisting is false`,
						{
							name: 'download-resource',
							filePath: resourcePath,
							operation: 'write',
						} as ResourceHandlingErrorOptions,
					);
				}
			} catch (error) {
				if (isResourceNotFoundError(error)) {
					isNewResource = true;
					logger.info(`LLMToolDownloadResource: Resource ${resourceUri} not found. Creating new resource.`);

					// Create missing directories if needed
					if (createMissingDirectories) {
						await resourceAccessor.ensureResourcePathExists(resourceUri);
						logger.info(`LLMToolDownloadResource: Created directory structure for ${resourceUri}`);
					}
				} else {
					throw error;
				}
			}

			// Build the complete URL with parameters
			finalUrl = this.buildUrlWithParams(url, queryParams, auth);

			// Build headers
			const requestHeaders = this.buildHeaders(headers, auth, requestBody);

			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			try {
				// Make the HTTP request
				const fetchOptions: RequestInit = {
					method,
					headers: requestHeaders,
					redirect: followRedirects ? 'follow' : 'manual',
					signal: controller.signal,
				};

				if (requestBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
					fetchOptions.body = requestBody.content;
				}

				logger.info(`LLMToolDownloadResource: Starting download from ${finalUrl} using ${method}`);
				const response = await fetch(finalUrl, fetchOptions);

				clearTimeout(timeoutId);

				// Check response status
				if (!response.ok) {
					throw createError(
						ErrorType.ResourceHandling,
						`HTTP ${response.status} ${response.statusText} from ${finalUrl}`,
						{
							name: 'download-resource',
							filePath: resourcePath,
							operation: 'write',
						} as ResourceHandlingErrorOptions,
					);
				}

				// Get response metadata
				const responseHeaders: Record<string, string> = {};
				response.headers.forEach((value, key) => {
					responseHeaders[key.toLowerCase()] = value;
				});

				const contentLength = response.headers.get('content-length')
					? parseInt(response.headers.get('content-length')!)
					: undefined;
				const mimeType = response.headers.get('content-type') || 'application/octet-stream';

				// Check file size limit
				if (contentLength && contentLength > maxFileSize) {
					throw createError(
						ErrorType.ResourceHandling,
						`File size ${contentLength} bytes exceeds maximum allowed size ${maxFileSize} bytes`,
						{
							name: 'download-resource',
							filePath: resourcePath,
							operation: 'write',
						} as ResourceHandlingErrorOptions,
					);
				}

				// Detect content type and validate extension
				const contentTypeInfo = this.detectContentType(mimeType, resourcePath);

				// Download content as appropriate type
				let contentToWrite: string | Uint8Array;
				let conversationContent: string | undefined;

				if (contentTypeInfo.contentType === 'text') {
					const textContent = await response.text();
					contentToWrite = textContent;

					// Include in messages if requested and not too large
					if (includeInMessages && textContent.length <= MAX_CONTENT_FOR_MESSAGES) {
						// Clean HTML content if it's HTML
						if (mimeType.includes('html')) {
							try {
								const validation = await validateHtml(textContent);
								if (validation.isValid) {
									conversationContent = await extractTextFromHtml(textContent);
								} else {
									conversationContent = textContent;
								}
							} catch {
								conversationContent = textContent;
							}
						} else {
							conversationContent = textContent;
						}
					}
				} else {
					// Handle binary content
					const arrayBuffer = await response.arrayBuffer();
					contentToWrite = new Uint8Array(arrayBuffer);

					// Check size limit after download for binary content
					if (contentToWrite.length > maxFileSize) {
						throw createError(
							ErrorType.ResourceHandling,
							`Downloaded file size ${contentToWrite.length} bytes exceeds maximum allowed size ${maxFileSize} bytes`,
							{
								name: 'download-resource',
								filePath: resourcePath,
								operation: 'write',
							} as ResourceHandlingErrorOptions,
						);
					}
				}

				const endTime = Date.now();
				const durationMs = endTime - startTime;

				// Write using resource accessor
				logger.info(`LLMToolDownloadResource: Writing content to ${resourceUri}`);
				const writeResult = await resourceAccessor.writeResource(resourceUri, contentToWrite, {
					overwrite: overwriteExisting,
					createMissingDirectories,
					contentFormat: contentTypeInfo.contentType === 'text' ? 'plain-text' : 'binary',
				});

				if (!writeResult.success) {
					throw createError(
						ErrorType.ResourceHandling,
						`Writing downloaded resource failed for ${resourcePath}`,
						{
							name: 'download-resource',
							filePath: resourcePath,
							operation: 'write',
						} as ResourceHandlingErrorOptions,
					);
				}

				logger.info(
					`LLMToolDownloadResource: Successfully downloaded and saved ${writeResult.bytesWritten} bytes to ${writeResult.uri}`,
				);

				// Extract resource ID from URI
				const resourceId = this.extractResourceIdFromUri(writeResult.uri, dsConnectionToUse.providerType);

				// Create response metadata
				const responseMetadata: ResponseMetadata = {
					status: response.status,
					statusText: response.statusText,
					headers: responseHeaders,
					finalUrl: response.url || finalUrl,
					redirectCount,
					contentLength,
					contentTypeInfo,
				};

				// Log change and commit for text content
				if (contentTypeInfo.contentType === 'text') {
					logger.info(`LLMToolDownloadResource: Saving conversation download resource: ${interaction.id}`);
					await projectEditor.orchestratorController.logChangeAndCommit(
						interaction,
						dsConnectionToUse.getDataSourceRoot(),
						resourcePath,
						contentToWrite as string,
					);
				}

				// Build tool results
				const bytesDownloaded = writeResult.bytesWritten || 0;
				const dsConnectionStatus = notFound.length > 0
					? `Could not find data source for: [${notFound.join(', ')}]`
					: `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`;

				const resultData: LLMToolDownloadResourceResultData = {
					url,
					method,
					resourcePath,
					resourceId,
					response: responseMetadata,
					bytesDownloaded,
					durationMs,
					isNewResource,
					dataSource: {
						dsConnectionId: dsConnectionToUse.id!,
						dsConnectionName: dsConnectionToUse.name,
						dsProviderType: dsConnectionToUse.providerType,
					},
					conversationContent,
				};

				const warnings = contentTypeInfo.warningMessage ? [contentTypeInfo.warningMessage] : [];

				const toolResults = conversationContent ||
					`Downloaded ${method} ${finalUrl} → ${resourcePath}\n` +
						`Content-Type: ${mimeType}\n` +
						`Size: ${bytesDownloaded} bytes\n` +
						`Duration: ${durationMs}ms\n` +
						`Resource ID: ${resourceId}` +
						(warnings.length > 0 ? `\n\nWarnings:\n${warnings.join('\n')}` : '');

				const toolResponse = `${dsConnectionStatus}\n` +
					`${isNewResource ? 'Downloaded' : 'Downloaded and overwrote'} ${finalUrl} to ${resourcePath}\n` +
					`Content-Type: ${mimeType}, Size: ${bytesDownloaded} bytes, Duration: ${durationMs}ms\n` +
					`Resource ID: ${resourceId}` +
					(warnings.length > 0 ? `\nWarnings: ${warnings.join(', ')}` : '');

				return {
					toolResults,
					toolResponse,
					bbResponse: {
						data: resultData,
					},
				};
			} finally {
				clearTimeout(timeoutId);
			}
		} catch (error) {
			if ((error as Error).name === 'download-resource') {
				throw error;
			}

			const originalErrorMessage = `Failed to download resource from ${finalUrl}: ${(error as Error).message}`;

			// Enhance error message with datasource-specific guidance
			const enhancedErrorMessage = enhanceDatasourceError(
				originalErrorMessage,
				dsConnectionToUse.provider,
				'write',
				resourcePath,
				interaction,
			);

			logger.error(`LLMToolDownloadResource: ${enhancedErrorMessage}`);

			throw createError(ErrorType.ResourceHandling, enhancedErrorMessage, {
				name: 'download-resource',
				filePath: resourcePath,
				operation: 'write',
			} as ResourceHandlingErrorOptions);
		}
	}
}
