/**
 * GoogleDocsClient for interacting with the Google Docs and Drive APIs.
 */
import { logger } from 'shared/logger.ts';
import type { AuthConfig } from 'api/dataSources/interfaces/authentication.ts';
import type {
	GoogleDocsBatchUpdateRequest,
	GoogleDocsBatchUpdateResponse,
	GoogleDocument,
	GoogleDriveFile,
	GoogleDriveFilesList,
} from 'api/dataSources/googledocs.types.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

// Google APIs library types
export interface GoogleAuth {
	setCredentials(credentials: { access_token: string; refresh_token?: string }): void;
	getAccessToken(): Promise<{ token?: string }>;
	refreshAccessToken(): Promise<
		{ credentials: { access_token: string; refresh_token?: string; expiry_date?: number } }
	>;
}

type TokenUpdateCallback = (newTokens: {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
}) => Promise<void>;

/**
 * Client for interacting with the Google Docs and Drive APIs
 */
export class GoogleDocsClient {
	private accessToken: string;
	private refreshToken?: string;
	private expiresAt?: number;
	private projectConfig: ProjectConfig;
	// Note: Google APIs use different base URLs for different services
	// Base URLs exclude version numbers for consistency with endpoint definitions
	// Docs API: https://docs.googleapis.com + /v1/...
	// Drive API: https://www.googleapis.com/drive + /v3/...
	private readonly docsApiBaseUrl = 'https://docs.googleapis.com/v1';
	private readonly driveApiBaseUrl = 'https://www.googleapis.com/drive/v3';
	private tokenUpdateCallback?: TokenUpdateCallback;

	/**
	 * Create a new GoogleDocsClient
	 * @param projectConfig Project config
	 * @param tokenUpdateCallback Callback to update oauth tokens in dsConnection
	 * @param accessToken OAuth2 access token
	 * @param refreshToken OAuth2 refresh token (optional)
	 * @param expiresAt Token expiration timestamp
	 */
	constructor(
		projectConfig: ProjectConfig,
		tokenUpdateCallback: TokenUpdateCallback | undefined,
		accessToken: string,
		refreshToken: string | undefined,
		expiresAt: number | undefined,
	) {
		this.projectConfig = projectConfig;
		this.tokenUpdateCallback = tokenUpdateCallback;
		this.accessToken = accessToken;
		this.refreshToken = refreshToken;
		this.expiresAt = expiresAt;
	}

	/**
	 * Create a GoogleDocsClient from an AuthConfig
	 * @param auth Authentication configuration
	 * @param projectId Project ID for configuration access
	 * @returns A new GoogleDocsClient instance or null if auth is invalid
	 */
	static fromAuthConfig(
		auth?: AuthConfig,
		projectConfig?: ProjectConfig,
		tokenUpdateCallback?: TokenUpdateCallback,
	): GoogleDocsClient | null {
		if (!auth || auth.method !== 'oauth2') {
			logger.warn('GoogleDocsClient: Invalid auth config, must use oauth2 method');
			return null;
		}

		const accessToken = auth.oauth2?.accessToken as string;
		const refreshToken = auth.oauth2?.refreshToken;
		const expiresAt = auth.oauth2?.expiresAt;

		if (!accessToken || !projectConfig) {
			logger.warn('GoogleDocsClient: Missing required OAuth2 credentials or projectConfig');
			return null;
		}

		return new GoogleDocsClient(
			projectConfig,
			tokenUpdateCallback,
			accessToken,
			refreshToken,
			expiresAt,
		);
	}

	/**
	 * Check if the current token is expired or about to expire
	 * @returns True if token needs refresh
	 */
	private isTokenExpired(): boolean {
		if (!this.expiresAt) {
			return false; // If we don't know the expiry, assume it's still valid
		}
		// Consider token expired if it expires within the next 5 minutes
		const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
		return this.expiresAt < fiveMinutesFromNow;
	}

