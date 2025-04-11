import type { GlobalConfig, ProjectConfig } from 'shared/config/types.ts';
import type {
	ClientProjectData,
	ClientProjectWithConfigSources,
	ConfigValue,
	ProjectData,
	ProjectWithSources,
} from 'shared/types/project.ts';
import type { DataSource } from 'api/resources/dataSource.ts';

/**
 * Helper function to create a config value with source information
 */
export function createConfigValue<T>(
	projectValue: T | undefined,
	globalValue: T | undefined,
): ConfigValue<T | undefined> {
	return {
		global: globalValue,
		project: projectValue,
		//source: projectValue !== undefined ? 'project' : 'global',
	};
}

/**
 * Helper function to enhance a project with source information for config values
 * Returns an object with separated data and config properties
 */
export function enhanceProjectWithSources(
	storedProject: ProjectData | ClientProjectData,
	projectConfig: Partial<ProjectConfig>,
	globalConfig: Partial<GlobalConfig>,
	//primaryDataSourceRoot: string,
): ClientProjectWithConfigSources {
	// Create enhanced config with source information
	const enhancedConfig: ProjectWithSources = {
		projectId: storedProject.projectId,
		name: storedProject.name,
		//primaryDataSourceRoot,
		myPersonsName: createConfigValue(
			projectConfig.myPersonsName,
			globalConfig.myPersonsName,
		),
		myAssistantsName: createConfigValue(
			projectConfig.myAssistantsName,
			globalConfig.myAssistantsName,
		),
		llmGuidelinesFile: createConfigValue(
			projectConfig.llmGuidelinesFile,
			globalConfig.llmGuidelinesFile,
		),
		api: {
			maxTurns: createConfigValue(
				projectConfig.api?.maxTurns,
				globalConfig.api?.maxTurns,
			),
			toolConfigs: createConfigValue(
				projectConfig.api?.toolConfigs,
				globalConfig.api?.toolConfigs,
			),
			//mcpServers: createConfigValue(
			//	projectConfig.api?.mcpServers,
			//	globalConfig.api?.mcpServers,
			//),
		},
	};

	// Return separated data and config
	return {
		data: storedProject,
		config: enhancedConfig,
	};
}

/**
 * Generate a unique project or DataSource ID
 */
export function generateId(): string {
	// Generate a unique 12-character hex ID
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isProjectValid(project: ProjectData): boolean {
	// Check if project has at least one data source
	if (!project.dataSources || project.dataSources.length === 0) {
		return false;
	}

	// Additional validation rules can be added here
	// For example, validate that at least one data source is primary
	const hasPrimaryDataSource = project.dataSources.some((ds: DataSource) => ds.isPrimary);
	if (!hasPrimaryDataSource) {
		return false;
	}

	return true;
}
