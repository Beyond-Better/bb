/**
 * GoogleDocsClient for interacting with the Google Docs and Drive APIs.
 */
import { logger } from 'shared/logger.ts';
import type { AuthConfig } from 'api/dataSources/interfaces/authentication.ts';

// Google APIs library types
export interface GoogleAuth {
	setCredentials(credentials: { access_token: string; refresh_token?: string }): void;
	getAccessToken(): Promise<{ token?: string }>;
	refreshAccessToken(): Promise<{ credentials: { access_token: string; refresh_token?: string; expiry_date?: number } }>;
}

export interface GoogleDocs {
	documents: {
		get(params: { documentId: string }): Promise<{ data: GoogleDocument }>;
		create(params: { requestBody: { title: string } }): Promise<{ data: GoogleDocument }>;
		batchUpdate(params: { 
			documentId: string; 
			requestBody: { requests: GoogleDocsBatchUpdateRequest[] }
		}): Promise<{ data: GoogleDocsBatchUpdateResponse }>;
	};
}

export interface GoogleDrive {
	files: {
		list(params?: {
			q?: string;
			pageSize?: number;
			pageToken?: string;
			fields?: string;
		}): Promise<{ data: GoogleDriveFilesList }>;
		get(params: {
			fileId: string;
			fields?: string;
		}): Promise<{ data: GoogleDriveFile }>;
	};
}

// Google Docs API types
export interface GoogleDocument {
	documentId: string;
	title: string;
	body: GoogleDocumentBody;
	headers?: Record<string, GoogleDocumentHeader>;
	footers?: Record<string, GoogleDocumentFooter>;
	documentStyle?: GoogleDocumentStyle;
	namedStyles?: GoogleNamedStyles;
	lists?: Record<string, GoogleList>;
	revisionId?: string;
	suggestionsViewMode?: string;
}

export interface GoogleDocumentBody {
	content: GoogleStructuralElement[];
}

export interface GoogleStructuralElement {
	startIndex: number;
	endIndex: number;
	paragraph?: GoogleParagraph;
	table?: GoogleTable;
	sectionBreak?: GoogleSectionBreak;
	tableOfContents?: GoogleTableOfContents;
}

export interface GoogleParagraph {
	elements: GoogleParagraphElement[];
	paragraphStyle?: GoogleParagraphStyle;
	positionedObjectIds?: string[];
}

export interface GoogleParagraphElement {
	startIndex: number;
	endIndex: number;
	textRun?: GoogleTextRun;
	inlineObjectElement?: GoogleInlineObjectElement;
	pageBreak?: GooglePageBreak;
	columnBreak?: GoogleColumnBreak;
	footnoteReference?: GoogleFootnoteReference;
	horizontalRule?: GoogleHorizontalRule;
	equation?: GoogleEquation;
}

export interface GoogleTextRun {
	content: string;
	textStyle?: GoogleTextStyle;
}

export interface GoogleTextStyle {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	smallCaps?: boolean;
	backgroundColor?: GoogleOptionalColor;
	foregroundColor?: GoogleOptionalColor;
	fontSize?: GoogleDimension;
	weightedFontFamily?: GoogleWeightedFontFamily;
	baselineOffset?: string;
	link?: GoogleLink;
}

export interface GoogleOptionalColor {
	color?: GoogleColor;
}

export interface GoogleColor {
	rgbColor?: GoogleRgbColor;
}

export interface GoogleRgbColor {
	red?: number;
	green?: number;
	blue?: number;
}

export interface GoogleDimension {
	magnitude?: number;
	unit?: string;
}

export interface GoogleWeightedFontFamily {
	fontFamily?: string;
	weight?: number;
}

export interface GoogleLink {
	url?: string;
	bookmarkId?: string;
	headingId?: string;
}

