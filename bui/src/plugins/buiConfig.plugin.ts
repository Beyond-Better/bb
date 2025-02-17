import type { FreshContext, MiddlewareHandler, Plugin } from '$fresh/server.ts';
import type { BuiConfig } from 'shared/config/v2/types.ts';

//interface AppState {
//	buiConfig: BuiConfig;
//}

export const buiConfigPlugin = (buiConfig: BuiConfig): Plugin => {
	const handler: MiddlewareHandler = async (_req, ctx: FreshContext) => {
		//(ctx.state as unknown as AppState).buiConfig = buiConfig;
		ctx.state.buiConfig = buiConfig;
		return await ctx.next();
	};

	return {
		name: 'bui_config',
		middlewares: [
			{
				path: '/',
				middleware: { handler },
			},
			// 	{
			// 		path: '/app',
			// 		middleware: {
			// 			handler: setAppConfigState,
			// 		},
			// 	},
		],
	};
};
