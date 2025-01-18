/**
 * Configuration system version 2.0.0
 *
 * This module defines the type system for BB's configuration management.
 * It includes definitions for global and project-specific configurations,
 * as well as component-specific settings for API, BUI, CLI, and DUI.
 */

// Version Management
const CONFIG_VERSIONS = ['1.0.0', '2.0.0'] as const;
/** Supported configuration versions */
export type ConfigVersion = typeof CONFIG_VERSIONS[number];

/** Type of project - local directory or git repository */
export type ProjectType = 'local' | 'git' | 'gdrive' | 'notion';

/** Available log levels for configuration
 * debug and debug0 are equivalent
 */

export type LogLevel = 'debug' | 'debug0' | 'debug1' | 'debug2' | 'info' | 'warn' | 'error';

export interface DefaultModels {
	orchestrator: string;
	agent: string;
	chat: string;
}

export interface CreateProjectData {
	// 	project: {
	// 		name: string;
	// 		type: ProjectType;
	// 	};
	name: string;
	type: ProjectType;
	path: string;
	anthropicApiKey?: string;
	myPersonsName?: string;
	myAssistantsName?: string;
	llmGuidelinesFile?: string;
	defaultModels?: DefaultModels;
	useTls?: boolean;
}

// Core Configuration Types
/**
 * TLS configuration settings shared across components.
 * Used by both API and BUI servers.
 */
export interface TlsConfig {
	useTls: boolean;
	keyFile?: string;
	certFile?: string;
	rootCaFile?: string;
	keyPem?: string;
	certPem?: string;
	rootCaPem?: string;
}

/**
 * Base server configuration shared by API and BUI.
 * Provides common settings for network services.
 */
export interface ServerConfig {
	environment?: string;
	hostname: string;
	port: number;
	tls: TlsConfig;
}

// Component Configurations
/**
 * API server configuration.
 * Extends base server config with API-specific settings including:
 * - LLM integration settings
 * - Logging configuration
 * - Tool management
 * - Cache control
 */
export interface ApiConfig extends ServerConfig {
	maxTurns: number;
	logLevel: LogLevel;
	logFile?: string;
	logFileHydration: boolean;
	ignoreLLMRequestCache: boolean;
	usePromptCaching: boolean;
	userToolDirectories: string[];
	toolConfigs: Record<string, unknown>;
	localMode?: boolean;
	supabaseConfigUrl?: string;

	// LLM Keys
	llmKeys?: {
		anthropic?: string;
		openai?: string;
		voyageai?: string;
	};
}

/**
 * Browser User Interface configuration.
 * Extends base server config with BUI-specific settings.
 */
export interface BuiConfig extends ServerConfig {
	supabaseUrl?: string;
	supabaseAnonKey?: string;
	localMode?: boolean;
	kvSessionPath?: string;
}

/**
 * Desktop User Interface configuration.
 * Manages DUI-specific settings including:
 * - Default API configuration
 * - Project management settings
 */
export interface DuiConfig {
	environment?: string;
	defaultApiConfig: Partial<ApiConfig>;
	projectsDirectory: string;
	recentProjects: number;
}

/**
 * Command Line Interface configuration.
 * Manages CLI-specific settings including:
 * - Editor preferences
 * - History management
 */
export interface CliConfig {
	environment?: string;
	defaultEditor?: string;
	historySize: number;
}

/**
 * Global configuration for the entire BB system.
 * Contains:
 * - Core system settings
 * - Component configurations (API, BUI, CLI, DUI)
 * - User preferences
 *
 * This is stored in the user's global config directory.
 */
export interface GlobalConfig {
	version: ConfigVersion;
	myPersonsName: string;
	myAssistantsName: string;
	llmGuidelinesFile?: string;
	defaultModels: DefaultModels;
	noBrowser: boolean;
	api: ApiConfig;
	bui: BuiConfig;
	cli: CliConfig;
	dui: DuiConfig;
	bbExeName: string;
	bbApiExeName: string;
}

export interface RepoInfoConfigSchema {
	ctagsAutoGenerate?: boolean;
	ctagsFilePath?: string;
	tokenLimit: number;
}

/**
 * Project-specific configuration.
 * Contains:
 * - Project identity and metadata
 * - Component-specific overrides
 * - Project-specific settings
 *
 * This is stored in the project's .bb/config.yaml file.
 */
