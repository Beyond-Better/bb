/**
 * Parameters used in LLM requests
 */
export interface LLMExtendedThinkingOptions {
	/**
	 * Whether extended thinking is enabled
	 */
	enabled: boolean;

	/**
	 * The maximum number of tokens Assistant is allowed to use for its internal reasoning process
	 * Minimum is 1,024 tokens
	 */
	budgetTokens: number;
}

// Re-export types from shared for consistency
export type { LLMModelConfig, LLMRolesModelConfig } from 'shared/types.ts';

/**
 * Request parameters used when calling the LLM provider
 */
export interface LLMRequestParams {
	/**
	 * Role-specific model configurations
	 */
	rolesModelConfig: LLMRolesModelConfig;

	// Legacy fields for migration - will be removed eventually
	model?: string;
	temperature?: number;
	maxTokens?: number;
	extendedThinking?: LLMExtendedThinkingOptions;
	usePromptCaching?: boolean;
}

export type LLMAttachedFiles = Array<LLMAttachedFile>;

export interface LLMAttachedFile {
	id: string;
	fileId?: string; // Set after successful upload
	file: File;
	name: string;
	type: string;
	previewUrl?: string; // For images
	size: number;
	uploadStatus: 'uploading' | 'complete' | 'error';
	uploadProgress: number;
}
