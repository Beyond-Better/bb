import type { Context, Next } from '@oak/oak';
import { metricsService } from '../services/metrics.service.ts';
import config from '../config/config.ts';

export async function metricsHandler(ctx: Context, next: Next) {
	if (!config.metricsEnabled) {
		await next();
		return;
	}

	const start = Date.now();

	try {
		await next();
	} finally {
		const ms = Date.now() - start;
		await metricsService.recordRequestMetrics({
			latency: ms,
			endpoint: ctx.request.url.pathname,
			method: ctx.request.method,
			statusCode: ctx.response.status,
		});
	}
}
