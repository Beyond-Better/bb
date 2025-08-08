import type { MiddlewareHandler, MiddlewareHandlerContext, Plugin } from '$fresh/server.ts';
import type { FreshAppState } from 'bui/types/state.ts';

export const stateConfigPlugin = (initialState: FreshAppState): Plugin => {
	const handler: MiddlewareHandler = async (_req, ctx: MiddlewareHandlerContext) => {
		// Initialize state with the provided values
		ctx.state.buiConfig = initialState.buiConfig;
		ctx.state.user = initialState.user;
		ctx.state.session = initialState.session;
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
