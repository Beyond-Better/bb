import { FreshContext } from '$fresh/server.ts';

export async function handler(req: Request, ctx: FreshContext) {
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
	headers.set(
		'Content-Security-Policy',
		`default-src 'self' data: blob:; connect-src 'self' ws://localhost http://localhost`,
	);
	// `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * ws: wss: http: https:`,

	return resp;
}
