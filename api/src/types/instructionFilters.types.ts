/**
 * Types for filtering datasource instructions to reduce cognitive load and token usage
 */

export interface InstructionFilters {
	/**
	 * Filter instructions by content type
	 * Examples:
	 * - ["documents"] for Google Docs only
	 * - ["spreadsheets"] for Google Sheets only
	 * - ["documents", "spreadsheets"] for both
	 */
	contentTypes?: ('documents' | 'spreadsheets' | 'files' | 'databases' | 'apis')[];

	/**
	 * Filter instructions by operation type
	 * Examples:
	 * - ["create"] for writing/creation only
	 * - ["edit"] for editing only
	 * - ["search"] for search/discovery only
	 * - ["utility"] for rename, move, remove, display operations
	 */
	operations?: ('create' | 'edit' | 'search' | 'delete' | 'move' | 'rename' | 'utility')[];

	/**
	 * Filter instructions by edit operation type
	 * Examples:
	 * - ["searchReplace"] for text search/replace only
	 * - ["cell"] for spreadsheet operations only
	 * - ["range"] for character-level document editing only
	 */
	editTypes?: ('searchReplace' | 'range' | 'blocks' | 'cell' | 'structuredData')[];

	/**
	 * Filter instructions by section type
	 * Examples:
	 * - ["workflows", "limitations"] for critical workflows and limitations only
	 * - ["examples"] for examples only
	 * - ["troubleshooting"] for error guidance only
	 */
	sections?: ('workflows' | 'examples' | 'limitations' | 'bestPractices' | 'troubleshooting' | 'overview')[];

	/**
	 * Whether to include provider overview and capabilities
	 * Set to false to exclude general information when you only need specific operation details
	 * Default: true
	 */
	includeOverview?: boolean;
}

export interface FilteredInstructionContent {
	/** The filtered instruction text */
	content: string;
	/** Which filters were applied */
	appliedFilters: InstructionFilters;
	/** Which instruction sections were included */
	includedSections: string[];
	/** Estimated token savings vs full instructions */
	tokenSavings?: {
		estimatedOriginalTokens: number;
		estimatedFilteredTokens: number;
		percentageReduction: number;
	};
}
