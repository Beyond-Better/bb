import type { Context, Next } from '@oak/oak';
import { blue, bold, cyan, green, red, yellow } from '@std/fmt/colors';
import { format } from '@std/datetime';
import type { BbState } from '../types/app.types.ts';

const X_RESPONSE_TIME: string = 'X-Response-Time';
const User_Agent: string = 'User-Agent';

const IGNORE_STATUS_REQUESTS = true;

/** The standard logging function that processes and logs requests. */
export async function logger(ctx: Context<BbState>, next: Next) {
	await next();
	if (
		IGNORE_STATUS_REQUESTS && ctx.request.url.pathname === '/api/v1/status' && ctx.response.status === 200 &&
		ctx.request.method === 'GET'
	) {
		return;
	}
	const responseTime = ctx.response.headers.get(X_RESPONSE_TIME) || '';
	const userAgent = ctx.request.headers.get(User_Agent);
	const status: number = ctx.response.status;
	const timestamp = format(new Date(Date.now()), 'dd-MM-yyyy hh:mm:ss.SSS');
	const log_message: string = `${ctx.request.ip} ${
		bold(String(status))
	} "${ctx.request.method} ${ctx.request.url.pathname}" ${userAgent} ${responseTime}`;
	const log_string: string = status >= 500
		? `${red(log_message)}` // red
		: status >= 400
		? `${yellow(log_message)}` // yellow
		: status >= 300
		? `${cyan(log_message)}` // cyan
		: status >= 200
		? `${green(log_message)}` // green
		: `${red(log_message)}`;
	console.log(`[${timestamp} ${bold(blue('HTTP'))}] ${log_string}`);
}

/** Response time calculator that also adds response time header. */
export async function responseTime(ctx: Context<BbState>, next: Next) {
	const start = Date.now();
	await next();
	const ms: number = Date.now() - start;
	ctx.response.headers.set(X_RESPONSE_TIME, `${ms}ms`);
}

export default { logger, responseTime };
