import { Handlers } from '$fresh/server.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';

export const handler: Handlers = {
	async GET(req, _ctx) {
		const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();

		return new Response(
			JSON.stringify({
				url: globalConfig.bui.supabaseUrl,
				anonKey: globalConfig.bui.supabaseAnonKey,
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
