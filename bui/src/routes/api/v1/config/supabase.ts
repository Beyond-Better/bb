import { Handlers } from '$fresh/server.ts';
import { getConfigManager } from 'shared/config/configManager.ts';

export const handler: Handlers = {
	async GET(req, _ctx) {
		const configManager = await getConfigManager();
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
