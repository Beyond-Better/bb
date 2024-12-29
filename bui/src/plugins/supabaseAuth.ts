import type { MiddlewareHandlerContext, Plugin } from '$fresh/server.ts';
import { Session, User } from '@supabase/supabase-js';
import { type AuthState } from '../types/auth.ts';
import { initializeAuthState, useAuthState } from '../hooks/useAuthState.ts';
import { type BuiConfig } from 'shared/config/v2/types.ts';

export const supabaseAuthPlugin = (buiConfig: BuiConfig): Plugin => {
	//console.log('supabaseAuthPlugin: Auth system config:', buiConfig);
	try {
		initializeAuthState(buiConfig);
		console.log('supabaseAuthPlugin: Auth system initialized');
	} catch (error) {
		console.error('supabaseAuthPlugin: Failed to initialize auth system:', error);
		// Allow server to start even if auth fails - it will handle errors per-request
	}

	return {
		name: 'supabase_auth',
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

async function setSessionState(req: Request, ctx: MiddlewareHandlerContext) {
	if (ctx.destination !== 'route') return await ctx.next();

	const { getServerClient } = useAuthState();

	// Sanity check - start without a session
	ctx.state.session = null;

	// Create an empty response object here. We want to make sure we do this
	// session refresh before going further down the middleware chain
	const resp = new Response();
	const supabase = getServerClient(req, resp);

	if (!supabase) return ctx.next();

	// https://supabase.com/docs/guides/auth/server-side/nextjs
	// IMPORTANT: DO NOT REMOVE auth.getUser()
	// Refresh session if expired
	const {
		data: { user },
		//data,
	} = await supabase.auth.getUser();

	//ctx.state.session = session ?? null;
	ctx.state.user = user;

	// Continue down the middleware chain
	const nextResp = await ctx.next();

	// Copy over any headers that were added by Supabase
	// Note how we're spreading the headers before iterating. This ensures we're
	// capturing potentially duplicated headers that Supabase might add, like
	// chunked cookies.
	for (const [key, value] of [...resp.headers]) {
		nextResp.headers.append(key, value);
	}

	return nextResp;
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

function ensureSignedIn(req: Request, ctx: MiddlewareHandlerContext) {
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
