import type { FreshContext, Plugin } from '$fresh/server.ts';
import type { BuiConfig } from 'shared/config/types.ts';
import { initializeAuthState, useAuthState } from '../hooks/useAuthState.ts';
//import { IS_BROWSER } from '$fresh/runtime.ts';

export const authPlugin = (buiConfig: BuiConfig): Plugin => {
	try {
		initializeAuthState(buiConfig);
		console.log('authPlugin: Auth system initialized');
	} catch (error) {
		console.error('authPlugin: Failed to initialize auth system:', error);
		// Allow server to start even if auth fails - it will handle errors per-request
	}

	return {
		name: 'api_auth',
		middlewares: [
			// For every route, we ensure the session state is updated
			{
				path: '/',
				middleware: {
					handler: setSessionState,
				},
			},

			// For the dashboard route, we ensure the user is signed in
			{
				path: '/app',
				middleware: {
					handler: ensureSignedIn,
				},
			},
		],
	};
};

async function setSessionState(req: Request, ctx: FreshContext) {
	if (ctx.destination !== 'route') return await ctx.next();

	//console.log('setSessionState: IS_BROWSER: ', IS_BROWSER);
	const { authState } = useAuthState();
	//console.log('setSessionState: authState: ', authState.value);

	// Sanity check - start without a session
	ctx.state.session = null;

	if (authState.value.isLocalMode) {
		ctx.state.session = authState.value.session;
		return ctx.next();
	}

	// Get current session from API
	const { getSessionUser } = useAuthState();
	const { user, error } = await getSessionUser(req, null);

	if (error) {
		console.error('Failed to get session:', error);
	}

	ctx.state.user = user ?? null;

	// Continue down the middleware chain
	return await ctx.next();
}

// Create a redirect response to the login page
function createLoginRedirect(req: Request, error?: string) {
	const url = new URL(req.url);
	const loginUrl = new URL('/auth/login', req.url);
	loginUrl.searchParams.set('redirect', url.pathname + url.search);
	if (error) {
		loginUrl.searchParams.set('error', error);
	}
	return loginUrl;
}

function ensureSignedIn(req: Request, ctx: FreshContext) {
	console.log('authPlugin: ensureSignedIn');
	const { authState } = useAuthState();
	console.log('authPlugin: ensureSignedIn - isLocalMode', authState.value.isLocalMode);
	if (authState.value.isLocalMode) {
		return ctx.next();
	}
	if (!ctx.state.user) {
		const loginUrl = createLoginRedirect(req);
		return new Response(null, {
			headers: {
				location: loginUrl.toString(),
			},
			status: 302,
		});
	}

	return ctx.next();
}