	/**
	 * Refresh the access token using the refresh token via BUI endpoint
	 * @returns True if refresh was successful
	 */
	private async refreshAccessToken(): Promise<boolean> {
		if (!this.refreshToken) {
			logger.warn('GoogleDocsClient: No refresh token available');
			return false;
		}

		try {
			// Get token endpoint from configuration
			const refreshExchangeUri = this.projectConfig.api?.dataSourceProviders?.googledocs?.refreshExchangeUri as string ||
				'https://chat.beyondbetter.app/api/v1/oauth/google/token';
			logger.info('GoogleDocsClient: refreshAccessToken - Using: refreshExchangeUri', refreshExchangeUri );

			if (!refreshExchangeUri) {
				logger.error('GoogleDocsClient: No token endpoint configured');
				return false;
			}

			const response = await fetch(refreshExchangeUri, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					refreshToken: this.refreshToken,
					operation: 'refresh',
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				logger.error(`GoogleDocsClient: Token refresh failed (${response.status}): ${errorText}`);
				return false;
			}

			const data = await response.json();
			this.accessToken = data.accessToken;

			// Update expiry time if provided
			if (data.expiresIn) {
				this.expiresAt = Date.now() + (data.expiresIn * 1000);
			}

			// Update refresh token if provided
			if (data.refreshToken) {
				this.refreshToken = data.refreshToken;
			}

			if (this.tokenUpdateCallback) {
			logger.info('GoogleDocsClient: Calling token update');
				await this.tokenUpdateCallback({
					accessToken: this.accessToken,
					refreshToken: this.refreshToken,
					expiresAt: this.expiresAt,
				});
			}

			logger.info('GoogleDocsClient: Successfully refreshed access token');
			return true;
		} catch (error) {
			logger.error('GoogleDocsClient: Error refreshing access token:', error);
			return false;
		}
	}

	/**
	 * Ensure we have a valid access token, refreshing if necessary
	 * @returns True if we have a valid token
	 */
	private async ensureValidToken(): Promise<boolean> {
		if (this.isTokenExpired()) {
			logger.info('GoogleDocsClient: Access token expired, attempting refresh');
			return await this.refreshAccessToken();
		}
		return true;
	}