export interface GoogleParagraphStyle {
	namedStyleType?: string;
	alignment?: string;
	lineSpacing?: number;
	direction?: string;
	spacingMode?: string;
	spaceAbove?: GoogleDimension;
	spaceBelow?: GoogleDimension;
	borderBetween?: GoogleParagraphBorder;
	borderTop?: GoogleParagraphBorder;
	borderBottom?: GoogleParagraphBorder;
	borderLeft?: GoogleParagraphBorder;
	borderRight?: GoogleParagraphBorder;
	indentFirstLine?: GoogleDimension;
	indentStart?: GoogleDimension;
	indentEnd?: GoogleDimension;
	tabStops?: GoogleTabStop[];
	keepLinesTogether?: boolean;
	keepWithNext?: boolean;
	avoidWidowAndOrphan?: boolean;
	shading?: GoogleShading;
	headingId?: string;
}

export interface GoogleParagraphBorder {
	color?: GoogleOptionalColor;
	width?: GoogleDimension;
	padding?: GoogleDimension;
	dashStyle?: string;
}

export interface GoogleTabStop {
	offset?: GoogleDimension;
	alignment?: string;
}

export interface GoogleShading {
	backgroundColor?: GoogleOptionalColor;
}

export interface GoogleTable {
	rows?: number;
	columns?: number;
	tableRows?: GoogleTableRow[];
	tableStyle?: GoogleTableStyle;
}

export interface GoogleTableRow {
	startIndex?: number;
	endIndex?: number;
	tableCells?: GoogleTableCell[];
	tableRowStyle?: GoogleTableRowStyle;
}

export interface GoogleTableCell {
	startIndex?: number;
	endIndex?: number;
	content?: GoogleStructuralElement[];
	tableCellStyle?: GoogleTableCellStyle;
}

export interface GoogleTableStyle {
	tableColumnProperties?: GoogleTableColumnProperties[];
}

export interface GoogleTableColumnProperties {
	width?: GoogleDimension;
	widthType?: string;
}

export interface GoogleTableRowStyle {
	minRowHeight?: GoogleDimension;
}

export interface GoogleTableCellStyle {
	rowSpan?: number;
	columnSpan?: number;
	backgroundColor?: GoogleOptionalColor;
	borderTop?: GoogleTableCellBorder;
	borderBottom?: GoogleTableCellBorder;
	borderLeft?: GoogleTableCellBorder;
	borderRight?: GoogleTableCellBorder;
	paddingTop?: GoogleDimension;
	paddingBottom?: GoogleDimension;
	paddingLeft?: GoogleDimension;
	paddingRight?: GoogleDimension;
	contentAlignment?: string;
}

export interface GoogleTableCellBorder {
	color?: GoogleOptionalColor;
	width?: GoogleDimension;
	dashStyle?: string;
}

export interface GoogleSectionBreak {
	sectionStyle?: GoogleSectionStyle;
}

export interface GoogleSectionStyle {
	columnSeparatorStyle?: string;
	contentDirection?: string;
	sectionType?: string;
	defaultHeaderId?: string;
	defaultFooterId?: string;
	evenPageHeaderId?: string;
	evenPageFooterId?: string;
	firstPageHeaderId?: string;
	firstPageFooterId?: string;
	marginTop?: GoogleDimension;
	marginBottom?: GoogleDimension;
	marginRight?: GoogleDimension;
	marginLeft?: GoogleDimension;
	pageNumberStart?: number;
	columnProperties?: GoogleSectionColumnProperties[];
}

export interface GoogleSectionColumnProperties {
	width?: GoogleDimension;
	paddingEnd?: GoogleDimension;
}

export interface GoogleTableOfContents {
	content?: GoogleStructuralElement[];
}

export interface GoogleDocumentHeader {
	content?: GoogleStructuralElement[];
	headerId?: string;
}

export interface GoogleDocumentFooter {
	content?: GoogleStructuralElement[];
	footerId?: string;
}

