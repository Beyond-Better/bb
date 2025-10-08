import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { DataSourceProvider } from '../dataSources/interfaces/dataSourceProvider.ts';

/**
 * Enhanced error context for datasource operations
 */
export interface DatasourceErrorContext {
	/** The original error message */
	originalError: string;
	/** The datasource provider instance */
	provider: DataSourceProvider;
	/** The specific operation that failed (e.g., 'edit', 'write', 'load') */
	operation: string;
	/** Resource path or identifier */
	resourcePath?: string;
	/** Additional error context */
	errorType?:
		| 'not_found'
		| 'permission_denied'
		| 'invalid_format'
		| 'workflow_violation'
		| 'configuration'
		| 'unknown';
	/** Whether this error suggests missing workflow knowledge */
	workflowRelated?: boolean;
}

/**
 * Enhanced error message with datasource instruction guidance
 */
export interface EnhancedErrorResult {
	/** The enhanced error message */
	message: string;
	/** Whether enhancement was applied */
	enhanced: boolean;
	/** The specific guidance provided */
	guidanceType?: 'workflow' | 'instructions' | 'configuration' | 'format';
}

/**
 * Enhance error messages with datasource instruction reminders
 * Provides context-specific guidance based on error type and datasource
 */
export class DatasourceErrorEnhancer {
	/**
	 * Enhance an error message with datasource-specific guidance
	 * @param context Error context information
	 * @param interaction Current conversation interaction (to check if instructions were loaded)
	 * @returns Enhanced error message with guidance
	 */
	static enhanceError(
		context: DatasourceErrorContext,
		interaction?: LLMConversationInteraction,
	): EnhancedErrorResult {
		// Determine if this error type benefits from instruction guidance
		if (!this.shouldEnhanceError(context)) {
			return {
				message: context.originalError,
				enhanced: false,
			};
		}

		// Check if user has already loaded datasource instructions
		const hasLoadedInstructions = interaction
			? this.hasLoadedDatasourceInstructions(interaction, context.provider.providerType)
			: false;

		// Generate context-specific guidance
		const guidance = this.generateGuidance(context, hasLoadedInstructions);

		// Combine original error with guidance
		const enhancedMessage = `${context.originalError}

${guidance.message}`;

		return {
			message: enhancedMessage,
			enhanced: true,
			guidanceType: guidance.type,
		};
	}

	/**
	 * Determine if an error should be enhanced with instruction guidance
	 */
	private static shouldEnhanceError(context: DatasourceErrorContext): boolean {
		// Always enhance workflow-related errors
		if (context.workflowRelated) {
			return true;
		}

		// Enhanced based on error type
		switch (context.errorType) {
			case 'not_found':
			case 'invalid_format':
			case 'workflow_violation':
			case 'configuration':
				return true;
			case 'permission_denied':
				// Only for non-filesystem (filesystem permissions are usually system-level)
				return context.provider.providerType !== 'filesystem';
			default:
				// For unknown errors, enhance if it's a non-filesystem datasource operation
				return context.provider.providerType !== 'filesystem' && context.operation !== 'unknown';
		}
	}

	/**
	 * Check if datasource instructions have been loaded in current conversation
	 * This is a heuristic check - in practice, you might track this more precisely
	 */
	private static hasLoadedDatasourceInstructions(
		interaction: LLMConversationInteraction,
		providerType: string,
	): boolean {
		// TODO: Implement actual check for loaded instructions
		// For now, return false to always show guidance
		// In practice, you could check:
		// - Recent tool use history for loadDatasource calls
		// - Message content for instruction keywords
		// - Specific markers set during loadDatasource operations
		return false;
	}

	/**
	 * Generate context-specific guidance message using provider's getErrorGuidance method
	 */
	private static generateGuidance(
		context: DatasourceErrorContext,
		hasLoadedInstructions: boolean,
	): { message: string; type: 'workflow' | 'instructions' | 'configuration' | 'format' } {
		// Delegate to the provider's getErrorGuidance method for provider-specific logic
		return context.provider.getErrorGuidance(
			context.errorType || 'unknown',
			context.operation,
			hasLoadedInstructions,
		);
	}

	/**
	 * Convenience method for common tool error patterns
	 * Analyzes error message to determine likely error type
	 */
	static enhanceToolError(
		errorMessage: string,
		provider: DataSourceProvider,
		operation: string,
		resourcePath?: string,
		interaction?: LLMConversationInteraction,
	): EnhancedErrorResult {
		// Analyze error message to determine error type
		const errorType = this.analyzeErrorType(errorMessage);
		const workflowRelated = this.isWorkflowRelatedError(errorMessage, provider.providerType);

		return this.enhanceError({
			originalError: errorMessage,
			provider,
			operation,
			resourcePath,
			errorType,
			workflowRelated,
		}, interaction);
	}

	/**
	 * Analyze error message to determine error type
	 */
	private static analyzeErrorType(errorMessage: string): DatasourceErrorContext['errorType'] {
		const lowerMessage = errorMessage.toLowerCase();

		if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
			return 'not_found';
		}
		if (
			lowerMessage.includes('permission denied') || lowerMessage.includes('forbidden') ||
			lowerMessage.includes('401') || lowerMessage.includes('403')
		) {
			return 'permission_denied';
		}
		if (lowerMessage.includes('invalid') || lowerMessage.includes('malformed') || lowerMessage.includes('400')) {
			return 'invalid_format';
		}
		if (lowerMessage.includes('workflow') || lowerMessage.includes('sequence') || lowerMessage.includes('order')) {
			return 'workflow_violation';
		}
		if (lowerMessage.includes('config') || lowerMessage.includes('setup') || lowerMessage.includes('auth')) {
			return 'configuration';
		}

		return 'unknown';
	}

	/**
	 * Determine if error is likely workflow-related based on message and provider
	 */
	private static isWorkflowRelatedError(errorMessage: string, providerType: string): boolean {
		const lowerMessage = errorMessage.toLowerCase();

		// Google-specific workflow indicators
		if (providerType === 'google') {
			return lowerMessage.includes('index') ||
				lowerMessage.includes('range') ||
				lowerMessage.includes('a1') ||
				lowerMessage.includes('cell') ||
				lowerMessage.includes('format') ||
				lowerMessage.includes('structured') ||
				lowerMessage.includes('content');
		}

		// General workflow indicators
		return lowerMessage.includes('load first') ||
			lowerMessage.includes('missing step') ||
			lowerMessage.includes('required format') ||
			lowerMessage.includes('prerequisite');
	}
}

/**
 * Convenience function for enhancing errors in tool contexts
 */
export function enhanceDatasourceError(
	errorMessage: string,
	provider: DataSourceProvider,
	operation: string,
	resourcePath?: string,
	interaction?: LLMConversationInteraction,
): string {
	const result = DatasourceErrorEnhancer.enhanceToolError(
		errorMessage,
		provider,
		operation,
		resourcePath,
		interaction,
	);

	return result.enhanced ? result.message : errorMessage;
}
