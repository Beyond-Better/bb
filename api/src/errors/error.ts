import type { BBLLMResponse, LLMProvider } from 'api/types.ts';
import type { CollaborationId, InteractionId } from 'shared/types.ts';
export type { ErrorObject as AjvErrorObject } from 'ajv';
import { Status } from '@oak/oak';
export { isError } from 'shared/error.ts';

export enum ErrorType {
	CommandExecution = 'CommandExecution',
	Persistence = 'PersistenceError',
	API = 'APIError',
	LLM = 'LLMError',
	LLMRateLimit = 'RateLimitError',
	LLMValidation = 'ValidationError',
	ToolHandling = 'ToolHandlingError',
	ProjectHandling = 'ProjectHandlingError',
	DataSourceHandling = 'DataSourceHandlingError',
	FileHandling = 'FileHandlingError',
	FileChange = 'FileChangeError',
	FileNotFound = 'FileNotFoundError',
	FileRead = 'FileReadError',
	FileWrite = 'FileWriteError',
	FileMove = 'FileMoveError',

	ResourceHandling = 'ResourceHandlingError',
	ResourceChange = 'ResourceChangeError',
	ResourceNotFound = 'ResourceNotFoundError',
	ResourceRead = 'ResourceReadError',
	ResourceWrite = 'ResourceWriteError',
	ResourceMove = 'ResourceMoveError',

	VectorSearch = 'VectorSearchError',
	TokenUsageValidation = 'TokenUsageValidationError',
	ExternalServiceError = 'ExternalServiceError',
}
export const ErrorTypes = [
	ErrorType.API,
	ErrorType.Persistence,
	ErrorType.LLM,
	ErrorType.LLMRateLimit,
	ErrorType.LLMValidation,
	ErrorType.ToolHandling,
	ErrorType.ProjectHandling,
	ErrorType.DataSourceHandling,

	ErrorType.FileHandling,
	ErrorType.FileChange,
	ErrorType.FileNotFound,
	ErrorType.FileRead,
	ErrorType.FileWrite,
	ErrorType.FileMove,

	ErrorType.ResourceHandling,
	ErrorType.ResourceChange,
	ErrorType.ResourceNotFound,
	ErrorType.ResourceRead,
	ErrorType.ResourceWrite,
	ErrorType.ResourceMove,

	ErrorType.VectorSearch,
	ErrorType.TokenUsageValidation,
	ErrorType.ExternalServiceError,
];