export interface GoogleDocumentStyle {
	background?: GoogleBackground;
	pageNumberStart?: number;
	marginTop?: GoogleDimension;
	marginBottom?: GoogleDimension;
	marginRight?: GoogleDimension;
	marginLeft?: GoogleDimension;
	pageSize?: GoogleSize;
	marginHeader?: GoogleDimension;
	marginFooter?: GoogleDimension;
	useFirstPageHeaderFooter?: boolean;
	useEvenPageHeaderFooter?: boolean;
	flipPageOrientation?: boolean;
	defaultHeaderId?: string;
	defaultFooterId?: string;
	evenPageHeaderId?: string;
	evenPageFooterId?: string;
	firstPageHeaderId?: string;
	firstPageFooterId?: string;
}

export interface GoogleBackground {
	color?: GoogleOptionalColor;
}

export interface GoogleSize {
	width?: GoogleDimension;
	height?: GoogleDimension;
}

export interface GoogleNamedStyles {
	styles?: GoogleNamedStyle[];
}

export interface GoogleNamedStyle {
	namedStyleType?: string;
	textStyle?: GoogleTextStyle;
	paragraphStyle?: GoogleParagraphStyle;
}

export interface GoogleList {
	listProperties?: GoogleListProperties;
}

export interface GoogleListProperties {
	nestingLevels?: GoogleNestingLevel[];
}

export interface GoogleNestingLevel {
	bulletAlignment?: string;
	glyphFormat?: string;
	glyphSymbol?: string;
	glyphType?: string;
	indentFirstLine?: GoogleDimension;
	indentStart?: GoogleDimension;
	textStyle?: GoogleTextStyle;
	startNumber?: number;
}

// Additional element types
export interface GoogleInlineObjectElement {
	inlineObjectId?: string;
	textStyle?: GoogleTextStyle;
}

export interface GooglePageBreak {
	textStyle?: GoogleTextStyle;
}

export interface GoogleColumnBreak {
	textStyle?: GoogleTextStyle;
}

export interface GoogleFootnoteReference {
	footnoteId?: string;
	footnoteNumber?: string;
	textStyle?: GoogleTextStyle;
}

export interface GoogleHorizontalRule {
	textStyle?: GoogleTextStyle;
}

export interface GoogleEquation {
	textStyle?: GoogleTextStyle;
}

// Batch update types
export interface GoogleDocsBatchUpdateRequest {
	insertText?: {
		location: { index: number };
		text: string;
	};
	deleteContentRange?: {
		range: { startIndex: number; endIndex: number };
	};
	updateTextStyle?: {
		range: { startIndex: number; endIndex: number };
		textStyle: GoogleTextStyle;
		fields: string;
	};
	updateParagraphStyle?: {
		range: { startIndex: number; endIndex: number };
		paragraphStyle: GoogleParagraphStyle;
		fields: string;
	};
	insertPageBreak?: {
		location: { index: number };
	};
	insertSectionBreak?: {
		location: { index: number };
		sectionType: string;
	};
	insertTable?: {
		location: { index: number };
		rows: number;
		columns: number;
	};
	insertTableRow?: {
		tableCellLocation: {
			tableStartLocation: { index: number };
			rowIndex: number;
			columnIndex: number;
		};
		insertBelow: boolean;
	};
	insertTableColumn?: {
		tableCellLocation: {
			tableStartLocation: { index: number };
			rowIndex: number;
			columnIndex: number;
		};
		insertRight: boolean;
	};
	deleteTableRow?: {
		tableCellLocation: {
			tableStartLocation: { index: number };
			rowIndex: number;
			columnIndex: number;
		};
	};
	deleteTableColumn?: {
		tableCellLocation: {
			tableStartLocation: { index: number };
			rowIndex: number;
			columnIndex: number;
		};
	};
	replaceAllText?: {
		containsText: {
			text: string;
			matchCase: boolean;
		};
		replaceText: string;
	};
	createParagraphBullets?: {
		range: { startIndex: number; endIndex: number };
		bulletPreset: string;
	};
	deleteParagraphBullets?: {
		range: { startIndex: number; endIndex: number };
	};
	createNamedRange?: {
		name: string;
		range: { startIndex: number; endIndex: number };
	};
	deleteNamedRange?: {
		name?: string;
		namedRangeId?: string;
	};
}

