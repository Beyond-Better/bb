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
const TERM = {
	// Text styles
	RESET: '\x1b[0m',
	BOLD: '\x1b[1m',
	DIM: '\x1b[2m',
	ITALIC: '\x1b[3m',
	UNDERLINE: '\x1b[4m',
	BLINK: '\x1b[5m',
	REVERSE: '\x1b[7m',
	HIDDEN: '\x1b[8m',

	// Standard foreground colors
	FG_BLACK: '\x1b[30m',
	FG_RED: '\x1b[31m',
	FG_GREEN: '\x1b[32m',
	FG_YELLOW: '\x1b[33m',
	FG_BLUE: '\x1b[34m',
	FG_MAGENTA: '\x1b[35m',
	FG_CYAN: '\x1b[36m',
	FG_WHITE: '\x1b[37m',

	// Bright foreground colors
	FG_BRIGHT_BLACK: '\x1b[90m', // Gray
	FG_BRIGHT_RED: '\x1b[91m',
	FG_BRIGHT_GREEN: '\x1b[92m',
	FG_BRIGHT_YELLOW: '\x1b[93m',
	FG_BRIGHT_BLUE: '\x1b[94m',
	FG_BRIGHT_MAGENTA: '\x1b[95m',
	FG_BRIGHT_CYAN: '\x1b[96m',
	FG_BRIGHT_WHITE: '\x1b[97m',

	// Standard background colors
	BG_BLACK: '\x1b[40m',
	BG_RED: '\x1b[41m',
	BG_GREEN: '\x1b[42m',
	BG_YELLOW: '\x1b[43m',
	BG_BLUE: '\x1b[44m',
	BG_MAGENTA: '\x1b[45m',
	BG_CYAN: '\x1b[46m',
	BG_WHITE: '\x1b[47m',

	BG_BRIGHT_BLACK: '\x1b[100m',
	BG_BRIGHT_RED: '\x1b[101m',
	BG_BRIGHT_GREEN: '\x1b[102m',
	BG_BRIGHT_YELLOW: '\x1b[103m',
	BG_BRIGHT_BLUE: '\x1b[104m',
	BG_BRIGHT_MAGENTA: '\x1b[105m',
	BG_BRIGHT_CYAN: '\x1b[106m',
	BG_BRIGHT_WHITE: '\x1b[107m',
};

function formatLog(message: string): string {
	const timestamp = new Date().toISOString()
		.replace('T', ' ')
		.substring(0, 19);

	// Extract source if message follows pattern: "Source: rest of message"
	const sourceMatch = message.match(/^([^\s:]+):\s*(.*)/);

	if (sourceMatch) {
		const [, source, actualMessage] = sourceMatch;
		return `[${timestamp} ${TERM.FG_BLUE}${TERM.BOLD}${source}${TERM.RESET}] ${actualMessage}`;
	}

	// No source found, use default format
	return `[${timestamp}] ${message}`;
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
			console.info(formatLog(message), ...args);
		}
	},
	info: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('info') >= logLevels.indexOf(currentLogLevel)) {
			console.info(formatLog(message), ...args);
		}
	},
	warn: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('warn') >= logLevels.indexOf(currentLogLevel)) {
			console.warn(formatLog(message), ...args);
		}
	},
	error: (message: string, ...args: unknown[]) => {
		if (logLevels.indexOf('error') >= logLevels.indexOf(currentLogLevel)) {
			console.error(formatLog(message), ...args);
		}
	},
};
