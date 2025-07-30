import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import type { BbState } from '../../types/app.types.ts';

/**
 * Get Google OAuth configuration
 */
export async function handleGoogleConfig(ctx: Context<BbState>) {
	try {
		// Get OAuth configuration from environment variables
		const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
		const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI');

		if (!clientId) {
			ctx.response.status = 500;
			ctx.response.body = {
				error: {
					code: 'MISSING_CONFIG',
					message: 'Google OAuth client ID not configured',
					reason: 'missing_client_id',
				},
			};
			return;
		}

		if (!redirectUri) {
			ctx.response.status = 500;
			ctx.response.body = {
				error: {
					code: 'MISSING_CONFIG',
					message: 'Google OAuth redirect URI not configured',
					reason: 'missing_redirect_uri',
				},
			};
			return;
		}

		// Define required scopes for Google Docs integration
		const scopes = [
			'https://www.googleapis.com/auth/documents',
			'https://www.googleapis.com/auth/drive.readonly',
			'https://www.googleapis.com/auth/drive.file',
		];

		ctx.response.status = 200;
		ctx.response.body = {
			clientId,
			scopes,
			redirectUri,
		};
	} catch (error) {
		logger.error('OAuth: Google config error:', error);
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
 * Exchange authorization code for tokens
 */
export async function handleGoogleToken(ctx: Context<BbState>) {
	try {
		const body = await ctx.request.body.json();
		const { code, state } = body;

		if (!code) {
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'INVALID_REQUEST',
					message: 'Authorization code is required',
					reason: 'missing_code',
				},
			};
			return;
		}

		// Get OAuth configuration from environment variables
		const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
		const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
		const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI');

		if (!clientId || !clientSecret || !redirectUri) {
			logger.error('OAuth: Missing Google OAuth configuration');
			ctx.response.status = 500;
			ctx.response.body = {
				error: {
					code: 'MISSING_CONFIG',
					message: 'Google OAuth configuration incomplete',
					reason: 'missing_oauth_config',
				},
			};
			return;
		}

		// Exchange authorization code for tokens
		logger.info(`OAuth: Exchanging authorization code for tokens`);

		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				code,
				client_id: clientId,
				client_secret: clientSecret,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code',
			}),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			logger.error(`OAuth: Token exchange failed (${tokenResponse.status}): ${errorText}`);
			
			ctx.response.status = 400;
			ctx.response.body = {
				error: {
					code: 'TOKEN_EXCHANGE_FAILED',
					message: 'Failed to exchange authorization code for tokens',
					reason: 'invalid_code',
				},
			};
			return;
		}

		const tokenData = await tokenResponse.json();
		
		// Calculate expiration timestamp
		const expiresAt = tokenData.expires_in 
			? Date.now() + (tokenData.expires_in * 1000)
			: undefined;

		logger.info('OAuth: Successfully exchanged authorization code for tokens');

		ctx.response.status = 200;
		ctx.response.body = {
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresAt,
			tokenType: tokenData.token_type || 'Bearer',
			scope: tokenData.scope,
		};

	} catch (error) {
		logger.error('OAuth: Token exchange error:', error);
		ctx.response.status = 500;
		ctx.response.body = {
			error: {
				code: 'SERVER_ERROR',
				message: 'Internal server error',
			},
		};
	}
}