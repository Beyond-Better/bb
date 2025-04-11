import {
	DefaultModels,
	//MCPServerConfig,
	ProjectConfig,
	ProjectType,
	RepoInfoConfigSchema,
} from 'shared/config/types.ts';
import type { DataSource, DataSourceAccessMethod, DataSourceType, DataSourceValues } from 'api/resources/dataSource.ts';
import type { DataSourceTypeInfo } from 'api/resources/dataSourceRegistry.ts';

export type ProjectStatus = 'draft' | 'active' | 'archived';

export interface ProjectStats {
	conversationCount: number;
	totalTokens: number;
	lastAccessed: string;
}

/**
 * Project data interface
 * Represents the in-memory structure of a ProjectPersistence instance
 * Contains the intrinsic properties of a project (what the project IS)
 */
export interface ProjectData {
	projectId: string;
	name: string;
	status: ProjectStatus;
	dataSourceTypes?: DataSourceTypeInfo[];
	dataSources: DataSource[];
	primaryDataSource?: DataSource; // The primary data source, if any (computed value)
	repoInfo: RepoInfoConfigSchema;
	mcpServers: string[];
	stats?: ProjectStats;
}

export interface CreateProjectData {
	name: string;
	status?: ProjectStatus;
	dataSources: DataSourceValues[]; // DataSource[];
	repoInfo?: RepoInfoConfigSchema;
	mcpServers?: string[];
	anthropicApiKey?: string;
	myPersonsName?: string;
	myAssistantsName?: string;
	llmGuidelinesFile?: string;
	defaultModels?: DefaultModels;
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
	projectId: string;
	name: string;
	status: ProjectStatus;
	dataSources: DataSourceValues[];
	repoInfo: RepoInfoConfigSchema;
	mcpServers: string[];
	stats?: ProjectStats;
	// Additional serializable properties
}

/**
 * Client-side data source interface
 * Subset of DataSource functionality suitable for client-side code (BUI)
 * Contains only data, no methods
 */
export interface ClientDataSource {
	id: string;
	type: DataSourceType;
	accessMethod: DataSourceAccessMethod;
	name: string;
	enabled: boolean;
	isPrimary: boolean;
	priority: number;
	capabilities: string[];
	description: string;
	config: Record<string, unknown>;
	// Add any other properties needed by UI
}

/**
 * Client-side project data for BUI
 * All data is plain objects, no class instances, but maintains object structure
 */
export interface ClientProjectData {
	projectId: string;
	name: string;
	status: ProjectStatus;
	dataSourceTypes?: DataSourceTypeInfo[];
	dataSources: ClientDataSource[]; // | DataSourceValues[];
	primaryDataSource?: ClientDataSource; // | DataSourceValues;
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

export interface ProjectWithSources
	extends Omit<ProjectConfig, 'version' | 'myPersonsName' | 'myAssistantsName' | 'llmGuidelinesFile' | 'api'> {
	myPersonsName: ConfigValue<string | undefined>;
	myAssistantsName: ConfigValue<string | undefined>;
	llmGuidelinesFile: ConfigValue<string | undefined>;
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
		//primaryDataSourceRoot: projectWithSources.primaryDataSourceRoot,
		//type: projectWithSources.type,
	};
}
