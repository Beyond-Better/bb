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
	insertText?: Record<PropertyKey, never>;
	deleteContentRange?: Record<PropertyKey, never>;
	updateTextStyle?: Record<PropertyKey, never>;
	updateParagraphStyle?: Record<PropertyKey, never>;
	insertPageBreak?: Record<PropertyKey, never>;
	insertSectionBreak?: Record<PropertyKey, never>;
	insertTable?: Record<PropertyKey, never>;
	insertTableRow?: Record<PropertyKey, never>;
	insertTableColumn?: Record<PropertyKey, never>;
	deleteTableRow?: Record<PropertyKey, never>;
	deleteTableColumn?: Record<PropertyKey, never>;
	replaceAllText?: {
		occurrencesChanged: number;
	};
	createParagraphBullets?: Record<PropertyKey, never>;
	deleteParagraphBullets?: Record<PropertyKey, never>;
	createNamedRange?: {
		namedRangeId: string;
	};
	deleteNamedRange?: Record<PropertyKey, never>;
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