export interface GoogleDocsBatchUpdateResponse {
	documentId: string;
	replies: GoogleDocsBatchUpdateReply[];
}

export interface GoogleDocsBatchUpdateReply {
	insertText?: {};
	deleteContentRange?: {};
	updateTextStyle?: {};
	updateParagraphStyle?: {};
	insertPageBreak?: {};
	insertSectionBreak?: {};
	insertTable?: {};
	insertTableRow?: {};
	insertTableColumn?: {};
	deleteTableRow?: {};
	deleteTableColumn?: {};
	replaceAllText?: {
		occurrencesChanged: number;
	};
	createParagraphBullets?: {};
	deleteParagraphBullets?: {};
	createNamedRange?: {
		namedRangeId: string;
	};
	deleteNamedRange?: {};
}

// Google Drive API types
export interface GoogleDriveFilesList {
	kind: string;
	nextPageToken?: string;
	incompleteSearch?: boolean;
	files: GoogleDriveFile[];
}

export interface GoogleDriveFile {
	kind: string;
	id: string;
	name: string;
	mimeType: string;
	description?: string;
	starred?: boolean;
	trashed?: boolean;
	explicitlyTrashed?: boolean;
	parents?: string[];
	properties?: Record<string, string>;
	appProperties?: Record<string, string>;
	spaces?: string[];
	version?: string;
	webContentLink?: string;
	webViewLink?: string;
	iconLink?: string;
	hasThumbnail?: boolean;
	thumbnailLink?: string;
	thumbnailVersion?: string;
	viewedByMe?: boolean;
	viewedByMeTime?: string;
	createdTime?: string;
	modifiedTime?: string;
	modifiedByMeTime?: string;
	modifiedByMe?: boolean;
	sharedWithMeTime?: string;
	sharingUser?: GoogleDriveUser;
	owners?: GoogleDriveUser[];
	teamDriveId?: string;
	driveId?: string;
	lastModifyingUser?: GoogleDriveUser;
	shared?: boolean;
	ownedByMe?: boolean;
	capabilities?: GoogleDriveCapabilities;
	viewersCanCopyContent?: boolean;
	copyRequiresWriterPermission?: boolean;
	writersCanShare?: boolean;
	permissions?: GoogleDrivePermission[];
	permissionIds?: string[];
	hasAugmentedPermissions?: boolean;
	folderColorRgb?: string;
	originalFilename?: string;
	fullFileExtension?: string;
	fileExtension?: string;
	md5Checksum?: string;
	sha1Checksum?: string;
	sha256Checksum?: string;
	size?: string;
	quotaBytesUsed?: string;
	headRevisionId?: string;
	contentHints?: {
		thumbnail?: {
			image?: string;
			mimeType?: string;
		};
		indexableText?: string;
	};
	imageMediaMetadata?: {
		width?: number;
		height?: number;
		rotation?: number;
		location?: {
			latitude?: number;
			longitude?: number;
			altitude?: number;
		};
		time?: string;
		cameraMake?: string;
		cameraModel?: string;
		exposureTime?: number;
		aperture?: number;
		flashUsed?: boolean;
		focalLength?: number;
		isoSpeed?: number;
		meteringMode?: string;
		sensor?: string;
		exposureMode?: string;
		colorSpace?: string;
		whiteBalance?: string;
		exposureBias?: number;
		maxApertureValue?: number;
		subjectDistance?: number;
		lens?: string;
	};
	videoMediaMetadata?: {
		width?: number;
		height?: number;
		durationMillis?: string;
	};
	isAppAuthorized?: boolean;
	exportLinks?: Record<string, string>;
}

export interface GoogleDriveUser {
	kind: string;
	displayName: string;
	photoLink?: string;
	me?: boolean;
	permissionId: string;
	emailAddress?: string;
}

