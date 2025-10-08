/**
 * Resource validation and URI construction framework types
 * Provides context-aware validation and URI construction for different datasource types
 */

/**
 * Validation modes for different use cases
 */
export enum ValidationMode {
	/**
	 * Full validation for actual resource operations
	 * Requires complete, properly formatted URIs
	 */
	STRICT = 'strict',

	/**
	 * Relaxed validation for autocomplete/suggestions
	 * Accepts partial paths and fragments for user assistance
	 */
	LENIENT = 'lenient',

	/**
	 * Validation of incomplete/fragment URIs
	 * Used for partial path validation during typing
	 */
	PARTIAL = 'partial',
}

/**
 * URI construction context for different scenarios
 */
export enum URIContext {
	/**
	 * Constructing URIs for actual resource access
	 * Requires complete, valid resource identification
	 */
	ACCESS = 'access',

	/**
	 * Constructing URIs for autocomplete/suggestions
	 * May use fragments or partial information
	 */
	AUTOCOMPLETE = 'autocomplete',

	/**
	 * Constructing URIs for validation purposes
	 * Used to test path validity without resource access
	 */
	VALIDATION = 'validation',
}

/**
 * Result of URI parsing with validation context
 */
export interface ValidationResult {
	/**
	 * Whether the URI is valid for the given mode
	 */
	isValid: boolean;

	/**
	 * Validation mode used
	 */
	mode: ValidationMode;

	/**
	 * Error message if invalid
	 */
	error?: string;

	/**
	 * Suggested corrections for invalid URIs
	 */
	suggestions?: string[];

	/**
	 * Whether this is a partial match (for autocomplete)
	 */
	isPartial?: boolean;
}

/**
 * Options for URI construction
 */
export interface URIConstructionOptions {
	/**
	 * Context for URI construction
	 */
	context: URIContext;

	/**
	 * Validation mode to use
	 */
	validationMode?: ValidationMode;

	/**
	 * Additional metadata for construction
	 */
	metadata?: Record<string, unknown>;
}

/**
 * Enhanced URI parsing result with context
 */
export interface EnhancedURIParseResult<T = unknown> {
	/**
	 * Parsed URI components (datasource-specific)
	 * Null when parsing fails
	 */
	parsed: T | null;

	/**
	 * Validation result
	 */
	validation: ValidationResult;

	/**
	 * Original URI that was parsed
	 */
	originalUri: string;

	/**
	 * Normalized URI (if different from original)
	 */
	normalizedUri?: string;
}
