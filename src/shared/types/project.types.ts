import {
	DefaultModels,
	DefaultModelsPartial,
	//MCPServerConfig,
	ProjectConfig,
	ProjectType,
	RepoInfoConfigSchema,
} from 'shared/config/types.ts';
import type {
	DataSourceAccessMethod,
	DataSourceAuth,
	DataSourceCapability,
	DataSourceConfig,
	DataSourceProviderInfo,
	DataSourceProviderType,
} from 'shared/types/dataSource.ts';
import type { ProjectId } from 'shared/types.ts';
import type {
	DataSourceConnection,
	DataSourceConnectionValues,
} from 'api/dataSources/interfaces/dataSourceConnection.ts';

export type ProjectStatus = 'draft' | 'active' | 'archived';

export interface ProjectStats {
	collaborationCount: number;
	totalTokens: number;
	lastAccessed: string;
}

/**
 * Project data interface
 * Represents the in-memory structure of a ProjectPersistence instance
 * Contains the intrinsic properties of a project (what the project IS)
 */
export interface ProjectData {
	projectId: ProjectId;
	name: string;
	status: ProjectStatus;
	dataSourceProviders?: DataSourceProviderInfo[];
	dsConnections: DataSourceConnection[];
	primaryDsConnection?: DataSourceConnection; // The primary data source, if any (computed value)
	//defaultModels: DefaultModelsPartial;
	repoInfo: RepoInfoConfigSchema;
	mcpServers: string[];
	stats?: ProjectStats;
}

export interface CreateProjectData {
	name: string;
	status?: ProjectStatus;
	dsConnections: DataSourceConnectionValues[]; // DataSourceConnection[];
	repoInfo?: RepoInfoConfigSchema;
	mcpServers?: string[];
	anthropicApiKey?: string;
	myPersonsName?: string;
	myAssistantsName?: string;
	llmGuidelinesFile?: string;
	defaultModels?: DefaultModelsPartial;
	useTls?: boolean;
}

/**
 * Serialized project data interface
 * Represents the JSON-serializable version of ProjectData
 * Used for storage and transmission
 */
/**
 * Serialized project data for transmission/storage
 */
export interface SerializedProjectData {
	version?: number; // Project data format version
	projectId: ProjectId;
	name: string;
	status: ProjectStatus;
	dsConnections: DataSourceConnectionValues[];
	//defaultModels: DefaultModelsPartial;
	repoInfo: RepoInfoConfigSchema;
	mcpServers: string[];
	stats?: ProjectStats;
	// Additional serializable properties
}

/**
 * Client-side data source interface
 * Subset of DataSourceConnection functionality suitable for client-side code (BUI)
 * Contains only data, no methods
 */
export interface ClientDataSourceConnection {
	id: string;
	providerType: DataSourceProviderType;
	accessMethod: DataSourceAccessMethod;
	name: string;
	enabled: boolean;
	isPrimary: boolean;
	priority: number;
	capabilities: DataSourceCapability[];
	description: string;
	config: DataSourceConfig;
	auth: DataSourceAuth;
	// Add any other properties needed by UI
}

/**
 * Client-side project data for BUI
 * All data is plain objects, no class instances, but maintains object structure
 */
export interface ClientProjectData {
	projectId: ProjectId;
	name: string;
	status: ProjectStatus;
	dataSourceProviders?: DataSourceProviderInfo[];
	dsConnections: ClientDataSourceConnection[]; // | DataSourceValues[];
	primaryDsConnection?: ClientDataSourceConnection; // | DataSourceValues;
	//defaultModels: DefaultModelsPartial;
	repoInfo: RepoInfoConfigSchema;
	mcpServers?: string[];
	stats?: ProjectStats;
}

// export interface ConfigValue<T> {
// 	value: T;
// 	source: 'global' | 'project';
// }
export interface ConfigValue<T> {
	global: T;
	project: T | null; // undefined means use global value
}

export interface ProjectWithSources extends
	Omit<
		ProjectConfig,
		'version' | 'myPersonsName' | 'myAssistantsName' | 'llmGuidelinesFile' | 'defaultModels' | 'api'
	> {
	myPersonsName: ConfigValue<string | undefined>;
	myAssistantsName: ConfigValue<string | undefined>;
	llmGuidelinesFile: ConfigValue<string | undefined>;
	defaultModels: {
		orchestrator: ConfigValue<string | undefined>;
		agent: ConfigValue<string | undefined>;
		chat: ConfigValue<string | undefined>;
	};
	api: {
		maxTurns: ConfigValue<number | undefined>;
		toolConfigs: ConfigValue<Record<string, unknown> | undefined>;
	};
}

/**
 * Combined interface that includes both project data and config information
 * This provides a single object for all project-related attributes
 */
export interface ProjectWithConfig {
	/** Intrinsic project data - what the project IS */
	data: ProjectData;
	/** Project configuration - how the project behaves */
	config: ProjectConfig;
}

/**
 * Serialized version of ProjectWithConfig
 * Used for storage and transmission
 */
export interface SerializedProjectWithConfig {
	/** Serialized project data */
	data: SerializedProjectData;
	/** Project configuration */
	config: ProjectConfig;
}

/**
 * Client version of ProjectWithConfig
 * Used for transmission with BUI
 */
export interface ClientProjectWithConfig {
	/** Serialized project data */
	data: ClientProjectData;
	/** Project configuration */
	config: ProjectConfig;
}
export interface ClientProjectWithConfigForUpdates {
	/** Serialized project data */
	data: Partial<Omit<ClientProjectData, 'projectId'>>;
	/** Project configuration */
	config: Omit<ProjectConfig, 'projectId'>;
}

/**
 * Client version of ProjectWithSources
 * Used for transmission with BUI
 */
export interface ClientProjectWithConfigSources {
	/** Serialized project data */
	data: ClientProjectData;
	/** Project configuration */
	config: ProjectWithSources;
}

export function toProject(projectWithSources: ProjectWithSources): Omit<ProjectConfig, 'version'> {
	return {
		projectId: projectWithSources.projectId,
		name: projectWithSources.name,
		//primaryDsConnectionRoot: projectWithSources.primaryDsConnectionRoot,
		//type: projectWithSources.type,
	};
}
