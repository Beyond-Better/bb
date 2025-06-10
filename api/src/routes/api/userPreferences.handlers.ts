/**
 * User Preferences Handlers
 *
 * Handles getting and updating user preferences stored in the user_profiles table.
 * The preferences are stored in a JSONB field and include notification settings.
 */

import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import type { SessionManager } from 'api/auth/session.ts';

export interface UserPreferences {
	theme: 'light' | 'dark' | 'system';
	fontSize: 'small' | 'medium' | 'large';
	language: string;
	timezone: string;
	notifications: {
		statement_completion: {
			audioEnabled: boolean;
			browserNotifications: boolean;
			visualIndicators: boolean;
			customAudioUrl?: string;
			audioVolume: number;
		};
	};
	defaultProjectId?: string;
	recentProjects: string[];
	projectViewMode: 'list' | 'grid';
}

export interface EdgeFunctionUserProfile {
	profile_id: string;
	name_first?: string;
	name_last?: string;
	theme: 'light' | 'dark' | 'system';
	notifications: {
		statement_completion: {
			audioEnabled: boolean;
			browserNotifications: boolean;
			visualIndicators: boolean;
			customAudioUrl?: string;
			audioVolume: number;
		};
	};
}

/**
 * @openapi
 * /api/v1/user/preferences:
 *   get:
 *     summary: Get user preferences
 *     description: Retrieves the current user's preferences from their profile
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   $ref: '#/components/schemas/UserPreferences'
 *       404:
 *         description: User profile not found
 *       500:
 *         description: Internal server error
 */
export async function getUserPreferences(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`UserPreferencesHandler: getUserPreferences: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}

		const supabaseClient = sessionManager.getClient();
		const session = await sessionManager.getSession();
		if (!session?.user?.id) {
			ctx.response.status = 401;
			ctx.response.body = { error: 'Unauthorized' };
			return;
		}

		// Use edge function to get user profile
		const { data: profileData, error } = await supabaseClient.functions.invoke('user-profile', {
			// headers: {
			// 	'Authorization': `Bearer ${session.access_token}`,
			// },
			method: 'GET',
		});

		if (error) {
			logger.error('UserPreferencesHandler: Error calling user-profile edge function:', error);
			ctx.response.status = 500;
			ctx.response.body = { error: 'Failed to fetch user preferences' };
			return;
		}

		// Handle edge function response
		if (!profileData?.success) {
			if (profileData?.error?.includes('not found') || profileData?.error?.includes('does not exist')) {
				// No profile exists yet, return null preferences
				ctx.response.status = 200;
				ctx.response.body = { preferences: null };
				return;
			}

			logger.error('UserPreferencesHandler: Edge function returned error:', profileData?.error);
			ctx.response.status = 500;
			ctx.response.body = { error: profileData?.error || 'Failed to fetch user preferences' };
			return;
		}

		// Transform edge function data to our UserPreferences format
		const edgeProfile: EdgeFunctionUserProfile = profileData.data;
		const preferences: UserPreferences = transformEdgeProfileToPreferences(edgeProfile);

		ctx.response.status = 200;
		ctx.response.body = { preferences };
	} catch (error) {
		logger.error('UserPreferencesHandler: getUserPreferences error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}

/**
 * Transform edge function user profile to our UserPreferences format
 */
function transformEdgeProfileToPreferences(edgeProfile: EdgeFunctionUserProfile): UserPreferences {
	const defaultPreferences: UserPreferences = {
		theme: 'system',
		fontSize: 'medium',
		language: 'en',
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		notifications: {
			statement_completion: {
				audioEnabled: true,
				browserNotifications: true,
				visualIndicators: true,
				audioVolume: 0.5,
			},
		},
		recentProjects: [],
		projectViewMode: 'list',
	};

	return {
		...defaultPreferences,
		theme: edgeProfile.theme || defaultPreferences.theme,
		notifications: {
			statement_completion: {
				...defaultPreferences.notifications.statement_completion,
				...edgeProfile.notifications?.statement_completion,
			},
		},
	};
}

/**
 * Transform our UserPreferences format to edge function update payload
 */
function transformPreferencesToEdgeFormat(preferences: Partial<UserPreferences>): any {
	const payload: any = {};

	// Map theme directly
	if (preferences.theme) {
		payload.preferences = {
			theme: preferences.theme,
		};
	}

	// Map notifications to the edge function structure
	if (preferences.notifications?.statement_completion) {
		if (!payload.preferences) {
			payload.preferences = {};
		}
		payload.preferences.notifications = {
			statement_completion: preferences.notifications.statement_completion,
		};
	}

	return payload;
}

/**
 * @openapi
 * /api/v1/user/preferences:
 *   put:
 *     summary: Update user preferences
 *     description: Updates the current user's preferences in their profile
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 $ref: '#/components/schemas/UserPreferences'
 *     responses:
 *       200:
 *         description: User preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   $ref: '#/components/schemas/UserPreferences'
 *       400:
 *         description: Invalid preferences data
 *       500:
 *         description: Internal server error
 */
export async function updateUserPreferences(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`UserPreferencesHandler: updateUserPreferences: No session manager configured`,
			);
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
		const { preferences } = body;
		logger.info(
			`UserPreferencesHandler: updateUserPreferences:`,
			preferences,
		);

		if (!preferences || typeof preferences !== 'object') {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid preferences data' };
			return;
		}

		// Transform our UserPreferences format to edge function format
		const updatePayload = transformPreferencesToEdgeFormat(preferences);
		// logger.info(
		// 	`UserPreferencesHandler: updateUserPreferences:`,
		// 	updatePayload,
		// );

		const supabaseClient = sessionManager.getClient();

		// Use edge function to update user profile
		const { data: profileData, error } = await supabaseClient.functions.invoke('user-profile', {
			method: 'PATCH',
			body: updatePayload,
			// headers: {
			// 	//'Authorization': `Bearer ${session.access_token}`,
			// },
		});

		if (error) {
			logger.error('UserPreferencesHandler: Error calling user-profile edge function:', error);
			ctx.response.status = 500;
			ctx.response.body = { error: 'Failed to update user preferences' };
			return;
		}

		// Handle edge function response
		if (!profileData?.success) {
			logger.error('UserPreferencesHandler: Edge function returned error:', profileData?.error);
			ctx.response.status = 500;
			ctx.response.body = { error: profileData?.error || 'Failed to update user preferences' };
			return;
		}

		// Transform edge function data back to our UserPreferences format
		const edgeProfile: EdgeFunctionUserProfile = profileData.data;
		const updatedPreferences: UserPreferences = transformEdgeProfileToPreferences(edgeProfile);

		//logger.info(`UserPreferencesHandler: Updated preferences for user ${session.user.id}`);

		ctx.response.status = 200;
		//ctx.response.body = { preferences: updatedPreferences };
		ctx.response.body = { preferences: {} };
	} catch (error) {
		logger.error('UserPreferencesHandler: updateUserPreferences error:', error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Internal server error' };
	}
}