export interface ProjectConfig {
	projectId: string;
	version: ConfigVersion;
	name: string;
	type: ProjectType;
	myPersonsName?: string;
	myAssistantsName?: string;
	defaultModels?: DefaultModels;
	llmGuidelinesFile?: string;
	repoInfo: RepoInfoConfigSchema;
	useProjectApi?: boolean;
	settings: {
		api?: Partial<ApiConfig>;
		bui?: Partial<BuiConfig>;
		cli?: Partial<CliConfig>;
		dui?: Partial<DuiConfig>;
	};
}

/**
 * Result of a configuration migration operation.
 * Tracks:
 * - Success/failure status
 * - Version information
 * - Backup location
 * - Specific changes made
 * - Any errors encountered
 */
export interface MigrationResult {
	success: boolean;
	version: {
		from: string;
		to: string;
	};
	backupPath?: string;
	changes: Array<{
		path: string[];
		from: unknown;
		to: unknown;
	}>;
	errors: Array<{
		path: string[];
		message: string;
	}>;
	config?: ProjectConfig | GlobalConfig;
}

/**
 * Result of a configuration validation operation.
 * Contains:
 * - Overall validation status
 * - Detailed error information
 * - Invalid values for debugging
 */
export interface ValidationResult {
	isValid: boolean;
	errors: Array<{
		path: string[];
		message: string;
		value?: unknown;
	}>;
}

/**
 * Configuration management system interface.
 * Provides access to global and project-specific configurations,
 * handles migrations, and manages configuration validation.
 */
export interface IConfigManagerV2 {
	// Core configuration operations
	getGlobalConfig(): Promise<GlobalConfig>;
	getProjectConfig(projectId: string): Promise<ProjectConfig>;
	updateGlobalConfig(updates: Partial<GlobalConfig>): Promise<void>;
	updateProjectConfig(projectId: string, updates: Partial<ProjectConfig>): Promise<void>;

	// Tool configuration
	getToolConfig(toolName: string): Promise<unknown>;
	updateToolConfig(toolName: string, config: unknown): Promise<void>;

	// Project management
	createProject(createProjectData: CreateProjectData): Promise<string>;
	listProjects(): Promise<Array<{ id: string; name: string; type: ProjectType }>>;
	archiveProject(projectId: string): Promise<void>;

	// Migration and validation
	migrateConfig(config: unknown): Promise<MigrationResult>;
	validateConfig(config: unknown): Promise<ValidationResult>;
}

// Default configurations
export const ApiConfigDefaults: Readonly<Omit<ApiConfig, 'llmKeys'>> = {
	hostname: 'localhost',
	port: 3162,
	tls: {
		useTls: false,
	},
	maxTurns: 25,
	logLevel: 'info',
	logFileHydration: false,
	localMode: false,
	supabaseConfigUrl: 'https://www.beyondbetter.dev/api/v1/config/supabase',
	ignoreLLMRequestCache: false,
	usePromptCaching: true,
	userToolDirectories: ['./tools'],
	toolConfigs: {},
	//llmKeys: {},
};

export const BuiConfigDefaults: Readonly<BuiConfig> = {
	hostname: 'localhost',
	port: 8000,
	tls: {
		useTls: true,
	},
	localMode: false,
	kvSessionPath: 'auth.kv',
};

export const DuiConfigDefaults: Readonly<DuiConfig> = {
	defaultApiConfig: {},
	projectsDirectory: './projects',
	recentProjects: 5,
};

export const CliConfigDefaults: Readonly<CliConfig> = {
	historySize: 1000,
};

//export const ProjectConfigDefaults: Readonly<Omit<ProjectConfig, 'version' | 'projectId' | 'name'>> = {
export const ProjectConfigDefaults: Readonly<ProjectConfig> = {
	projectId: '',
	name: '',
	version: '2.0.0',
	type: 'local',
	repoInfo: { tokenLimit: 1024 },
	useProjectApi: false,
	settings: {
		api: ApiConfigDefaults,
		bui: BuiConfigDefaults,
		cli: CliConfigDefaults,
		dui: DuiConfigDefaults,
	},
};

//export const GlobalConfigDefaults: Readonly<Omit<GlobalConfig, 'version' | 'bbExeName' | 'bbApiExeName'>> = {
export const GlobalConfigDefaults: Readonly<GlobalConfig> = {
	bbExeName: 'bb',
	bbApiExeName: 'bb-api',
	version: '2.0.0',
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	defaultModels: {
		orchestrator: 'claude-3-5-sonnet-20241022',
		agent: 'claude-3-5-sonnet-20241022',
		chat: 'claude-3-haiku-20240307',
	},
	noBrowser: false,
	api: ApiConfigDefaults,
	bui: BuiConfigDefaults,
	cli: CliConfigDefaults,
	dui: DuiConfigDefaults,
};
