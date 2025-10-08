/**
 * Interface definitions for DataSourceProvider.
 * DataSourceProvider defines the capabilities and characteristics of a type of data source.
 */
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type {
	DataSourceAccessMethod,
	DataSourceAuth,
	DataSourceAuthMethod,
	DataSourceCapability,
} from 'shared/types/dataSource.ts';
import type { AcceptedContentType, AcceptedEditType, ContentTypeGuidance } from 'shared/types/dataSource.ts';
import type { InstructionFilters } from 'api/types/instructionFilters.ts';
import type {
	URIConstructionOptions,
	URIContext,
	ValidationMode,
	ValidationResult,
} from 'shared/types/resourceValidation.ts';

/**
 * DataSourceProvider interface
 * Defines the capabilities and characteristics of a type of data source.
 */
export interface DataSourceProvider {
	/**
	 * Unique identifier for this provider type (e.g., 'filesystem', 'notion', 'supabase-prod')
	 */
	readonly providerType: string;

	/**
	 * Access method - fundamental distinction that affects how operations are performed
	 */
	readonly accessMethod: DataSourceAccessMethod;

	/**
	 * URI Template for this provider type
	 */
	readonly uriTemplate?: string;

	/**
	 * Human-readable name for this provider type
	 */
	readonly name: string;

	/**
	 * Descriptive text about this provider
	 */
	readonly description: string;

	/**
	 * List of supported operations ('read', 'write', 'list', 'search', etc.)
	 */
	readonly capabilities: DataSourceCapability[];

	/**
	 * List of configuration fields required for this provider
	 */
	readonly requiredConfigFields: string[];

	/**
	 * Auth Type and List of auth fields required for this provider
	 * [TODO] Does authType need to be an array, do any providers support multiple auth types
	 */
	readonly authType: DataSourceAuthMethod;
	// required fields are defined by authType
	//readonly requiredAuthFields: string[];

	/**
	 * Factory method to create ResourceAccessor instances for this provider
	 * @param connection The connection configuration to use
	 * @returns A ResourceAccessor instance for accessing resources
	 */
	createAccessor(connection: DataSourceConnection): ResourceAccessor;

	/**
	 * Validate configuration for this provider
	 * @param config The configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	validateConfig(config: Record<string, unknown>): boolean;

	/**
	 * Validate auth for this provider
	 * @param auth The auth to validate
	 * @returns True if the auth is valid, false otherwise
	 */
	validateAuth(auth: DataSourceAuth): boolean;

	/**
	 * Check if this provider supports a specific capability
	 * @param capability Capability to check
	 * @returns True if the capability is supported
	 */
	hasCapability(capability: DataSourceCapability): boolean;

	/**
	 * Array of content types this provider accepts for write/edit operations
	 */
	readonly acceptedContentTypes: AcceptedContentType[];

	/**
	 * Array of edit approaches this provider supports
	 */
	readonly acceptedEditTypes: AcceptedEditType[];

	/**
	 * Preferred content type for this provider
	 */
	readonly preferredContentType: AcceptedContentType;

	/**
	 * Get content type guidance for LLM tool usage
	 * Provides examples and usage information for proper tool calls
	 * @returns ContentTypeGuidance object with usage examples and constraints
	 */
	getContentTypeGuidance(): ContentTypeGuidance;

	/**
	 * Get detailed editing instructions for LLM tool usage
	 * Must be implemented by subclasses to provide comprehensive editing guidance
	 * @param filters Optional filters to customize instruction content
	 * @returns Detailed instruction text with provider-specific examples and workflows
	 */
	getDetailedInstructions(filters?: InstructionFilters): string;

	/**
	 * Get error-specific guidance for LLM tool usage
	 * Provides context-aware error messaging based on error type and operation
	 * @param errorType The type of error encountered
	 * @param operation The operation that failed
	 * @param hasLoadedInstructions Whether the LLM has already loaded instructions
	 * @returns Object with enhanced error message and guidance type
	 */
	getErrorGuidance(
		errorType:
			| 'not_found'
			| 'permission_denied'
			| 'invalid_format'
			| 'workflow_violation'
			| 'configuration'
			| 'unknown',
		operation: string,
		hasLoadedInstructions?: boolean,
	): { message: string; type: 'workflow' | 'instructions' | 'configuration' | 'format' };

	/**
	 * Build a datasource-specific URI from a partial path
	 * Each provider can implement its own URI construction logic
	 * @param partialPath Partial path or resource identifier
	 * @param options Construction options with context
	 * @returns Properly formatted URI for this datasource type
	 */
	buildResourceUri?(partialPath: string, options: URIConstructionOptions): string;

	/**
	 * Validate a resource URI with datasource-specific rules
	 * @param resourceUri URI to validate
	 * @param mode Validation mode to use
	 * @returns Detailed validation result
	 */
	validateResourceUri?(resourceUri: string, mode?: ValidationMode): ValidationResult;

	/**
	 * Check if a partial path could be valid for this datasource
	 * Used for autocomplete and suggestion filtering
	 * @param partialPath Partial path being typed
	 * @param context Context for the validation
	 * @returns Whether the partial path is potentially valid
	 */
	isPartialPathValid?(partialPath: string, context?: URIContext): boolean;
}
