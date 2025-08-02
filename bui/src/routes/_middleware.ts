import { FreshContext, MiddlewareHandlerContext } from '$fresh/server.ts';
import { FreshAppState } from 'bui/types/state.ts'; // Augment Fresh context state types

export async function handler(req: Request, ctx: MiddlewareHandlerContext<FreshAppState>) {
	const origin = req.headers.get('Origin') || '*';
	const resp = await ctx.next();
	const headers = resp.headers;

	//origin = [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/((www|chat)\.)?(bbai\.tips|beyondbetter\.dev)$/];

	headers.set('Access-Control-Allow-Origin', origin);
	headers.set('Access-Control-Allow-Credentials', 'true');
	headers.set(
		'Access-Control-Allow-Headers',
		'Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With',
	);
	headers.set(
		'Access-Control-Allow-Methods',
		'POST, OPTIONS, GET, PUT, DELETE',
	);
	// 	headers.set(
	// 		'Content-Security-Policy',
	// 		`default-src 'self' 'unsafe-inline' data: blob: https: wss:; connect-src 'self' ws://localhost:3162 http://localhost:3162 data: blob: https: wss:; base-uri 'none';`,
	// 	);
	// 	// `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * ws: wss: http: https:`,
	// 	headers.set('Private-Network-Access-Policy', 'allow');

	return resp;
}
