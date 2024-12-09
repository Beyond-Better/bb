/**
 * Configuration Management System v2
 *
 * This module exports the configuration management system including:
 * - Configuration types and interfaces
 * - Default configurations
 * - Configuration manager implementation
 */

export type {
	ApiConfig,
	BuiConfig,
	CliConfig,
	ConfigVersion,
	DuiConfig,
	GlobalConfig,
	LogLevel,
	MigrationResult,
	ProjectConfig,
	ProjectType,
	ServerConfig,
	TlsConfig,
	ValidationResult,
} from './types.ts';

export {
	ApiConfigDefaults,
	BuiConfigDefaults,
	CliConfigDefaults,
	DuiConfigDefaults,
	GlobalConfigDefaults,
} from './types.ts';

export { ConfigManagerV2 } from './configManager.ts';