	/**
	 * Make a request to the Google API
	 * @param endpoint API endpoint path (should start with / e.g., '/documents/123')
	 * @param method HTTP method
	 * @param body Request body
	 * @param apiType API type to determine base URL ('docs' or 'drive')
	 * @returns Response data
	 */
	private async request<T>(endpoint: string, method: string = 'GET', body?: unknown, apiType: 'docs' | 'drive' = 'docs'): Promise<T> {
		// Ensure we have a valid token
		const hasValidToken = await this.ensureValidToken();
		if (!hasValidToken) {
			throw new Error('GoogleDocsClient: Unable to obtain valid access token');
		}

		// Choose the correct base URL based on API type
		const baseUrl = apiType === 'drive' ? this.driveApiBaseUrl : this.docsApiBaseUrl;
		const url = `${baseUrl}${endpoint}`;
		const headers: Record<string, string> = {
			'Authorization': `Bearer ${this.accessToken}`,
			'Accept': 'application/json',
		};

		if (body) {
			headers['Content-Type'] = 'application/json';
		}

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
			});

			if (!response.ok) {
				const errorText = await response.text();

				// Handle token expiry errors
				if (response.status === 401) {
					logger.warn('GoogleDocsClient: Received 401 error, attempting token refresh');
					const refreshed = await this.refreshAccessToken();
					if (refreshed) {
						// Retry the request with the new token
						headers['Authorization'] = `Bearer ${this.accessToken}`;
						const retryResponse = await fetch(url, {
							method,
							headers,
							body: body ? JSON.stringify(body) : undefined,
						});

						if (!retryResponse.ok) {
							const retryErrorText = await retryResponse.text();
							throw new Error(
								`Google API error after token refresh (${retryResponse.status}): ${retryErrorText}`,
							);
						}

						return await retryResponse.json() as T;
					}
				}

				throw new Error(`Google API error (${response.status}): ${errorText}`);
			}

			return await response.json() as T;
		} catch (error) {
			logger.error(`GoogleDocsClient: Error in ${method} ${endpoint}:`, error);
			throw error;
		}
	}

	/**
	 * Extract document ID from a Google Docs URL
	 * @param url Google Docs URL or document ID
	 * @returns Document ID or null if invalid
	 */
	resolveDocumentUrl(url: string): string | null {
		// If it's already just an ID (no slashes or special characters), return it
		if (!/[\/\.\?#]/.test(url)) {
			return url;
		}

		// Match various Google Docs URL formats
		const patterns = [
			// Standard format: https://docs.google.com/document/d/{id}/edit
			/https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/,
			// Short format: https://docs.google.com/document/d/{id}
			/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/,
			// Drive sharing format: https://drive.google.com/file/d/{id}/view
			/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
			// Drive open format: https://drive.google.com/open?id={id}
			/https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,
		];

		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match && match[1]) {
				return match[1];
			}
		}

		logger.warn(`GoogleDocsClient: Unable to extract document ID from URL: ${url}`);
		return null;
	}

	/**
	 * Get a document by ID
	 * @param documentId Google Docs document ID or URL
	 * @throws Error if document cannot be retrieved
	 * @returns Document details
	 */
	async getDocument(documentId: string): Promise<GoogleDocument> {
		const resolvedId = this.resolveDocumentUrl(documentId);
		if (!resolvedId) {
			throw new Error(`Invalid document ID or URL: ${documentId}`);
		}

		const endpoint = `/documents/${resolvedId}`;
		const response = await this.request<{ data?: GoogleDocument } & GoogleDocument>(endpoint, 'GET', undefined, 'docs');

		// Handle both direct response and wrapped response formats
		return response.data || response;
	}

	/**
	 * Search for Google Docs documents
	 * @param query Search query (optional)
	 * @param folderId Folder ID to search within (optional)
	 * @param pageSize Number of results per page
	 * @param pageToken Pagination token
	 * @returns List of documents
	 */
	async listDocuments(
		query?: string,
		folderId?: string,
		pageSize: number = 50,
		pageToken?: string,
	): Promise<GoogleDriveFilesList> {
		let q = "mimeType='application/vnd.google-apps.document'";

		if (query) {
			const escapedQuery = query.replace(/'/g, "\\'");
			q += ` and name contains '${escapedQuery}'`;
		}

		if (folderId) {
			q += ` and '${folderId}' in parents`;
		}

		// Exclude trashed files
		q += ' and trashed=false';

		const params = new URLSearchParams({
			q,
			pageSize: pageSize.toString(),
			fields: 'nextPageToken,files(id,name,mimeType,webViewLink,createdTime,modifiedTime,owners,parents,shared)',
		});

		if (pageToken) {
			params.set('pageToken', pageToken);
		}

		const endpoint = `/files?${params.toString()}`;
		const response = await this.request<{ data?: GoogleDriveFilesList } & GoogleDriveFilesList>(endpoint, 'GET', undefined, 'drive');

		// Handle both direct response and wrapped response formats
		return response.data || response;
	}

	/**
	 * Update a document using batch update requests
	 * @param documentId Document ID or URL
	 * @param requests Array of batch update requests
	 * @returns Batch update response
	 */
	async updateDocument(
		documentId: string,
		requests: GoogleDocsBatchUpdateRequest[],
	): Promise<GoogleDocsBatchUpdateResponse> {
		const resolvedId = this.resolveDocumentUrl(documentId);
		if (!resolvedId) {
			throw new Error(`Invalid document ID or URL: ${documentId}`);
		}

		const endpoint = `/documents/${resolvedId}:batchUpdate`;
		const body = { requests };

		const response = await this.request<{ data?: GoogleDocsBatchUpdateResponse } & GoogleDocsBatchUpdateResponse>(
			endpoint,
			'POST',
			body,
			'docs'
		);

		// Handle both direct response and wrapped response formats
		return response.data || response;
	}

	/**
	 * Create a new document
	 * @param title Document title
	 * @param content Initial content (optional)
	 * @returns Created document
	 */
	async createDocument(title: string, content?: string): Promise<GoogleDocument> {
		const endpoint = '/documents';
		const body = { title };

		const response = await this.request<{ data?: GoogleDocument } & GoogleDocument>(
			endpoint,
			'POST',
			body,
			'docs'
		);

		const document = response.data || response;

		// If initial content is provided, add it to the document
		if (content && document.documentId) {
			const insertRequests: GoogleDocsBatchUpdateRequest[] = [
				{
					insertText: {
						location: { index: 1 }, // Insert at the beginning of the document
						text: content,
					},
				},
			];

			await this.updateDocument(document.documentId, insertRequests);

			// Return the updated document
			return await this.getDocument(document.documentId);
		}

		return document;
	}

	/**
	 * Get file metadata from Google Drive
	 * @param fileId File ID
	 * @returns File metadata
	 */
	async getDriveFileMetadata(fileId: string): Promise<GoogleDriveFile> {
		const endpoint = `/files/${fileId}`;
		const params = new URLSearchParams({
			fields: 'id,name,mimeType,webViewLink,createdTime,modifiedTime,owners,parents,shared,size,description',
		});

		const response = await this.request<{ data?: GoogleDriveFile } & GoogleDriveFile>(
			`${endpoint}?${params.toString()}`,
			'GET',
			undefined,
			'drive'
		);

		// Handle both direct response and wrapped response formats
		return response.data || response;
	}

	/**
	 * Helper method to insert text at a specific location
	 * @param documentId Document ID or URL
	 * @param text Text to insert
	 * @param index Location to insert text (default: end of document)
	 * @returns Update response
	 */
	async insertText(
		documentId: string,
		text: string,
		index?: number,
	): Promise<GoogleDocsBatchUpdateResponse> {
		// If no index provided, we need to get the document to find the end index
		let insertIndex = index;
		if (insertIndex === undefined) {
			const doc = await this.getDocument(documentId);
			// Find the end index of the document body
			const bodyContent = doc.body.content;
			if (bodyContent.length > 0) {
				const lastElement = bodyContent[bodyContent.length - 1];
				insertIndex = lastElement.endIndex - 1; // Insert before the final newline
			} else {
				insertIndex = 1; // Default to beginning if document is empty
			}
		}

		const requests: GoogleDocsBatchUpdateRequest[] = [
			{
				insertText: {
					location: { index: insertIndex },
					text,
				},
			},
		];

		return await this.updateDocument(documentId, requests);
	}

	/**
	 * Helper method to replace all occurrences of text
	 * @param documentId Document ID or URL
	 * @param searchText Text to search for
	 * @param replaceText Text to replace with
	 * @param matchCase Whether to match case
	 * @returns Update response
	 */
	async replaceText(
		documentId: string,
		searchText: string,
		replaceText: string,
		matchCase: boolean = false,
	): Promise<GoogleDocsBatchUpdateResponse> {
		const requests: GoogleDocsBatchUpdateRequest[] = [
			{
				replaceAllText: {
					containsText: {
						text: searchText,
						matchCase,
					},
					replaceText,
				},
			},
		];

		return await this.updateDocument(documentId, requests);
	}

	/**
	 * Test API connectivity and token validity
	 * @returns Basic user info if successful
	 */
	async testConnection(): Promise<{ email?: string; name?: string }> {
		try {
			// Test with a simple Drive API call that should always work
			const aboutEndpoint = '/about?fields=user';
			logger.info(`GoogleDocsClient: Testing connection with ${aboutEndpoint}`);
			
			const response = await this.request<{
				user: { emailAddress: string; displayName: string }
			}>(aboutEndpoint, 'GET', undefined, 'drive');
			
			return {
				email: response.user?.emailAddress,
				name: response.user?.displayName
			};
		} catch (error) {
			logger.error('GoogleDocsClient: Connection test failed:', error);
			throw error;
		}
	}
}
