import { DiagnosticResult } from '../types.ts';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
import type { GlobalConfigSchema } from 'shared/configSchema.ts';

interface ConfigValidationRule {
	path: string[]; // Config path (e.g., ['api', 'apiPort'])
	required?: boolean; // Is this setting required?
	type?: string; // Expected type
	validate?: (value: unknown) => boolean | string; // Custom validation
	fix?: {
		description: string;
		value: unknown;
		command?: string;
		apiEndpoint?: string;
	};
}

const CONFIG_RULES: ConfigValidationRule[] = [
	{
		path: ['api', 'apiPort'],
		required: true,
		type: 'number',
		validate: (value) => {
			const port = value as number;
			if (port < 1024 || port > 65535) {
				return 'Port must be between 1024 and 65535';
			}
			return true;
		},
		fix: {
			description: 'Reset to default port (3000)',
			value: 3000,
			command: 'bb config set --global api.apiPort 3000',
			apiEndpoint: '/api/v1/config/fix/api-port',
		},
	},
	{
		path: ['api', 'apiHostname'],
		required: true,
		type: 'string',
		fix: {
			description: 'Set default hostname (localhost)',
			value: 'localhost',
			command: 'bb config set --global api.apiHostname localhost',
			apiEndpoint: '/api/v1/config/fix/api-hostname',
		},
	},
	{
		path: ['api', 'apiUseTls'],
		type: 'boolean',
	},
];

function validateConfigValue(
	rule: ConfigValidationRule,
	config: GlobalConfigSchema,
): DiagnosticResult | null {
	const pathStr = rule.path.join('.');

	// Navigate the config object using the path
	let value: unknown = config;
	for (const key of rule.path) {
		if (value === undefined || value === null || typeof value !== 'object') {
			value = undefined;
			break;
		}
		value = (value as Record<string, unknown>)[key];
	}

	// Check if required
	if (rule.required && (value === undefined || value === null)) {
		return {
			category: 'config',
			status: 'error',
			message: `Missing required configuration: ${pathStr}`,
			fix: rule.fix
				? {
					description: rule.fix.description,
					command: rule.fix.command,
					apiEndpoint: rule.fix.apiEndpoint,
				}
				: undefined,
		};
	}

	// Skip further checks if value is undefined/null and not required
	if (value === undefined || value === null) {
		return null;
	}

	// Type check
	if (rule.type && typeof value !== rule.type) {
		return {
			category: 'config',
			status: 'error',
			message: `Invalid type for ${pathStr}: expected ${rule.type}, got ${typeof value}`,
			fix: rule.fix
				? {
					description: rule.fix.description,
					command: rule.fix.command,
					apiEndpoint: rule.fix.apiEndpoint,
				}
				: undefined,
		};
	}

	// Custom validation
	if (rule.validate) {
		const validationResult = rule.validate(value);
		if (typeof validationResult === 'string') {
			return {
				category: 'config',
				status: 'error',
				message: `Invalid value for ${pathStr}`,
				details: validationResult,
				fix: rule.fix
					? {
						description: rule.fix.description,
						command: rule.fix.command,
						apiEndpoint: rule.fix.apiEndpoint,
					}
					: undefined,
			};
		}
	}

	return null;
}

export async function checkConfig(): Promise<DiagnosticResult[]> {
	const results: DiagnosticResult[] = [];

	try {
		const configManager = await ConfigManager.getInstance();
		const globalConfig = await configManager.loadGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(Deno.cwd());

		// Check global config rules
		for (const rule of CONFIG_RULES) {
			const validationResult = validateConfigValue(rule, globalConfig);
			if (validationResult) {
				results.push(validationResult);
			}
		}

		// Add project-specific config checks here if needed
		// For now, just verify we can load it
		if (!projectConfig.project?.name || !projectConfig.project?.type) {
			results.push({
				category: 'config',
				status: 'error',
				message: 'Invalid project configuration',
				details: 'Missing required project name or type',
				fix: {
					description: 'Run BB initialization',
					command: 'bb init',
					apiEndpoint: '/api/v1/project/init',
				},
			});
		}

		// If no issues found, add an OK result
		if (results.length === 0) {
			results.push({
				category: 'config',
				status: 'ok',
				message: 'All configuration settings are valid',
			});
		}
	} catch (error) {
		logger.error('Failed to check configuration:', error);
		results.push({
			category: 'config',
			status: 'error',
			message: 'Failed to load configuration',
			details: (error as Error).message,
		});
	}

	return results;
}
