/**
 * Parameters used in LLM requests
 */
export interface LLMExtendedThinkingOptions {
	/**
	 * Whether extended thinking is enabled
	 */
	enabled: boolean;

	/**
	 * The maximum number of tokens Claude is allowed to use for its internal reasoning process
	 * Minimum is 1,024 tokens
	 */
	budgetTokens: number;
}

/**
 * Request parameters used when calling the LLM provider
 */
export interface LLMRequestParams {
	/**
	 * The model identifier used for the request
	 */
	model: string;

	/**
	 * Temperature setting used for the request (controls randomness)
	 */
	temperature: number;

	/**
	 * Maximum tokens the model can generate in response
	 */
	maxTokens: number;

	/**
	 * Extended thinking options for supported models
	 */
	extendedThinking?: LLMExtendedThinkingOptions;

	/**
	 * Whether prompt caching was enabled for this request
	 */
	usePromptCaching?: boolean;
}

const LLMAttachedFiles = Array<{
	id: string;
	fileId?: string; // Set after successful upload
	file: File;
	name: string;
	type: string;
	previewUrl?: string; // For images
	size: number;
	uploadStatus: 'uploading' | 'complete' | 'error';
	uploadProgress: number;
}>;
