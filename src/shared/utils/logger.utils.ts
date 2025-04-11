//import { getConfigManager } from 'shared/config/configManager.ts';
import { blue, bold, cyan, green, red, yellow } from '@std/fmt/colors';
import { format } from '@std/datetime';

// const configManager = await getConfigManager();
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

function colorMessage(log_message: string, level?: string): string {
	const log_string: string = level === 'error'
		? `${red(log_message)}` // red
		: level === 'warn'
		? `${yellow(log_message)}` // yellow
		: level === 'debug'
		? `${cyan(log_message)}` // cyan
		: level === 'info'
		? `${log_message}`
		: `${green(log_message)}`;
	return log_string;
}

function formatLog(message: string, level?: string): string {
	const timestamp = format(new Date(Date.now()), 'dd-MM-yyyy hh:mm:ss.SSS');

	// Extract source if message follows pattern: "Source: rest of message"
	const sourceMatch = message.match(/^([^\s:]+):\s*(.*)/);

	if (sourceMatch) {
		const [, source, actualMessage] = sourceMatch;
		return `[${timestamp} ${bold(blue(source))}] ${colorMessage(actualMessage, level)}`;
	}

	// No source found, use default format
	return `[${timestamp}] ${colorMessage(message, level)}`;
}

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
			console.info(formatLog(message, 'debug'), ...args);
		}
	},
	info: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('info') >= logLevels.indexOf(currentLogLevel)) {
			console.info(formatLog(message, 'info'), ...args);
		}
	},
	warn: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('warn') >= logLevels.indexOf(currentLogLevel)) {
			console.warn(formatLog(message, 'warn'), ...args);
		}
	},
	error: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('error') >= logLevels.indexOf(currentLogLevel)) {
			console.error(formatLog(message, 'error'), ...args);
		}
	},
};
