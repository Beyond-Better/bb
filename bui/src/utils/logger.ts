/**
 * Frontend logging utility for BUI components
 * Provides structured logging for OAuth flows and debugging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
	[key: string]: unknown;
}

class FrontendLogger {
	private context: LogContext = {};

	constructor(private prefix: string = 'BUI') {}

	/**
	 * Set persistent context for all log messages
	 */
	setContext(context: LogContext): void {
		this.context = { ...this.context, ...context };
	}

	/**
	 * Clear persistent context
	 */
	clearContext(): void {
		this.context = {};
	}

	/**
	 * Create a child logger with additional context
	 */
	child(additionalContext: LogContext): FrontendLogger {
		const child = new FrontendLogger(this.prefix);
		child.context = { ...this.context, ...additionalContext };
		return child;
	}

	private formatMessage(level: LogLevel, message: string, context?: LogContext): void {
		const timestamp = new Date().toISOString();
		const fullContext = { ...this.context, ...context };
		const logData = {
			timestamp,
			level: level.toUpperCase(),
			prefix: this.prefix,
			message,
			...fullContext,
		};

		// Use appropriate console method based on level
		switch (level) {
			case 'debug':
				console.debug(`[${this.prefix}]`, message, fullContext);
				break;
			case 'info':
				console.info(`[${this.prefix}]`, message, fullContext);
				break;
			case 'warn':
				console.warn(`[${this.prefix}]`, message, fullContext);
				break;
			case 'error':
				console.error(`[${this.prefix}]`, message, fullContext);
				break;
		}

		// // In development, also log structured data for debugging
		// if (import.meta.env?.DEV) {
		// 	console.group(`🔍 [${this.prefix}] ${level.toUpperCase()}: ${message}`);
		// 	console.table(logData);
		// 	console.groupEnd();
		// }
	}

	debug(message: string, context?: LogContext): void {
		this.formatMessage('debug', message, context);
	}

	info(message: string, context?: LogContext): void {
		this.formatMessage('info', message, context);
	}

	warn(message: string, context?: LogContext): void {
		this.formatMessage('warn', message, context);
	}

	error(message: string, context?: LogContext): void {
		this.formatMessage('error', message, context);
	}

	/**
	 * Log OAuth-specific events with structured context
	 */
	oauth(
		event: string,
		context: LogContext & {
			serverId: string;
			grantType?: string;
			step?: string;
		},
	): void {
		this.info(`OAuth ${event}`, {
			...context,
			oauthEvent: event,
			timestamp: Date.now(),
		});
	}

	/**
	 * Log user interactions with structured context
	 */
	userAction(action: string, context?: LogContext): void {
		this.info(`User Action: ${action}`, {
			...context,
			userAction: action,
			timestamp: Date.now(),
		});
	}

	/**
	 * Log API calls with request/response context
	 */
	apiCall(method: string, endpoint: string, context?: LogContext): void {
		this.debug(`API Call: ${method} ${endpoint}`, {
			...context,
			method,
			endpoint,
			timestamp: Date.now(),
		});
	}

	/**
	 * Log errors with stack traces and additional context
	 */
	errorWithStack(message: string, error: Error | unknown, context?: LogContext): void {
		const errorContext = {
			...context,
			error: error instanceof Error
				? {
					name: error.name,
					message: error.message,
					stack: error.stack,
				}
				: error,
		};
		this.error(message, errorContext);
	}
}

// Global logger instances for different parts of the BUI
export const logger = new FrontendLogger('BUI');
export const oauthLogger = new FrontendLogger('BUI-OAuth');
export const mcpLogger = new FrontendLogger('BUI-MCP');

// Export logger factory for component-specific loggers
export const createLogger = (prefix: string) => new FrontendLogger(prefix);
