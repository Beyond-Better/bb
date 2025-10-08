export interface TabularSheet {
	/** Name of the sheet/table */
	name: string;
	/** 2D array of cell values */
	data: Array<Array<string | number | boolean | null>>;
	/** Optional metadata about the sheet */
	metadata?: {
		/** Column headers (if first row contains headers) */
		headers?: string[];
		/** Data range in A1 notation (e.g., "A1:C10") */
		dataRange?: string;
		/** Named cell formulas */
		formulas?: Record<string, string>;
		/** Named ranges defined in the sheet */
		namedRanges?: Record<string, string>;
	};
}
