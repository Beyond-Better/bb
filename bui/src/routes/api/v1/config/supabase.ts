import { FreshContext, Handlers } from '$fresh/server.ts';
import type { FreshAppState } from 'bui/types/state.ts';

export const handler: Handlers = {
	async GET(req, ctx: FreshContext<FreshAppState>) {
		const supabaseUrl = ctx.state.buiConfig.supabaseUrl;
		const supabaseAnonKey = ctx.state.buiConfig.supabaseAnonKey;
		if (!supabaseUrl || !supabaseAnonKey) {
			console.error('ConfigSupabase: Missing Supabase configuration');
			return new Response(
				JSON.stringify({
					error: {
						code: 'MISSING_CONFIG',
						message: 'Supabase configuration incomplete',
						reason: 'missing_supabase_config',
					},
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
		//console.error('ConfigSupabase: ', { supabaseUrl, supabaseAnonKey });

		return new Response(
			JSON.stringify({
				url: supabaseUrl,
				anonKey: supabaseAnonKey,
				verifyUrl: new URL('/auth/verify', `${req.url}`).toString(),
			}),
			{
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
	},
};
