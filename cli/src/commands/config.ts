import { Command } from 'cliffy/command';
import { colors } from 'cliffy/ansi/colors';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
//import type { ProjectType } from 'shared/config/v2/types.ts';
import { logger } from 'shared/logger.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';

const formatValue = (value: unknown, indent = ''): string => {
	const nextIndent = indent + '    ';
	if (Array.isArray(value)) {
		if (value.length === 0) return colors.cyan('[]');
		return colors.cyan('[\n') +
			value.map((v) => `${nextIndent}${formatValue(v, nextIndent)}`).join(',\n') +
			'\n' + indent + colors.cyan(']');
	} else if (typeof value === 'object' && value !== null) {
		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) return colors.cyan('{}');
		return colors.cyan('{\n') +
			entries
				.map(([k, v]) => `${nextIndent}${colors.yellow(k)}: ${formatValue(v, nextIndent)}`)
				.join(',\n') +
			'\n' + indent + colors.cyan('}');
	} else if (typeof value === 'string') {
		return colors.green(`"${value}"`);
	} else if (typeof value === 'boolean') {
		return colors.magenta(String(value));
	} else if (value === null) {
		return colors.red('null');
	} else if (value === undefined) {
		return colors.red('undefined');
	}
	return colors.green(String(value));
};

const getConfigValue = async (key: string, config: unknown): Promise<unknown> => {
	return key.split('.').reduce((obj, k) => {
		if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
			return (obj as Record<string, unknown>)[k];
		}
		return undefined;
	}, config);
};

export const config = new Command()
	.name('config')
	.description('View or update BB configuration')
	.action(() => {
		config.showHelp();
		Deno.exit(1);
	})
	.command('view', 'View configuration')
	.option('--global', 'Show only global configuration')
	.option('--project', 'Show only project configuration')
	.action(async ({ global, project }) => {
		try {
			if (global && project) {
				console.error(colors.red('Cannot specify both --global and --project'));
				Deno.exit(1);
			}

			const configManager = await ConfigManagerV2.getInstance();
			let config: unknown;
			if (global) {
				config = await configManager.getGlobalConfig();
				console.log(colors.bold('Global configuration:'));
			} else if (project) {
				const projectRoot = await getProjectRootFromStartDir(Deno.cwd());
				const projectId = await getProjectId(projectRoot);
				await configManager.ensureLatestProjectConfig(projectId);
				config = await configManager.getProjectConfig(projectId);
				console.log(colors.bold('Project configuration:'));
			} else {
				config = await configManager.getRedactedGlobalConfig();
				console.log(colors.bold('Current configuration:'));
			}
			console.log(formatValue(config));
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	})
	.command('get', 'Get a specific configuration value')
	.arguments('<key:string>')
	.option('--global', 'Get from global configuration')
	.option('--project', 'Get from project configuration')
	.action(async ({ global, project }, key) => {
		try {
			if (global && project) {
				console.error(colors.red('Cannot specify both --global and --project'));
				Deno.exit(1);
			}

			let value: unknown;
			const configManager = await ConfigManagerV2.getInstance();
			if (global) {
				const config = await configManager.getGlobalConfig();
				value = await getConfigValue(key, config);
			} else if (project) {
				const projectRoot = await getProjectRootFromStartDir(Deno.cwd());
				const projectId = await getProjectId(projectRoot);
				await configManager.ensureLatestProjectConfig(projectId);
				const config = await configManager.getProjectConfig(projectId);
				value = await getConfigValue(key, config);
			} else {
				const config = await configManager.getGlobalConfig();
				value = await getConfigValue(key, config);
			}

			if (value === undefined) {
				const configType = global ? 'global' : project ? 'project' : 'full';
				console.error(colors.red(`Key '${key}' not found in ${configType} configuration`));
				Deno.exit(1);
			}

			console.log(formatValue(value));
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	})
	.command('set', 'Set a configuration value')
	.arguments('<key:string> <value:string>')
	.option('--global', 'Set in global configuration')
	.option('--project', 'Set in project configuration (default)')
	.action(async ({ global, project }, key, value) => {
		try {
			if (global && project) {
				console.error(colors.red('Cannot specify both --global and --project'));
				Deno.exit(1);
			}

			const configManager = await ConfigManagerV2.getInstance();
			if (global) {
				await configManager.updateGlobalConfig({
					[key]: value,
				});
				logger.info(
					colors.green(`Global configuration updated: ${colors.yellow(key)} = ${formatValue(value)}`),
				);
			} else {
				// Default to project config
				const projectRoot = await getProjectRootFromStartDir(Deno.cwd());
				const projectId = await getProjectId(projectRoot);
				await configManager.updateProjectConfig(projectId, {
					[key]: value,
				});
				logger.info(
					colors.green(`Project configuration updated: ${colors.yellow(key)} = ${formatValue(value)}`),
				);
			}
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	});
