/**
 * Features Handlers
 *
 * Handles feature access checks for users and teams, providing granular
 * access control for BB features, models, datasources, and tools.
 */

import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import type { SessionManager } from 'api/auth/session.ts';
import {
	CacheManagement,
	checkFeatureAccess,
	DatasourceAccess,
	FEATURE_KEYS,
	getFeatureAccess,
	getUserFeatureProfile as getUserFeatureProfileFromUtils,
	ModelAccess,
	RateLimits,
	SupportAccess,
	ToolsAccess,
} from 'shared/features.ts';
import type { SupabaseClientWithSchema } from 'shared/types/supabase.ts';

export interface FeatureCheckRequest {
	featureKey: string;
	userId?: string; // Optional for admin checks
}

export interface BatchFeatureCheckRequest {
	featureKeys: string[];
	userId?: string; // Optional for admin checks
}

export interface FeatureAccessResponse {
	access_granted: boolean;
	feature_value: any;
	access_reason: string;
	resolved_from: string;
}

export interface UserFeatureProfile {
	models: string[];
	datasources: { name: string; read: boolean; write: boolean }[];
	tools: string[];
	limits: { tokensPerMinute: number; requestsPerMinute: number };
	support: {
		community: boolean;
		email: boolean;
		priorityQueue: boolean;
		earlyAccess: boolean;
		workspaceIsolation: boolean;
		sso: boolean;
		dedicatedCSM: boolean;
		onPremises: boolean;
	};
}

/**
 * Get Supabase clients from session manager
 */
async function getSupabaseClients(sessionManager: SessionManager): Promise<{
	coreClient: SupabaseClientWithSchema<'abi_core'>;
	billingClient: SupabaseClientWithSchema<'abi_billing'>;
}> {
	const coreClient = sessionManager.getCoreClient() as SupabaseClientWithSchema<'abi_core'>;
	const billingClient = sessionManager.getBillingClient() as SupabaseClientWithSchema<'abi_billing'>;
	return { coreClient, billingClient };
}

