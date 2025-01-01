import type { Context, Next } from '@oak/oak';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import { logger } from 'shared/logger.ts';
import type { BbState } from '../types/app.types.ts';

/**
 * Middleware to check authentication status
 * Skips auth check if API is in localMode
 */
export async function authMiddleware(ctx: Context<BbState>, next: Next) {
	try {
		const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();

		// Skip auth check in localMode
		if (globalConfig.api.localMode) {
			logger.debug('Auth check skipped: API is in localMode');
			await next();
			return;
		}

		// Check for authentication
		const sessionManager = ctx.app.state.auth.sessionManager;
		const session = await sessionManager.getSession();

		if (!session) {
			ctx.response.status = 401;
			ctx.response.body = {
				error: {
					code: 'UNAUTHORIZED',
					message: 'Authentication required',
				},
			};
			return;
		}

		// Add session to context state for handlers
		ctx.state.session = session;
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
 * Helper to apply auth middleware only to specific paths
 * @param paths Array of paths that require authentication
 */
export function requireAuth(paths: string[]) {
	return async (ctx: Context<BbState>, next: Next) => {
		// Check if the current path requires authentication
		const requiresAuth = paths.some((path) => {
			if (path.endsWith('*')) {
				// Handle wildcard paths (e.g., "/api/v1/protected/*")
				const basePath = path.slice(0, -1);
				return ctx.request.url.pathname.startsWith(basePath);
			}
			return ctx.request.url.pathname === path;
		});

		if (requiresAuth) {
			await authMiddleware(ctx, next);
		} else {
			await next();
		}
	};
}
