import type { LLMProvider } from 'api/types.ts';
import type { ConversationId } from 'shared/types.ts';
export type { ErrorObject as AjvErrorObject } from 'ajv';
import { Status } from '@oak/oak';

export enum ErrorType {
	CommandExecution = 'CommandExecution',
	Persistence = 'PersistenceError',
	API = 'APIError',
	LLM = 'LLMError',
	LLMRateLimit = 'RateLimitError',
	LLMValidation = 'ValidationError',
	ToolHandling = 'ToolHandlingError',
	FileHandling = 'FileHandlingError',
	VectorSearch = 'VectorSearchError',
	TokenUsageValidation = 'TokenUsageValidationError',
}
export const ErrorTypes = [
	ErrorType.API,
	ErrorType.Persistence,
	ErrorType.LLM,
	ErrorType.LLMRateLimit,
	ErrorType.LLMValidation,
	ErrorType.ToolHandling,
	ErrorType.FileHandling,
	ErrorType.VectorSearch,
	ErrorType.TokenUsageValidation,
];

export interface CommandExecutionErrorOptions extends ErrorOptions {
	command: string;
	args?: string[];
}

export interface ErrorOptions {
	name: string;
}

export interface APIErrorOptions extends ErrorOptions {
	status?: Status;
	path?: string;
	args?: object;
	expose?: boolean;
}

export interface LLMErrorOptions extends ErrorOptions {
	provider: LLMProvider;
	model?: string;
	pipeline?: string;
	args?: object;
	conversationId: ConversationId;
}

export interface LLMRateLimitErrorOptions extends LLMErrorOptions {
	token_usage?: number;
	token_limit?: number;
	request_usage?: number;
	request_limit?: number;
}

export interface LLMValidationErrorOptions extends LLMErrorOptions {
	validation_type?: string;
	validation_error?: string;
	original_prompt?: string;
	replacement_prompt?: string;
}

export interface TokenUsageValidationErrorOptions extends ErrorOptions {
	field?: string;
	value?: unknown;
	constraint?: string;
}

export class APIError extends Error {
	public status: Status;
	constructor(
		message: string,
		public options?: APIErrorOptions,
	) {
		super(message);
		this.name = ErrorType.API;
		this.status = options?.status ?? Status.InternalServerError;
		this.options = options;
	}
}
export const isAPIError = (value: unknown): value is APIError => {
	return value instanceof APIError;
};

export class LLMError extends Error {
	constructor(
		message: string,
		public options?: LLMErrorOptions,
	) {
		super(message);
		//this.type = ErrorType.LLM;
		this.options = options;
	}
}
export const isLLMError = (value: unknown): value is LLMError => {
	return value instanceof LLMError;
};

export class RateLimitError extends LLMError {
	constructor(
		message: string,
		public options?: LLMRateLimitErrorOptions,
	) {
		super(message);
		//this.type = ErrorType.LLMRateLimit;
	}
}
export const isRateLimitError = (value: unknown): value is RateLimitError => {
	return value instanceof RateLimitError;
};

export class ValidationError extends LLMError {
	constructor(
		message: string,
		public options?: LLMValidationErrorOptions,
	) {
		super(message);
		//this.type = ErrorType.LLMValidation;
	}
}
export const isValidationError = (value: unknown): value is ValidationError => {
	return value instanceof ValidationError;
};

export class TokenUsageValidationError extends Error {
	constructor(
		message: string,
		public options: TokenUsageValidationErrorOptions,
	) {
		super(message);
		this.name = ErrorType.TokenUsageValidation;
	}
}

export const isTokenUsageValidationError = (value: unknown): value is TokenUsageValidationError => {
	return value instanceof TokenUsageValidationError;
};

export interface FileHandlingErrorOptions extends ErrorOptions {
	filePath: string;
	operation:
		| 'read'
		| 'write'
		| 'delete'
		| 'move'
		| 'change'
		| 'search-project'
		| 'apply-patch'
		| 'search-replace'
		| 'rewrite-file'
		| 'move-file'
		// these are not really filehandling (filesystem) - they only affect files in the conversation
		| 'request-files'
		| 'forget-files';
}

export class FileHandlingError extends Error {
	constructor(
		message: string,
		public options: FileHandlingErrorOptions,
	) {
		super(message);
		this.name = ErrorType.FileHandling;
	}
}

export const isFileHandlingError = (value: unknown): value is FileHandlingError => {
	return value instanceof FileHandlingError;
};

export class FileChangeError extends FileHandlingError {
	constructor(message: string, options: FileHandlingErrorOptions) {
		super(message, { ...options, operation: 'change' });
		this.name = 'FileChangeError';
	}
}

export class FileNotFoundError extends FileHandlingError {
	constructor(message: string, options: FileHandlingErrorOptions) {
		super(message, { ...options, operation: 'read' });
		this.name = 'FileNotFoundError';
	}
}

export class FileReadError extends FileHandlingError {
	constructor(message: string, options: FileHandlingErrorOptions) {
		super(message, { ...options, operation: 'read' });
		this.name = 'FileReadError';
	}
}

export class FileWriteError extends FileHandlingError {
	constructor(message: string, options: FileHandlingErrorOptions) {
		super(message, { ...options, operation: 'write' });
		this.name = 'FileWriteError';
	}
}

export class FileMoveError extends FileHandlingError {
	constructor(message: string, options: FileHandlingErrorOptions) {
		super(message, { ...options, operation: 'move' });
		this.name = 'FileMoveError';
	}
}

export interface VectorSearchErrorOptions extends ErrorOptions {
	query: string;
	operation: 'index' | 'search' | 'delete';
}

export class VectorSearchError extends Error {
	constructor(
		message: string,
		public options: VectorSearchErrorOptions,
	) {
		super(message);
		this.name = ErrorType.VectorSearch;
	}
}

export const isVectorSearchError = (value: unknown): value is VectorSearchError => {
	return value instanceof VectorSearchError;
};

export interface ToolHandlingErrorOptions extends ErrorOptions {
	toolName: string;
	operation: 'tool-run' | 'tool-input' | 'formatting';
}

export class ToolHandlingError extends Error {
	constructor(
		message: string,
		public options: ToolHandlingErrorOptions,
	) {
		super(message);
		this.name = ErrorType.ToolHandling;
	}
}

export const isToolHandlingError = (value: unknown): value is ToolHandlingError => {
	return value instanceof ToolHandlingError;
};

export interface PersistenceErrorOptions extends ErrorOptions {
	filePath: string;
	operation: 'read' | 'write' | 'append';
}

export class PersistenceError extends Error {
	constructor(
		message: string,
		public options: PersistenceErrorOptions,
	) {
		super(message);
		this.name = ErrorType.Persistence;
	}
}

export const isPersistenceError = (value: unknown): value is PersistenceError => {
	return value instanceof PersistenceError;
};