export interface GoogleDriveCapabilities {
	canAcceptOwnership?: boolean;
	canAddChildren?: boolean;
	canAddFolderFromAnotherDrive?: boolean;
	canAddMyDriveParent?: boolean;
	canChangeCopyRequiresWriterPermission?: boolean;
	canChangeSecurityUpdateEnabled?: boolean;
	canChangeViewersCanCopyContent?: boolean;
	canComment?: boolean;
	canCopy?: boolean;
	canCreate?: boolean;
	canDelete?: boolean;
	canDeleteChildren?: boolean;
	canDownload?: boolean;
	canEdit?: boolean;
	canListChildren?: boolean;
	canModifyContent?: boolean;
	canModifyContentRestriction?: boolean;
	canMoveChildrenOutOfTeamDrive?: boolean;
	canMoveChildrenOutOfDrive?: boolean;
	canMoveChildrenWithinTeamDrive?: boolean;
	canMoveChildrenWithinDrive?: boolean;
	canMoveItemIntoTeamDrive?: boolean;
	canMoveItemOutOfTeamDrive?: boolean;
	canMoveItemOutOfDrive?: boolean;
	canMoveItemWithinTeamDrive?: boolean;
	canMoveItemWithinDrive?: boolean;
	canMoveTeamDriveItem?: boolean;
	canReadLabels?: boolean;
	canReadRevisions?: boolean;
	canReadTeamDrive?: boolean;
	canReadDrive?: boolean;
	canRemoveChildren?: boolean;
	canRemoveMyDriveParent?: boolean;
	canRename?: boolean;
	canShare?: boolean;
	canTrash?: boolean;
	canTrashChildren?: boolean;
	canUntrash?: boolean;
}

export interface GoogleDrivePermission {
	kind: string;
	id: string;
	type: string;
	emailAddress?: string;
	domain?: string;
	role: string;
	view?: string;
	allowFileDiscovery?: boolean;
	displayName?: string;
	photoLink?: string;
	expirationTime?: string;
	teamDrivePermissionDetails?: Array<{
		teamDrivePermissionType: string;
		role: string;
		inherited: boolean;
		inheritedFrom: string;
	}>;
	permissionDetails?: Array<{
		permissionType: string;
		role: string;
		inherited: boolean;
		inheritedFrom: string;
	}>;
	deleted?: boolean;
	pendingOwner?: boolean;
}

/**
 * Client for interacting with the Google Docs and Drive APIs
 */
export class GoogleDocsClient {
	private accessToken: string;
	private refreshToken?: string;
	private clientId: string;
	private clientSecret: string;
	private expiresAt?: number;
	private readonly apiBaseUrl = 'https://www.googleapis.com';
	private readonly authUrl = 'https://oauth2.googleapis.com/token';
	private readonly requiredScopes = [
		'https://www.googleapis.com/auth/documents',
		'https://www.googleapis.com/auth/drive.readonly',
		'https://www.googleapis.com/auth/drive.file'
	];

	/**
	 * Create a new GoogleDocsClient
	 * @param accessToken OAuth2 access token
	 * @param refreshToken OAuth2 refresh token (optional)
	 * @param clientId OAuth2 client ID
	 * @param clientSecret OAuth2 client secret
	 * @param expiresAt Token expiration timestamp
	 */
	constructor(
		accessToken: string,
		refreshToken: string | undefined,
		clientId: string,
		clientSecret: string,
		expiresAt?: number
	) {
		this.accessToken = accessToken;
		this.refreshToken = refreshToken;
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.expiresAt = expiresAt;
	}

