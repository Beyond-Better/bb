import type { LLMToolConfig } from 'api/llms/llmTool.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolRemoveFilesConfig extends LLMToolConfig {
	/**
	 * When true, files are permanently deleted instead of moved to trash.
	 * Requires explicit acknowledgement with file list verification.
	 * @default false
	 */
	dangerouslyDeletePermanently?: boolean;

	/**
	 * Directory where files are moved when "deleted" (unless permanent delete is enabled).
	 * This directory is protected and cannot itself be deleted.
	 * @default '.trash'
	 */
	trashDir?: string;

	/**
	 * Maximum number of files that can be deleted in a single operation.
	 * Helps prevent accidental bulk deletions.
	 * @default 50
	 */
	maxFilesPerOperation?: number;

	/**
	 * Additional paths to protect from deletion beyond the hardcoded ones (.trash, .git).
	 * @default ['node_modules']
	 */
	protectedPaths?: string[];

	/**
	 * Strategy for handling name collisions in trash directory.
	 * - timestamp: Append date/time (YYYYMMDD_HHMMSS)
	 * - increment: Append incrementing number (_1, _2, etc.)
	 * @default 'increment'
	 */
	trashNamingStrategy?: 'timestamp' | 'increment';
}

export interface RemoveFilesAcknowledgement {
	/**
	 * Total number of items to be permanently deleted.
	 * Must match exactly the number of items in the files array.
	 */
	fileCount: number;

	/**
	 * Complete list of files/directories to be permanently deleted.
	 * Must match exactly the files provided in the sources parameter.
	 */
	files: string[];

	/**
	 * Whether any of the items are directories.
	 * When true, requires acknowledgement that includes "and all contents".
	 */
	hasDirectories: boolean;

	/**
	 * Explicit acknowledgement of permanent deletion.
	 * For files only:
	 *   "I confirm permanent deletion of {fileCount} files with no recovery possible"
	 * When directories are included:
	 *   "I confirm permanent deletion of {fileCount} files/directories and all contents with no recovery possible"
	 */
	acknowledgement: string;
}

export interface LLMToolRemoveFilesInput {
	/**
	 * Array of file/directory paths to remove, relative to project root.
	 * All paths must exist and be within the project directory.
	 * For directories, all contents will be removed recursively.
	 */
	sources: string[];

	/**
	 * Required when dangerouslyDeletePermanently is true.
	 * Must include exact count and list matching sources.
	 * Must explicitly acknowledge directory deletion if any sources are directories.
	 */
	acknowledgement?: RemoveFilesAcknowledgement;
}

export interface LLMToolRemoveFilesResponseData {
	data: {
		/**
		 * List of files/directories successfully removed (either to trash or permanently)
		 */
		filesRemoved: Array<{
			name: string;
			isDirectory: boolean;
			destination?: string; // Path in trash if not permanently deleted
		}>;

		/**
		 * List of files/directories that failed to be removed
		 */
		filesError: Array<{
			name: string;
			error: string;
		}>;
	};
}

export interface LLMToolRemoveFilesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolRemoveFilesResponseData;
}
