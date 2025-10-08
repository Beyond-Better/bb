/**
 * Enhanced URI parsing framework for datasource-agnostic URI handling
 * Provides context-aware validation and parsing with extensible architecture
 */

import { logger } from 'shared/logger.ts';
import { extractResourcePath } from 'shared/dataSource.ts';
import { URIContext, ValidationMode } from 'shared/types/resourceValidation.ts';
import type {
	EnhancedURIParseResult,
	URIConstructionOptions,
	ValidationResult,
} from 'shared/types/resourceValidation.ts';

/**
 * Abstract base class for enhanced URI parsers
 * Provides common functionality and enforces consistent interface
 */
export abstract class EnhancedURIParser<T = unknown> {
	/**
	 * Provider type this parser handles
	 */
	protected abstract readonly providerType: string;

	/**
	 * Parse a URI with enhanced validation and context
	 * @param resourceUri URI to parse
	 * @param mode Validation mode to use
	 * @returns Enhanced parsing result
	 */
	parse(resourceUri: string, mode: ValidationMode = ValidationMode.STRICT): EnhancedURIParseResult<T> {
		logger.debug(`EnhancedURIParser[${this.providerType}]: Parsing URI "${resourceUri}" with mode "${mode}"`);

		const resourcePath = extractResourcePath(resourceUri);
		logger.debug(`EnhancedURIParser[${this.providerType}]: Extracted resource path: "${resourcePath}"`);

		// Attempt to parse with the specific mode
		const parseResult = this.parseResourcePath(resourcePath, mode);

		// Create validation result
		const validation = this.createValidationResult(parseResult, resourcePath, mode);

		// Create normalized URI if parsing was successful
		let normalizedUri: string | undefined;
		if (validation.isValid && parseResult) {
			normalizedUri = this.constructNormalizedUri(parseResult, resourceUri);
		}

		return {
			parsed: parseResult,
			validation,
			originalUri: resourceUri,
			normalizedUri,
		};
	}

	/**
	 * Build a resource URI for this datasource type
	 * @param partialPath Partial path or identifier
	 * @param options Construction options
	 * @returns Constructed URI
	 */
	buildResourceUri(partialPath: string, options: URIConstructionOptions): string {
		logger.debug(
			`EnhancedURIParser[${this.providerType}]: Building URI for "${partialPath}" with context "${options.context}"`,
		);

		switch (options.context) {
			case URIContext.AUTOCOMPLETE:
				return this.buildAutocompleteUri(partialPath, options);
			case URIContext.ACCESS:
				return this.buildAccessUri(partialPath, options);
			case URIContext.VALIDATION:
				return this.buildValidationUri(partialPath, options);
			default:
				return this.buildDefaultUri(partialPath, options);
		}
	}

	/**
	 * Validate a resource URI with detailed feedback
	 * @param resourceUri URI to validate
	 * @param mode Validation mode
	 * @returns Validation result
	 */
	validate(resourceUri: string, mode: ValidationMode = ValidationMode.STRICT): ValidationResult {
		const parseResult = this.parse(resourceUri, mode);
		return parseResult.validation;
	}

	/**
	 * Check if a partial path could be valid for this datasource
	 * @param partialPath Partial path being typed
	 * @param context Context for validation
	 * @returns Whether potentially valid
	 */
	isPartialPathValid(partialPath: string, context: URIContext = URIContext.AUTOCOMPLETE): boolean {
		// Default implementation - can be overridden by subclasses
		return partialPath.length > 0 && !partialPath.includes('..');
	}

	// Abstract methods that subclasses must implement

	/**
	 * Parse the resource path portion of the URI
	 * @param resourcePath Extracted resource path
	 * @param mode Validation mode
	 * @returns Parsed result or null if invalid
	 */
	protected abstract parseResourcePath(resourcePath: string | null, mode: ValidationMode): T | null;

	/**
	 * Construct normalized URI from parsed result
	 * @param parsed Parsed URI components
	 * @param originalUri Original URI for reference
	 * @returns Normalized URI
	 */
	protected abstract constructNormalizedUri(parsed: T, originalUri: string): string;

	// Virtual methods with default implementations that can be overridden

	/**
	 * Build URI for autocomplete context
	 * @param partialPath Partial path
	 * @param options Construction options
	 * @returns Constructed URI
	 */
	protected buildAutocompleteUri(partialPath: string, options: URIConstructionOptions): string {
		// Default: treat as access URI
		return this.buildAccessUri(partialPath, options);
	}

	/**
	 * Build URI for access context
	 * @param partialPath Partial path
	 * @param options Construction options
	 * @returns Constructed URI
	 */
	protected buildAccessUri(partialPath: string, options: URIConstructionOptions): string {
		// Default: use file: prefix
		return `file:./${partialPath}`;
	}

	/**
	 * Build URI for validation context
	 * @param partialPath Partial path
	 * @param options Construction options
	 * @returns Constructed URI
	 */
	protected buildValidationUri(partialPath: string, options: URIConstructionOptions): string {
		// Default: same as access URI
		return this.buildAccessUri(partialPath, options);
	}

	/**
	 * Build default URI when context is not specified
	 * @param partialPath Partial path
	 * @param options Construction options
	 * @returns Constructed URI
	 */
	protected buildDefaultUri(partialPath: string, options: URIConstructionOptions): string {
		return this.buildAccessUri(partialPath, options);
	}

	/**
	 * Create validation result from parse attempt
	 * @param parseResult Result of parsing attempt
	 * @param resourcePath Original resource path
	 * @param mode Validation mode used
	 * @returns Validation result
	 */
	protected createValidationResult(
		parseResult: T | null,
		resourcePath: string | null,
		mode: ValidationMode,
	): ValidationResult {
		if (!parseResult) {
			return {
				isValid: false,
				mode,
				error: this.getValidationError(resourcePath, mode),
				suggestions: this.getValidationSuggestions(resourcePath, mode),
			};
		}

		return {
			isValid: true,
			mode,
			isPartial: mode === ValidationMode.PARTIAL || mode === ValidationMode.LENIENT,
		};
	}

	/**
	 * Get error message for failed validation
	 * @param resourcePath Resource path that failed
	 * @param mode Validation mode
	 * @returns Error message
	 */
	protected getValidationError(resourcePath: string | null, mode: ValidationMode): string {
		if (!resourcePath) {
			return `No resource path found in URI for ${this.providerType} datasource`;
		}

		switch (mode) {
			case ValidationMode.STRICT:
				return `Invalid ${this.providerType} resource path: "${resourcePath}". Path must be properly formatted.`;
			case ValidationMode.LENIENT:
				return `Resource path "${resourcePath}" may not be complete for ${this.providerType} datasource.`;
			case ValidationMode.PARTIAL:
				return `Partial path "${resourcePath}" needs more information for ${this.providerType} datasource.`;
			default:
				return `Invalid resource path: "${resourcePath}"`;
		}
	}

	/**
	 * Get validation suggestions for failed parsing
	 * @param resourcePath Resource path that failed
	 * @param mode Validation mode
	 * @returns Array of suggestions
	 */
	protected getValidationSuggestions(resourcePath: string | null, mode: ValidationMode): string[] {
		// Default implementation - subclasses should override with specific suggestions
		return [
			`Check ${this.providerType} documentation for proper URI format`,
			'Ensure the resource path is complete and properly formatted',
		];
	}
}
