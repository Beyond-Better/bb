import type { LLMToolConfig } from 'api/llms/llmTool.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolRemoveResourcesConfig extends LLMToolConfig {
	/**
	 * When true, resources are permanently deleted instead of moved to trash.
	 * Requires explicit acknowledgement with resource list verification.
	 * @default false
	 */
	dangerouslyDeletePermanently?: boolean;

	/**
	 * Directory where resources are moved when "deleted" (unless permanent delete is enabled).
	 * This directory is protected and cannot itself be deleted.
	 * @default '.trash'
	 */
	trashDir?: string;

	/**
	 * Maximum number of resources that can be deleted in a single operation.
	 * Helps prevent accidental bulk deletions.
	 * @default 50
	 */
	maxResourcesPerOperation?: number;

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

export interface RemoveResourcesAcknowledgement {
	/**
	 * Total number of items to be permanently deleted.
	 * Must match exactly the number of items in the resources array.
	 */
	resourceCount: number;

	/**
	 * Complete list of resources to be permanently deleted.
	 * Must match exactly the resources provided in the sources parameter.
	 */
	resources: string[];

	/**
	 * Whether any of the items are directories.
	 * When true, requires acknowledgement that includes "and all contents".
	 */
	hasDirectories: boolean;

	/**
	 * Explicit acknowledgement of permanent deletion.
	 * For resources only:
	 *   "I confirm permanent deletion of {resourceCount} resources with no recovery possible"
	 * When directories are included:
	 *   "I confirm permanent deletion of {resourceCount} resources and all contents with no recovery possible"
	 */
	acknowledgement: string;
}

export interface LLMToolRemoveResourcesInput {
	dataSourceId?: string;
	/**
	 * Array of resource paths to remove, relative to project root.
	 * All paths must exist and be within the project directory.
	 * For directories, all contents will be removed recursively.
	 */
	sources: string[];

	/**
	 * Required when dangerouslyDeletePermanently is true.
	 * Must include exact count and list matching sources.
	 * Must explicitly acknowledge directory deletion if any sources are directories.
	 */
	acknowledgement?: RemoveResourcesAcknowledgement;
}

export interface LLMToolRemoveResourcesResponseData {
	data: {
		/**
		 * List of resources successfully removed (either to trash or permanently)
		 */
		resourcesRemoved: Array<{
			name: string;
			isDirectory: boolean;
			destination?: string; // Path in trash if not permanently deleted
		}>;

		/**
		 * List of resources that failed to be removed
		 */
		resourcesError: Array<{
			name: string;
			error: string;
		}>;

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolRemoveResourcesResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: LLMToolRemoveResourcesResponseData;
}