export interface CommandExecutionErrorOptions extends ErrorOptions {
	command: string;
	args?: string[];
	cwd?: string;
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
	args?: {
		status?: number;
		retries?: { max: number; current: number };
		reason?: string;
		error?: {
			type: string;
			message: string;
			details?: Record<string, unknown>;
		};
		bbResponse?: BBLLMResponse;
	};
	collaborationId?: CollaborationId;
	interactionId?: InteractionId;
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
		public override options?: LLMRateLimitErrorOptions,
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
		public override options?: LLMValidationErrorOptions,
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

export interface ProjectHandlingErrorOptions extends ErrorOptions {
	projectId?: string;
	dataSourceRoot?: string;
	projectType?: string;
}

export class ProjectHandlingError extends Error {
	constructor(
		message: string,
		public options: ProjectHandlingErrorOptions,
	) {
		super(message);
		this.name = ErrorType.ProjectHandling;
	}
}
export const isProjectHandlingError = (value: unknown): value is ProjectHandlingError => {
	return value instanceof ProjectHandlingError;
};

export interface DataSourceHandlingErrorOptions extends ErrorOptions {
	dataSourceIds?: string[];
}

export class DataSourceHandlingError extends Error {
	constructor(
		message: string,
		public options: DataSourceHandlingErrorOptions,
	) {
		super(message);
		this.name = ErrorType.DataSourceHandling;
	}
}
export const isDataSourceHandlingError = (value: unknown): value is DataSourceHandlingError => {
	return value instanceof DataSourceHandlingError;
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
		| 'create-dir'
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

export const isFileChangeError = (value: unknown): value is FileChangeError => {
	return value instanceof FileChangeError;
};
export const isFileNotFoundError = (value: unknown): value is FileNotFoundError => {
	return value instanceof FileNotFoundError;
};
export const isFileReadError = (value: unknown): value is FileReadError => {
	return value instanceof FileReadError;
};
export const isFileWriteError = (value: unknown): value is FileWriteError => {
	return value instanceof FileWriteError;
};
export const isFileMoveError = (value: unknown): value is FileMoveError => {
	return value instanceof FileMoveError;
};

export interface ResourceHandlingErrorOptions extends ErrorOptions {
	filePath: string;
	operation:
		| 'read'
		| 'write'
		| 'delete'
		| 'move'
		| 'rename'
		| 'change'
		| 'search-resources'
		| 'apply-patch'
		| 'search-replace'
		| 'rewrite-resource'
		| 'block-edit'
		//| 'move-resource'
		| 'create-dir'
		// these are not really resourceHandling (datasource) - they only affect files in the conversation
		| 'request-resources'
		| 'forget-resources';
}

export class ResourceHandlingError extends Error {
	constructor(
		message: string,
		public options: ResourceHandlingErrorOptions,
	) {
		super(message);
		this.name = ErrorType.ResourceHandling;
	}
}

export const isResourceHandlingError = (value: unknown): value is ResourceHandlingError => {
	return value instanceof ResourceHandlingError;
};

export class ResourceChangeError extends ResourceHandlingError {
	constructor(message: string, options: ResourceHandlingErrorOptions) {
		super(message, { ...options, operation: 'change' });
		this.name = 'ResourceChangeError';
	}
}

export class ResourceNotFoundError extends ResourceHandlingError {
	constructor(message: string, options: ResourceHandlingErrorOptions) {
		super(message, { ...options, operation: 'read' });
		this.name = 'ResourceNotFoundError';
	}
}

export class ResourceReadError extends ResourceHandlingError {
	constructor(message: string, options: ResourceHandlingErrorOptions) {
		super(message, { ...options, operation: 'read' });
		this.name = 'ResourceReadError';
	}
}

export class ResourceWriteError extends ResourceHandlingError {
	constructor(message: string, options: ResourceHandlingErrorOptions) {
		super(message, { ...options, operation: 'write' });
		this.name = 'ResourceWriteError';
	}
}

export class ResourceMoveError extends ResourceHandlingError {
	constructor(message: string, options: ResourceHandlingErrorOptions) {
		super(message, { ...options, operation: 'move' });
		this.name = 'ResourceMoveError';
	}
}

export const isResourceChangeError = (value: unknown): value is ResourceChangeError => {
	return value instanceof ResourceChangeError;
};
export const isResourceNotFoundError = (value: unknown): value is ResourceNotFoundError => {
	return value instanceof ResourceNotFoundError;
};
export const isResourceReadError = (value: unknown): value is ResourceReadError => {
	return value instanceof ResourceReadError;
};
export const isResourceWriteError = (value: unknown): value is ResourceWriteError => {
	return value instanceof ResourceWriteError;
};
export const isResourceMoveError = (value: unknown): value is ResourceMoveError => {
	return value instanceof ResourceMoveError;
};

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
	operation: 'tool-run' | 'tool-input' | 'formatting' | 'capability-check' | 'interface-check';
	toolInput?: Record<string, unknown>;
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
	filePath?: string;
	operation: 'read' | 'write' | 'append' | 'validate';
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

export interface ExternalServiceErrorOptions extends ErrorOptions {
	service: string;
	action?: string;
	serverId?: string;
	toolName?: string;
	resourceUri?: string;
	server?: string;
}

export class ExternalServiceError extends Error {
	constructor(
		message: string,
		public options: ExternalServiceErrorOptions,
	) {
		super(message);
		this.name = ErrorType.ExternalServiceError;
	}
}

export const isExternalServiceError = (value: unknown): value is ExternalServiceError => {
	return value instanceof ExternalServiceError;
};
