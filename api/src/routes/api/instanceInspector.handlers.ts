import { Context } from '@oak/oak';
import { formatInstanceOverview, getInstanceOverview, logInstanceOverview } from '../../utils/instanceInspector.ts';

/**
 * Handler for retrieving a detailed overview of all instantiated API objects
 * @param ctx Oak context
 */
export const getInstanceOverviewHandler = async (ctx: Context) => {
	try {
		// Check if detailed output is requested
		const detailed = ctx.request.url.searchParams.get('detailed') === 'true';
		const format = ctx.request.url.searchParams.get('format') || 'json';
		const logToFile = ctx.request.url.searchParams.get('log') === 'true';

		// Optionally write to log file
		if (logToFile) {
			logInstanceOverview({ detailed });
		}

		if (format === 'text') {
			// Return formatted text representation
			ctx.response.type = 'text/plain';
			ctx.response.body = formatInstanceOverview({ detailed });
		} else {
			// Return JSON overview
			ctx.response.type = 'application/json';
			ctx.response.body = {
				success: true,
				overview: getInstanceOverview({ detailed }),
			};
		}
	} catch (error) {
		ctx.response.status = 500;
		ctx.response.type = 'application/json';
		ctx.response.body = {
			success: false,
			error: error instanceof Error ? error.message : 'An unknown error occurred',
		};
	}
};
