import type { Context, Next } from '@oak/oak';
import { getConfigManager } from 'shared/config/configManager.ts';
import { logger } from 'shared/logger.ts';
import { SessionRegistry } from 'api/auth/sessionRegistry.ts';
import type { BbState } from 'api/types/app.ts';

/**
 * Middleware to check authentication status
 * Skips auth check if API is in localMode
 */
export async function authMiddleware(ctx: Context<BbState>, next: Next) {
	try {
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();

		// Skip auth check in localMode
		if (globalConfig.api.localMode) {
			logger.debug('Auth check skipped: API is in localMode');
			ctx.state.localMode = true;

			const userContext = await SessionRegistry.getInstance().registerSession('local-user');
			if (!userContext) {
				ctx.response.status = 401;
				ctx.response.body = {
					error: {
						code: 'UNAUTHORIZED',
						message: 'Authentication required - user context not found',
					},
				};
				return;
			}

			ctx.state.userContext = userContext!;

			await next();
			return;
		}
		ctx.state.localMode = false;

		// Get userId from app state (set during startup)
		// this will eventually get set from auth headers when have full multi-user support
		const userId = ctx.app.state.auth.userId;

		// If no userId, there's no logged-in user
		if (!userId) {
			ctx.response.status = 401;
			ctx.response.body = {
				error: {
					code: 'UNAUTHORIZED',
					message: 'Authentication required - no user logged in',
				},
			};
			return;
		}

		const userContext = SessionRegistry.getInstance().getUserContext(userId);
		if (!userContext) {
			ctx.response.status = 401;
			ctx.response.body = {
				error: {
					code: 'UNAUTHORIZED',
					message: 'Authentication required - user context not found',
				},
			};
			return;
		}

		// if a userAuthSession has been registered, then the supabaseSession must have been valid
		// this check is to confirm that it is *still* valid
		const supabaseSession = await userContext.userAuthSession.getSession();
		if (!supabaseSession) {
			ctx.response.status = 401;
			ctx.response.body = {
				error: {
					code: 'UNAUTHORIZED',
					message: 'Authentication required',
				},
			};
			return;
		}

		// Add session to context state for handlers (maintain backward compatibility)
		//ctx.state.supabaseSession = supabaseSession;

		// Add userContext to context state for handlers
		ctx.state.userContext = userContext!;

		await next();
	} catch (error) {
		logger.error('Auth middleware error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}

/**
 * Helper to apply auth middleware to all paths except specified public paths
 * @param publicPaths Array of paths that do NOT require authentication
 */
export function requireAuth(publicPaths: string[]) {
	return async (ctx: Context<BbState>, next: Next) => {
		// Check if the current path is public (does not require authentication)
		//console.log(`check auth for: ${ctx.request.url.pathname}`);
		const isPublicPath = publicPaths.some((path) => {
			if (path.endsWith('*')) {
				// Handle wildcard paths (e.g., "/api/v1/doctor/*")
				const basePath = path.slice(0, -1);
				return ctx.request.url.pathname.startsWith(basePath);
			}
			return ctx.request.url.pathname === path;
		});

		if (isPublicPath) {
			// Public path - skip authentication
			await next();
		} else {
			// Protected path - require authentication
			await authMiddleware(ctx, next);
		}
	};
}
