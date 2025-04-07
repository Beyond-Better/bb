/**
 * Configuration system version 2.1.0
 *
 * This module defines the type system for BB's configuration management.
 * It includes definitions for global and project-specific configurations,
 * as well as component-specific settings for API, BUI, CLI, and DUI.
 */

import { LLMProvider } from 'api/types/llms.ts';

// Version Management
const CONFIG_VERSIONS = ['1.0.0', '2.0.0', '2.1.0'] as const;
/** Supported configuration versions */
export type ConfigVersion = typeof CONFIG_VERSIONS[number];

// [TODO] type 'git' is deprecated, but legacy projects can be type 'git'
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
/**
 * LLM Provider configuration.
 * Contains provider-specific settings and credentials.
 */
/**
 * User-configurable model preferences
 * Allows users to set their preferred defaults for model parameters
 */
export interface UserModelPreferences {
	temperature?: number;
	maxTokens?: number;
	extendedThinking?: boolean;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	responseFormat?: string;
}

export interface MCPServerConfig {
	id: string;
	name?: string;
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

export interface LLMProviderConfig {
	apiKey?: string;
	defaultModel?: string;
	baseURL?: string;
	/**
	 * User-configured model preferences
	 * These override model defaults but can be overridden by explicit request values
	 */
	userPreferences?: UserModelPreferences;
	// Future extensibility for provider-specific settings
}

/**
 * API server configuration.
 * Extends base server config with API-specific settings.
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

	mcpServers?: Array<MCPServerConfig>;

	/**
	 * Extended thinking configuration for Claude models
	 * Controls whether Claude shows its step-by-step reasoning process
	 */
	extendedThinking?: {
		enabled: boolean;
		budgetTokens: number;
	};

	/**
	 * Provider-specific LLM configurations.
	 * Includes API keys and provider settings.
	 */
	llmProviders?: Partial<Record<LLMProvider, LLMProviderConfig>>;
	// 	[LLMProvider.BB]?: LLMProviderConfig;
	// 	[LLMProvider.ANTHROPIC]?: LLMProviderConfig;
	// 	[LLMProvider.OPENAI]?: LLMProviderConfig;
	// 	[LLMProvider.DEEPSEEK]?: LLMProviderConfig;
	// 	[LLMProvider.GOOGLE]?: LLMProviderConfig;
	// 	[LLMProvider.GROQ]?: LLMProviderConfig;
	// 	[LLMProvider.OLLAMA]?: LLMProviderConfig;

	/** @deprecated Use llmProviders instead */
	llmKeys?: {
		anthropic?: string;
		openai?: string;
		deepseek?: string;
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
export interface GlobalConfigV2 {
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

export type GlobalConfig = GlobalConfigV2;

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
export interface ProjectConfigV2 {
	version: ConfigVersion;
	projectId: string;
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

export type ProjectConfig = ProjectConfigV2;

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
// IMPORTANT: When updating these defaults, also update the corresponding Rust defaults in:
// dui/src-tauri/src/config.rs (impl Default for each config struct)
// When updating these defaults, update impl Default for ApiConfig in dui/src-tauri/src/config.rs
export const ApiConfigDefaults: Readonly<Omit<ApiConfig, 'llmProviders'>> = {
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
	extendedThinking: {
		enabled: true,
		budgetTokens: 4000,
	},
	//llmProviders: {},
};

// When updating these defaults, update impl Default for BuiConfig in dui/src-tauri/src/config.rs
export const BuiConfigDefaults: Readonly<BuiConfig> = {
	hostname: 'localhost',
	port: 8080,
	tls: {
		useTls: false,
	},
	localMode: false,
	kvSessionPath: 'auth.kv',
};

// When updating these defaults, update impl Default for CliConfig in dui/src-tauri/src/config.rs
export const CliConfigDefaults: Readonly<CliConfig> = {
	historySize: 1000,
};

// When updating these defaults, update impl Default for DuiConfig in dui/src-tauri/src/config.rs
export const DuiConfigDefaults: Readonly<DuiConfig> = {
	defaultApiConfig: {},
	projectsDirectory: './projects',
	recentProjects: 5,
};

//export const ProjectConfigDefaults: Readonly<Omit<ProjectConfig, 'version' | 'projectId' | 'name'>> = {
export const ProjectConfigDefaults: Readonly<ProjectConfig> = {
	version: '2.1.0',
	projectId: '',
	name: '',
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

// When updating these defaults, update impl Default for GlobalConfig in dui/src-tauri/src/config.rs
//export const GlobalConfigDefaults: Readonly<Omit<GlobalConfig, 'version' | 'bbExeName' | 'bbApiExeName'>> = {
export const GlobalConfigDefaults: Readonly<GlobalConfig> = {
	version: '2.1.0',
	bbExeName: 'bb',
	bbApiExeName: 'bb-api',
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	defaultModels: {
		orchestrator: 'claude-3-7-sonnet-20250219',
		agent: 'claude-3-7-sonnet-20250219',
		chat: 'claude-3-haiku-20240307',
	},
	noBrowser: false,
	api: ApiConfigDefaults,
	bui: BuiConfigDefaults,
	cli: CliConfigDefaults,
	dui: DuiConfigDefaults,
};
