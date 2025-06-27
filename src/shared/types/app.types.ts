// the interfaces in this file should replace GlobalConfig & related interfaces in shared/config/types.ts
// but it's not a trivial task

import type { ApiConfig, BuiConfig, CliConfig, ConfigVersion, DefaultModels, DuiConfig } from 'shared/config/types.ts';
import type { ProjectId } from 'shared/types.ts';

/**
 * Base application configuration interface
 * Contains settings that define how the application behaves
 */
export interface AppConfig {
	version: ConfigVersion;
	myPersonsName: string;
	myAssistantsName: string;
	defaultModels: DefaultModels;
	noBrowser: boolean;
	llmGuidelinesFile?: string;

	// Component-specific configurations
	api: ApiConfig;
	bui: BuiConfig;
	cli: CliConfig;
	dui: DuiConfig;
}

/**
 * Global application configuration
 * Extends the base AppConfig with global-only settings
 */
export interface GlobalConfig extends AppConfig {
	bbExeName: string;
	bbApiExeName: string;
}

/**
 * Project-specific application configuration overrides
 * Extends AppConfig with projectId
 */
export interface ProjectConfig extends AppConfig {
	projectId: ProjectId;
}
