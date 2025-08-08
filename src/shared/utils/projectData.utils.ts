import type { GlobalConfig, ProjectConfig } from 'shared/config/types.ts';
import type {
	ClientProjectData,
	ClientProjectWithConfigSources,
	ConfigValue,
	ProjectData,
	ProjectWithSources,
} from 'shared/types/project.ts';
import type {
	DataSourceConnection,
	DataSourceConnectionValues,
} from 'api/dataSources/interfaces/dataSourceConnection.ts';

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
	//primaryDsConnectionRoot: string,
): ClientProjectWithConfigSources {
	// Create enhanced config with source information
	const enhancedConfig: ProjectWithSources = {
		projectId: storedProject.projectId,
		name: storedProject.name,
		//primaryDsConnectionRoot,
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
		defaultModels: {
			orchestrator: createConfigValue(
				projectConfig.defaultModels?.orchestrator,
				globalConfig.defaultModels?.orchestrator,
			),
			agent: createConfigValue(
				projectConfig.defaultModels?.agent,
				globalConfig.defaultModels?.agent,
			),
			chat: createConfigValue(
				projectConfig.defaultModels?.chat,
				globalConfig.defaultModels?.chat,
			),
		},
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
		data: storedProject as ClientProjectData,
		config: enhancedConfig,
	};
}

/**
 * Generate a unique project or DsConnection ID
 */
export function generateId(): string {
	// Generate a unique 12-character hex ID
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isProjectValid(project: ProjectData): boolean {
	// Check if project has at least one data source
	if (!project.dsConnections || project.dsConnections.length === 0) {
		return false;
	}

	// Additional validation rules can be added here
	// For example, validate that at least one data source is primary
	const hasPrimaryDsConnection = project.dsConnections.some((ds: DataSourceConnectionValues) => ds.isPrimary);
	if (!hasPrimaryDsConnection) {
		return false;
	}

	return true;
}