/**
 * @openapi
 * /api/v1/user/features:
 *   get:
 *     summary: Get user feature profile
 *     description: Retrieves the complete feature profile for the authenticated user
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User feature profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserFeatureProfile'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function getUserFeatureProfile(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: getUserFeatureProfile: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const profile = await getUserFeatureProfileFromUtils(coreClient, billingClient, session.user.id);

		ctx.response.status = 200;
		ctx.response.body = { profile };
	} catch (error) {
		logger.error('FeaturesHandler: getUserFeatureProfile error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/user/features/check:
 *   post:
 *     summary: Check feature access
 *     description: Checks if the authenticated user has access to a specific feature
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               featureKey:
 *                 type: string
 *                 description: The feature key to check
 *                 example: models.claude.sonnet
 *     responses:
 *       200:
 *         description: Feature access check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeatureAccessResponse'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function checkUserFeatureAccess(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: checkUserFeatureAccess: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const body = await ctx.request.body.json();
		const { featureKey } = body;

		if (!featureKey || typeof featureKey !== 'string') {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid featureKey' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const result = await getFeatureAccess(coreClient, billingClient, session.user.id, featureKey);

		ctx.response.status = 200;
		ctx.response.body = { result };
	} catch (error) {
		logger.error('FeaturesHandler: checkUserFeatureAccess error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/user/features/batch:
 *   post:
 *     summary: Batch check feature access
 *     description: Checks access to multiple features at once
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               featureKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of feature keys to check
 *                 example: ["models.claude.sonnet", "datasources.github", "tools.builtin"]
 *     responses:
 *       200:
 *         description: Batch feature access check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: object
 *                   additionalProperties:
 *                     $ref: '#/components/schemas/FeatureAccessResponse'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function batchCheckUserFeatureAccess(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: batchCheckUserFeatureAccess: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const body = await ctx.request.body.json();
		const { featureKeys } = body;

		if (!Array.isArray(featureKeys) || featureKeys.length === 0) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid featureKeys array' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const results: Record<string, FeatureAccessResponse> = {};

		// Process all feature checks in parallel
		const checkPromises = featureKeys.map(async (featureKey) => {
			const result = await getFeatureAccess(coreClient, billingClient, session.user.id, featureKey);
			results[featureKey] = result;
		});

		await Promise.all(checkPromises);

		ctx.response.status = 200;
		ctx.response.body = { results };
	} catch (error) {
		logger.error('FeaturesHandler: batchCheckUserFeatureAccess error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/user/features/models:
 *   get:
 *     summary: Get available models for user
 *     description: Retrieves all models the user has access to
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available models retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["claude.haiku", "claude.sonnet", "openai.gpt4"]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function getUserAvailableModels(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: getUserAvailableModels: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const models = await ModelAccess.getAvailableModels(coreClient, billingClient, session.user.id);

		ctx.response.status = 200;
		ctx.response.body = { models };
	} catch (error) {
		logger.error('FeaturesHandler: getUserAvailableModels error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/user/features/datasources:
 *   get:
 *     summary: Get available datasources for user
 *     description: Retrieves all datasources the user has access to
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available datasources retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datasources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       read:
 *                         type: boolean
 *                       write:
 *                         type: boolean
 *                   example: [{"name": "filesystem", "read": true, "write": true}]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function getUserAvailableDatasources(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: getUserAvailableDatasources: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const datasources = await DatasourceAccess.getAvailableDatasources(
			coreClient,
			billingClient,
			session.user.id,
		);

		ctx.response.status = 200;
		ctx.response.body = { datasources };
	} catch (error) {
		logger.error('FeaturesHandler: getUserAvailableDatasources error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/user/features/limits:
 *   get:
 *     summary: Get user rate limits
 *     description: Retrieves the user's current rate limits
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User rate limits retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 limits:
 *                   type: object
 *                   properties:
 *                     tokensPerMinute:
 *                       type: number
 *                     requestsPerMinute:
 *                       type: number
 *                   example: {"tokensPerMinute": 1000, "requestsPerMinute": 60}
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function getUserRateLimits(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: getUserRateLimits: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const limits = await RateLimits.getAllLimits(coreClient, billingClient, session.user.id);

		ctx.response.status = 200;
		ctx.response.body = { limits };
	} catch (error) {
		logger.error('FeaturesHandler: getUserRateLimits error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/user/features/external-tools:
 *   get:
 *     summary: Check external tools access
 *     description: Checks if the authenticated user has access to external tools (MCP)
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: External tools access check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasAccess:
 *                   type: boolean
 *                   description: Whether user has external tools access
 *                   example: true
 *                 reason:
 *                   type: string
 *                   description: Access reason
 *                   example: plan_feature
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function getUserHasExternalTools(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: getUserHasExternalTools: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const hasAccess = await ToolsAccess.hasExternalTools(coreClient, billingClient, session.user.id);
		const result = await getFeatureAccess(coreClient, billingClient, session.user.id, FEATURE_KEYS.TOOLS.EXTERNAL);
		//console.log('FeaturesHandler: getUserHasExternalTools:', { hasAccess, result });

		ctx.response.status = 200;
		ctx.response.body = {
			hasAccess,
			reason: result.access_reason,
		};
	} catch (error) {
		logger.error('FeaturesHandler: getUserHasExternalTools error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/user/features/cache/refresh:
 *   post:
 *     summary: Refresh user feature cache
 *     description: Refreshes the feature cache for the authenticated user
 *     tags:
 *       - Features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feature cache refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 refreshed:
 *                   type: number
 *                   description: Number of cache entries refreshed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
export async function refreshUserFeatureCache(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('FeaturesHandler: refreshUserFeatureCache: No session manager configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		const { coreClient, billingClient } = await getSupabaseClients(sessionManager);
		const refreshed = await CacheManagement.refreshCache(coreClient, billingClient, session.user.id);

		ctx.response.status = 200;
		ctx.response.body = { refreshed };
	} catch (error) {
		logger.error('FeaturesHandler: refreshUserFeatureCache error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}
