import type { RouterContext } from '@oak/oak';
import { renderToString } from 'preact-render-to-string';
import type { JSX } from 'preact';
import type { LLMToolFormatterDestination } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryType } from 'shared/types.ts';
import LogEntryFormatterManager from '../../logEntries/logEntryFormatterManager.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManager } from 'shared/configManager.ts';

// Initialize LogEntryFormatterManager

export const logEntryFormatter = async (
	{ params, request, response }: RouterContext<
		'/v1/format_log_entry/:logEntryDestination/:logEntryFormatterType',
		{ logEntryDestination: LLMToolFormatterDestination; logEntryFormatterType: ConversationLogEntryType }
	>,
) => {
	//logger.debug('HandlerLogEntryFormatter-params', params);
	const { logEntryDestination, logEntryFormatterType } = params;

	try {
		const { logEntry, startDir } = await request.body.json();
		//logger.info('HandlerLogEntryFormatter-logEntry', logEntry);

		const fullConfig = await ConfigManager.fullConfig(startDir);
		const logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();

		if (!logEntry || !logEntry.entryType || !logEntry.content) {
			response.status = 400;
			response.body = { error: 'Missing entryType or content in request body' };
			return;
		}

		logger.info(
			`HandlerLogEntryFormatter for ${logEntryDestination} destination, type: ${logEntryFormatterType}, for Tool: ${
				logEntry.toolName || 'N/A'
			}`,
		);

		if (!['console', 'browser'].includes(logEntryDestination)) {
			logger.warn(`HandlerlogEntryFormatter: Invalid logEntryDestination: ${logEntryDestination}`);
			response.status = 400;
			response.body = { error: 'Invalid log entry destination' };
			return;
		}

		const formattedContent = await logEntryFormatterManager.formatLogEntry(
			logEntryDestination as LLMToolFormatterDestination,
			logEntry,
			logEntry.metadata,
		);

		// Convert JSX to HTML string if necessary
		const htmlContent = typeof formattedContent === 'string'
			? formattedContent
			: renderToString(formattedContent as JSX.Element);

		response.status = 200;
		response.body = { formattedContent: htmlContent };
	} catch (error) {
		logger.error(
			`Error in logEntryFormatter for logEntryFormatterType: ${logEntryFormatterType}: ${
				(error as Error).message
			}`,
			error,
		);
		response.status = 500;
		response.body = { error: 'Failed to format log entry', details: (error as Error).message };
	}
};
