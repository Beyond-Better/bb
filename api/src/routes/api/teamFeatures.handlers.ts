/**
 * Team Features Handlers
 *
 * Handles feature access checks for teams, providing granular
 * access control for BB features at the team level.
 */

import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import type { UserFeatureProfile } from 'shared/featureAccess.ts';
import {
	getAvailableModels,
	getFeatureAccess,
	getUserFeatureProfile as getUserFeatureProfileFromUtils,
} from 'api/utils/featureAccess.ts';
import type { SupabaseClientWithSchema } from 'shared/types/supabase.ts';
//import type { UserAuthSession } from 'api/auth/userAuthSession.ts';
import type { UserContext } from 'shared/types/app.ts';
import { SupabaseClientFactory } from 'api/auth/supabaseClientFactory.ts';

export type TeamFeatureProfile = UserFeatureProfile & { teamId: string };

/**
 * Get Supabase clients from userAuthSession
 */
async function getSupabaseClients(userContext: UserContext): Promise<{
	coreClient: SupabaseClientWithSchema<'abi_core'>;
	authClient: SupabaseClientWithSchema<'abi_auth'>;
	billingClient: SupabaseClientWithSchema<'abi_billing'>;
}> {
	const coreClient = await SupabaseClientFactory.getCoreClient(userContext);
	const authClient = await SupabaseClientFactory.getAuthClient(userContext);
	const billingClient = await SupabaseClientFactory.getBillingClient(userContext);
	return { coreClient, authClient, billingClient };
}

/**
 * Check if user has access to team
 */
async function checkTeamAccess(
	coreClient: SupabaseClientWithSchema<'abi_core'>,
	userId: string,
	teamId: string,
): Promise<boolean> {
	try {
		const { data, error } = await coreClient
			.from('team_members')
			.select('team_id')
			.eq('team_id', teamId)
			.eq('user_id', userId)
			.eq('status', 'active')
			.single();

		if (error) {
			logger.error('Error checking team access:', error);
			return false;
		}

		return !!data;
	} catch (error) {
		logger.error('Exception checking team access:', error);
		return false;
	}
}

/**
 * @openapi
 * /api/v1/team/{teamId}/features:
 *   get:
 *     summary: Get team feature profile
 *     description: Retrieves the complete feature profile for a team
 *     tags:
 *       - Team Features
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team feature profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   $ref: '#/components/schemas/TeamFeatureProfile'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - user not member of team
 *       404:
 *         description: Team not found
 *       500:
 *         description: Internal server error
 */
export async function getTeamFeatureProfile(ctx: Context & { params: { teamId: string } }) {
	try {
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('TeamFeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const teamId = ctx.params.teamId;
		if (!teamId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Team ID is required' };
			return;
		}

		const { coreClient } = await getSupabaseClients(userContext);

		// Check if user has access to this team
		const hasAccess = await checkTeamAccess(coreClient, userContext.userId, teamId);
		if (!hasAccess) {
			ctx.response.status = 403;
			ctx.response.body = { error: 'Access denied - user not member of team' };
			return;
		}

		// For now, team features are based on the team's subscription
		// In the future, this could be extended to have team-specific feature rules
		// For MVP, we'll use a representative user's features (team owner or admin)
		const { data: teamOwner, error } = await coreClient
			.from('team_members')
			.select('user_id')
			.eq('team_id', teamId)
			.eq('role', 'owner')
			.single();

		if (error || !teamOwner) {
			ctx.response.status = 404;
			ctx.response.body = { error: 'Team owner not found' };
			return;
		}

		// Get team features based on team owner's subscription
		const profile = await getUserFeatureProfileFromUtils(userContext, teamOwner.user_id);

		const teamProfile: TeamFeatureProfile = {
			teamId,
			...profile,
		};

		ctx.response.status = 200;
		ctx.response.body = { profile: teamProfile };
	} catch (error) {
		logger.error('TeamFeaturesHandler: getTeamFeatureProfile error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/team/{teamId}/features/check:
 *   post:
 *     summary: Check team feature access
 *     description: Checks if a team has access to a specific feature
 *     tags:
 *       - Team Features
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeatureCheckRequest'
 *     responses:
 *       200:
 *         description: Feature access check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   $ref: '#/components/schemas/FeatureAccessResponse'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - user not member of team
 *       404:
 *         description: Team not found
 *       500:
 *         description: Internal server error
 */
export async function checkTeamFeatureAccess(ctx: Context & { params: { teamId: string } }) {
	try {
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('TeamFeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const teamId = ctx.params.teamId;
		if (!teamId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Team ID is required' };
			return;
		}

		const body = await ctx.request.body.json();
		const { featureKey } = body;

		if (!featureKey || typeof featureKey !== 'string') {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid featureKey' };
			return;
		}

		const { coreClient, authClient } = await getSupabaseClients(userContext);

		// Check if user has access to this team
		const hasAccess = await checkTeamAccess(coreClient, userContext.userId, teamId);
		if (!hasAccess) {
			ctx.response.status = 403;
			ctx.response.body = { error: 'Access denied - user not member of team' };
			return;
		}

		// Get team owner to check features
		const { data: teamOwner, error } = await authClient
			.from('team_members')
			.select('user_id')
			.eq('team_id', teamId)
			.eq('role', 'owner')
			.single();

		if (error || !teamOwner) {
			ctx.response.status = 404;
			ctx.response.body = { error: 'Team owner not found' };
			return;
		}

		const result = await getFeatureAccess(userContext, featureKey, true, teamOwner.user_id);

		ctx.response.status = 200;
		ctx.response.body = { result };
	} catch (error) {
		logger.error('TeamFeaturesHandler: checkTeamFeatureAccess error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * @openapi
 * /api/v1/team/{teamId}/features/models:
 *   get:
 *     summary: Get available models for team
 *     description: Retrieves all models the team has access to
 *     tags:
 *       - Team Features
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: teamId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
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
 *       403:
 *         description: Access denied - user not member of team
 *       404:
 *         description: Team not found
 *       500:
 *         description: Internal server error
 */
export async function getTeamAvailableModels(ctx: Context & { params: { teamId: string } }) {
	try {
		const userContext = ctx.state.userContext;
		if (!userContext) {
			logger.warn('TeamFeaturesHandler: No user context configured');
			ctx.response.status = 400;
			ctx.response.body = { error: 'No user context configured' };
			return;
		}

		const teamId = ctx.params.teamId;
		if (!teamId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Team ID is required' };
			return;
		}

		const { coreClient, authClient } = await getSupabaseClients(userContext);

		// Check if user has access to this team
		const hasAccess = await checkTeamAccess(coreClient, userContext.userId, teamId);
		if (!hasAccess) {
			ctx.response.status = 403;
			ctx.response.body = { error: 'Access denied - user not member of team' };
			return;
		}

		// Get team owner to check features
		const { data: teamOwner, error } = await authClient
			.from('team_members')
			.select('user_id')
			.eq('team_id', teamId)
			.eq('role', 'owner')
			.single();

		if (error || !teamOwner) {
			ctx.response.status = 404;
			ctx.response.body = { error: 'Team owner not found' };
			return;
		}

		const models = await getAvailableModels(userContext, teamOwner.user_id);

		ctx.response.status = 200;
		ctx.response.body = { models };
	} catch (error) {
		logger.error('TeamFeaturesHandler: getTeamAvailableModels error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}
