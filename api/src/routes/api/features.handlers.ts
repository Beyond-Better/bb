/**
 * Features Handlers
 *
 * Handles feature access checks for users and teams, providing granular
 * access control for BB features, models, datasources, and tools.
 */

import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { FEATURE_KEYS } from 'shared/featureAccess.ts';
//import type { UserAuthSession } from 'api/auth/userAuthSession.ts';
import {
	clearUserCache,
	getAllRateLimits,
	getAvailableDatasources,
	getAvailableModels,
	getFeatureAccess,
	getUserFeatureProfile as getUserFeatureProfileFromUtils,
	hasExternalToolsAccess,
} from 'api/utils/featureAccess.ts';

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
	// deno-lint-ignore no-explicit-any
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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const profile = await getUserFeatureProfileFromUtils(userContext);

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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const body = await ctx.request.body.json();
		const { featureKey } = body;

		if (!featureKey || typeof featureKey !== 'string') {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid featureKey' };
			return;
		}

		const result = await getFeatureAccess(userContext, featureKey);

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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const body = await ctx.request.body.json();
		const { featureKeys } = body;

		if (!Array.isArray(featureKeys) || featureKeys.length === 0) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid featureKeys array' };
			return;
		}

		const results: Record<string, FeatureAccessResponse> = {};

		// Process all feature checks in parallel
		const checkPromises = featureKeys.map(async (featureKey) => {
			const result = await getFeatureAccess(userContext, featureKey);
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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const models = await getAvailableModels(userContext);

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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const datasources = await getAvailableDatasources(userContext);

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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const limits = await getAllRateLimits(userContext);

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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const hasAccess = await hasExternalToolsAccess(userContext);
		const result = await getFeatureAccess(userContext, FEATURE_KEYS.TOOLS.EXTERNAL);
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
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('FeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const refreshed = await clearUserCache(userContext);

		ctx.response.status = 200;
		ctx.response.body = { refreshed };
	} catch (error) {
		logger.error('FeaturesHandler: refreshUserFeatureCache error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}
