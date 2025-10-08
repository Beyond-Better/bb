import type { RouterContext } from '@oak/oak';
import { renderToString } from 'preact-render-to-string';
import type { JSX } from 'preact';
import type { LLMToolFormatterDestination } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryType } from 'shared/types.ts';
import type { LogEntryFormattedResult } from 'api/logEntries/types.ts';
import LogEntryFormatterManager from '../../logEntries/logEntryFormatterManager.ts';
import { logger } from 'shared/logger.ts';
import { projectEditorManager } from 'api/editor/projectEditorManager.ts';

export const logEntryFormatter = async (
	{ params, request, response, state }: RouterContext<
		'/v1/format_log_entry/:logEntryDestination/:logEntryFormatterType',
		{ logEntryDestination: LLMToolFormatterDestination; logEntryFormatterType: CollaborationLogEntryType }
	>,
) => {
	const { logEntryDestination, logEntryFormatterType } = params;

	try {
		const { logEntry, projectId, collaborationId } = await request.body.json();
		// logger.info(
		// 	`HandlerLogEntryFormatter for ${logEntryDestination} destination, type: ${logEntryFormatterType}, for Tool: ${
		// 		logEntry.toolName || 'N/A'
		// 	} - logEntry:`,
		// 	logEntry
		// );

		const userContext = state.userContext;
		if (!userContext) {
			logger.warn('HandlerLogEntryFormatter: No user context configured');
			response.status = 400;
			response.body = { error: 'No user context configured' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(
			projectId,
			collaborationId,
			userContext,
		);
		const logEntryFormatterManager = await new LogEntryFormatterManager(
			projectEditor,
		).init();

		if (!logEntry || !logEntry.entryType || (!logEntry.content && !logEntry.thinking)) {
			response.status = 400;
			response.body = { error: 'Missing entryType or content in request body' };
			return;
		}

		// logger.info(
		// 	`HandlerLogEntryFormatter for ${logEntryDestination} destination, type: ${logEntryFormatterType}, for Tool: ${
		// 		logEntry.toolName || 'N/A'
		// 	}`,
		// );

		if (!['console', 'browser'].includes(logEntryDestination)) {
			logger.warn(`HandlerlogEntryFormatter: Invalid logEntryDestination: ${logEntryDestination}`);
			response.status = 400;
			response.body = { error: 'Invalid log entry destination' };
			return;
		}

		const formattedResult = await logEntryFormatterManager.formatLogEntry(
			logEntryDestination as LLMToolFormatterDestination,
			logEntry,
			logEntry.metadata,
		);
		// logger.info(
		// 	`HandlerLogEntryFormatter for ${logEntryDestination} destination, type: ${logEntryFormatterType}, for Tool: ${
		// 		logEntry.toolName || 'N/A'
		// 	} - formattedResult:`,
		// 	formattedResult
		// );

		// Process each component of LogEntryFormattedResult based on destination
		const processedResult: LogEntryFormattedResult = {
			title: logEntryDestination === 'browser' && typeof formattedResult.title !== 'string'
				? renderToString(formattedResult.title as JSX.Element)
				: formattedResult.title as string,

			content: logEntryDestination === 'browser' && typeof formattedResult.content !== 'string'
				? renderToString(formattedResult.content as JSX.Element)
				: formattedResult.content as string,

			preview: logEntryDestination === 'browser' && typeof formattedResult.preview !== 'string'
				? renderToString(formattedResult.preview as JSX.Element)
				: formattedResult.preview as string,
		};

		// Include subtitle if present
		if (formattedResult.subtitle !== undefined) {
			processedResult.subtitle = logEntryDestination === 'browser' && typeof formattedResult.subtitle !== 'string'
				? renderToString(formattedResult.subtitle as JSX.Element)
				: formattedResult.subtitle as string;
		}
		// logger.info(
		// 	`HandlerLogEntryFormatter for ${logEntryDestination} destination, type: ${logEntryFormatterType}, for Tool: ${
		// 		logEntry.toolName || 'N/A'
		// 	} - processedResult:`,
		// 	processedResult
		// );

		response.status = 200;
		response.body = { formattedResult: processedResult };
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
