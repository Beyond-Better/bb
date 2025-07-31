import { Handlers } from '$fresh/server.ts';

/**
 * Get Google OAuth configuration for the BUI
 */
export const handler: Handlers = {
	GET(_req, _ctx) {
		try {
			// Get OAuth configuration from environment variables
			// Note: clientId is application config, not stored in user credentials
			const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
			const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') ||
				'https://chat.beyondbetter.app/oauth/google/callback';
			//'https://localhost:8080/oauth/google/callback';

			if (!clientId) {
				return new Response(
					JSON.stringify({
						error: {
							code: 'MISSING_CONFIG',
							message: 'Google OAuth client ID not configured',
							reason: 'missing_client_id',
						},
					}),
					{
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					},
				);
			}

			// Define required scopes for Google Docs integration
			const scopes = [
				'https://www.googleapis.com/auth/documents',
				'https://www.googleapis.com/auth/drive.readonly',
				'https://www.googleapis.com/auth/drive.file',
			];

			// Return config for PKCE OAuth flow (no client secret needed)
			// clientId is application-level config, not stored with user credentials

			return new Response(
				JSON.stringify({
					clientId,
					//clientSecret,
					redirectUri,
					scopes,
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		} catch (error) {
			console.error('OAuth: Google config error:', error);
			return new Response(
				JSON.stringify({
					error: {
						code: 'SERVER_ERROR',
						message: 'Internal server error',
					},
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	},
};
