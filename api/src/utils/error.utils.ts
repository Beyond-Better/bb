import {
	APIError,
	DataSourceHandlingError,
	ErrorType,
	ErrorTypes,
	ExternalServiceError,
	FileChangeError,
	FileHandlingError,
	FileMoveError,
	FileNotFoundError,
	FileReadError,
	FileWriteError,
	LLMError,
	MCPServerError,
	ProjectHandlingError,
	RateLimitError,
	ResourceChangeError,
	ResourceHandlingError,
	ResourceMoveError,
	ResourceNotFoundError,
	ResourceReadError,
	ResourceWriteError,
	ToolHandlingError,
	ValidationError,
	VectorSearchError,
} from 'api/errors/error.ts';

export { ErrorType };
import type {
	APIErrorOptions,
	CommandExecutionErrorOptions,
	DataSourceHandlingErrorOptions,
	ErrorOptions,
	ExternalServiceErrorOptions,
	FileHandlingErrorOptions,
	LLMErrorOptions,
	LLMRateLimitErrorOptions,
	LLMValidationErrorOptions,
	MCPServerErrorOptions,
	ProjectHandlingErrorOptions,
	ResourceHandlingErrorOptions,
	ToolHandlingErrorOptions,
	VectorSearchErrorOptions,
} from 'api/errors/error.ts';

export { errorMessage, isError } from 'shared/error.ts';

export const createError = (
	errorType: ErrorType,
	message: string,
	options?:
		| ErrorOptions
		| APIErrorOptions
		| LLMErrorOptions
		| LLMRateLimitErrorOptions
		| LLMValidationErrorOptions
		| ProjectHandlingErrorOptions
		| ResourceHandlingErrorOptions
		| DataSourceHandlingErrorOptions
		| FileHandlingErrorOptions
		| ToolHandlingErrorOptions
		| MCPServerErrorOptions
		| VectorSearchErrorOptions
		| ExternalServiceErrorOptions
		| CommandExecutionErrorOptions,
): Error => {
	if (!ErrorTypes.includes(errorType)) {
		throw new Error(`Unknown error type: ${errorType}`);
	}

	switch (errorType) {
		case ErrorType.API:
			return new APIError(message, options as APIErrorOptions);
		case ErrorType.LLM:
			return new LLMError(message, options as LLMErrorOptions);
		case ErrorType.LLMRateLimit:
			return new RateLimitError(message, options as LLMRateLimitErrorOptions);
		case ErrorType.LLMValidation:
			return new ValidationError(message, options as LLMValidationErrorOptions);
		case ErrorType.ProjectHandling:
			return new ProjectHandlingError(message, options as ProjectHandlingErrorOptions);

		case ErrorType.ResourceChange:
			return new ResourceChangeError(message, options as ResourceHandlingErrorOptions);
		case ErrorType.ResourceNotFound:
			return new ResourceNotFoundError(message, options as ResourceHandlingErrorOptions);
		case ErrorType.ResourceRead:
			return new ResourceReadError(message, options as ResourceHandlingErrorOptions);
		case ErrorType.ResourceWrite:
			return new ResourceWriteError(message, options as ResourceHandlingErrorOptions);
		case ErrorType.ResourceMove:
			return new ResourceMoveError(message, options as ResourceHandlingErrorOptions);
		//case ErrorType.ResourceHandling:
		//	return new ResourceHandlingError(message, options as ResourceHandlingErrorOptions);
		case ErrorType.ResourceHandling: {
			const fileOptions = options as ResourceHandlingErrorOptions;
			switch (fileOptions.operation) {
				case 'change':
					return new ResourceChangeError(message, fileOptions);
				case 'read':
					return fileOptions.filePath
						? new ResourceNotFoundError(message, fileOptions)
						: new ResourceReadError(message, fileOptions);
				case 'write':
					return new ResourceWriteError(message, fileOptions);
				case 'move':
					return new ResourceMoveError(message, fileOptions);
				default:
					return new ResourceHandlingError(message, fileOptions);
			}
		}

		case ErrorType.DataSourceHandling:
			return new DataSourceHandlingError(message, options as DataSourceHandlingErrorOptions);

		case ErrorType.FileChange:
			return new FileChangeError(message, options as FileHandlingErrorOptions);
		case ErrorType.FileNotFound:
			return new FileNotFoundError(message, options as FileHandlingErrorOptions);
		case ErrorType.FileRead:
			return new FileReadError(message, options as FileHandlingErrorOptions);
		case ErrorType.FileWrite:
			return new FileWriteError(message, options as FileHandlingErrorOptions);
		case ErrorType.FileMove:
			return new FileMoveError(message, options as FileHandlingErrorOptions);
		case ErrorType.FileHandling: {
			const fileOptions = options as FileHandlingErrorOptions;
			switch (fileOptions.operation) {
				case 'change':
					return new FileChangeError(message, fileOptions);
				case 'read':
					return fileOptions.filePath
						? new FileNotFoundError(message, fileOptions)
						: new FileReadError(message, fileOptions);
				case 'write':
					return new FileWriteError(message, fileOptions);
				case 'move':
					return new FileMoveError(message, fileOptions);
				default:
					return new FileHandlingError(message, fileOptions);
			}
		}
		case ErrorType.ToolHandling:
			return new ToolHandlingError(message, options as ToolHandlingErrorOptions);
		case ErrorType.MCPServer:
			return new MCPServerError(message, options as MCPServerErrorOptions);
		case ErrorType.VectorSearch:
			return new VectorSearchError(message, options as VectorSearchErrorOptions);
		case ErrorType.CommandExecution:
			return new Error(message); // You might want to create a specific CommandExecutionError class
		case ErrorType.ExternalServiceError:
			return new ExternalServiceError(message, options as ExternalServiceErrorOptions);
		default:
			return new Error(`Unknown error type: ${errorType} - ${message}`);
	}
};

// these `throw...` utilty functions add another layer to the stack trace.
// Best to call `createError` yourself and throw that.

/**
 * Throws APIError with provided message and options
 * @param message
 * @param options
 * @throws Error Throws Error
 */
export const throwAPIError = (
	message: string,
	options?: APIErrorOptions,
): Error => {
	// [TODO] validate options, or at very least set default/required values
	throw createError(ErrorType.API, message, options);
};

/**
 * Throws LLMError with provided message and options
 * @param message
 * @param options
 * @throws Error Throws Error
 */
export const throwLLMError = (
	message: string,
	options?: LLMErrorOptions,
): Error => {
	throw createError(ErrorType.LLM, message, options);
};

/**
 * Throws Error with provided message and options
 * @param errorType: ErrorType
 * @param message: string
 * @param options: ErrorOptions
 * @throws Error Throws Error
 */
export const throwError = (
	errorType: ErrorType,
	message: string,
	options?: ErrorOptions,
): Error => {
	throw createError(errorType, message, options);
};
