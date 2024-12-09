import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';

// const configManager = await ConfigManagerV2.getInstance();
// const globalConfig = await configManager.getGlobalConfig();

const logLevels = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof logLevels[number];

const getLogLevel = async (): Promise<LogLevel> => {
	const envLogLevel = Deno.env.get('LOG_LEVEL');
	if (envLogLevel && logLevels.includes(envLogLevel as LogLevel)) {
		return envLogLevel as LogLevel;
	}

	// 	if (globalConfig.api?.logLevel && logLevels.includes(globalConfig.api?.logLevel as LogLevel)) {
	// 		return globalConfig.api?.logLevel as LogLevel;
	// 	}

	return 'info';
};

const currentLogLevel = await getLogLevel();

export const logger = {
	dir: (arg: unknown) => {
		if (logLevels.indexOf('debug') >= logLevels.indexOf(currentLogLevel)) {
			console.dir(arg, { depth: null });
		}
	},
	debug: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('debug') >= logLevels.indexOf(currentLogLevel)) {
			// [FIXME] how do I enable debug logging via `console`
			// I've set LOG_LEVEL and --log-level but nothing gets me console.debug logs, so use console.info for now
			//console.debug(message, ...args);
			console.info(message, ...args);
		}
	},
	info: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('info') >= logLevels.indexOf(currentLogLevel)) {
			console.info(message, ...args);
		}
	},
	warn: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('warn') >= logLevels.indexOf(currentLogLevel)) {
			console.warn(message, ...args);
		}
	},
	error: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('error') >= logLevels.indexOf(currentLogLevel)) {
			console.error(message, ...args);
		}
	},
};