	/**
	 * Create a GoogleDocsClient from an AuthConfig
	 * @param auth Authentication configuration
	 * @returns A new GoogleDocsClient instance or null if auth is invalid
	 */
	static fromAuthConfig(auth?: AuthConfig): GoogleDocsClient | null {
		if (!auth || auth.method !== 'oauth2') {
			logger.warn('GoogleDocsClient: Invalid auth config, must use oauth2 method');
			return null;
		}

		const accessToken = auth.credentials?.accessToken as string;
		const clientId = auth.credentials?.clientId as string;
		const clientSecret = auth.credentials?.clientSecret as string;
		const refreshToken = auth.tokenData?.refreshToken;
		const expiresAt = auth.tokenData?.expiresAt;

		if (!accessToken || !clientId || !clientSecret) {
			logger.warn('GoogleDocsClient: Missing required OAuth2 credentials');
			return null;
		}

		return new GoogleDocsClient(
			accessToken,
			refreshToken,
			clientId,
			clientSecret,
			expiresAt
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
	 * Refresh the access token using the refresh token
	 * @returns True if refresh was successful
	 */
	private async refreshAccessToken(): Promise<boolean> {
		if (!this.refreshToken) {
			logger.warn('GoogleDocsClient: No refresh token available');
			return false;
		}

		try {
			const response = await fetch(this.authUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					grant_type: 'refresh_token',
					refresh_token: this.refreshToken,
					client_id: this.clientId,
					client_secret: this.clientSecret,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				logger.error(`GoogleDocsClient: Token refresh failed (${response.status}): ${errorText}`);
				return false;
			}

			const data = await response.json();
			this.accessToken = data.access_token;
			
			// Update expiry time if provided
			if (data.expires_in) {
				this.expiresAt = Date.now() + (data.expires_in * 1000);
			}

			// Update refresh token if provided
			if (data.refresh_token) {
				this.refreshToken = data.refresh_token;
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
	 * @param endpoint API endpoint path
	 * @param method HTTP method
	 * @param body Request body
	 * @returns Response data
	 */
	private async request<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T> {
		// Ensure we have a valid token
		const hasValidToken = await this.ensureValidToken();
		if (!hasValidToken) {
			throw new Error('GoogleDocsClient: Unable to obtain valid access token');
		}

		const url = `${this.apiBaseUrl}${endpoint}`;
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
							throw new Error(`Google API error after token refresh (${retryResponse.status}): ${retryErrorText}`);
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

		const endpoint = `/docs/v1/documents/${resolvedId}`;
		const response = await this.request<{ data?: GoogleDocument } & GoogleDocument>(endpoint);
		
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
		pageToken?: string
	): Promise<GoogleDriveFilesList> {
		let q = "mimeType='application/vnd.google-apps.document'";
		
		if (query) {
			q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
		}
		
		if (folderId) {
			q += ` and '${folderId}' in parents`;
		}
		
		// Exclude trashed files
		q += " and trashed=false";

		const params = new URLSearchParams({
			q,
			pageSize: pageSize.toString(),
			fields: 'nextPageToken,files(id,name,mimeType,webViewLink,createdTime,modifiedTime,owners,parents,shared)',
		});

		if (pageToken) {
			params.set('pageToken', pageToken);
		}

		const endpoint = `/drive/v3/files?${params.toString()}`;
		const response = await this.request<{ data?: GoogleDriveFilesList } & GoogleDriveFilesList>(endpoint);
		
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
		requests: GoogleDocsBatchUpdateRequest[]
	): Promise<GoogleDocsBatchUpdateResponse> {
		const resolvedId = this.resolveDocumentUrl(documentId);
		if (!resolvedId) {
			throw new Error(`Invalid document ID or URL: ${documentId}`);
		}

		const endpoint = `/docs/v1/documents/${resolvedId}:batchUpdate`;
		const body = { requests };
		
		const response = await this.request<{ data?: GoogleDocsBatchUpdateResponse } & GoogleDocsBatchUpdateResponse>(
			endpoint,
			'POST',
			body
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
		const endpoint = '/docs/v1/documents';
		const body = { title };
		
		const response = await this.request<{ data?: GoogleDocument } & GoogleDocument>(
			endpoint,
			'POST',
			body
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
		const endpoint = `/drive/v3/files/${fileId}`;
		const params = new URLSearchParams({
			fields: 'id,name,mimeType,webViewLink,createdTime,modifiedTime,owners,parents,shared,size,description',
		});

		const response = await this.request<{ data?: GoogleDriveFile } & GoogleDriveFile>(
			`${endpoint}?${params.toString()}`
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
		index?: number
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
		matchCase: boolean = false
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
}