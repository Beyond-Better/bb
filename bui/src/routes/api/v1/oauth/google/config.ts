import { type FreshContext, Handlers } from '$fresh/server.ts';
import type { FreshAppState } from 'bui/types/state.ts';

/**
 * Get Google OAuth configuration for the BUI
 */
export const handler: Handlers<any, FreshAppState> = {
	GET(_req, ctx: FreshContext<FreshAppState>) {
		try {
			// Get OAuth configuration from state (set by stateConfig plugin)
			const clientId = ctx.state.buiConfig.googleOauth.clientId;
			const redirectUri = ctx.state.buiConfig.googleOauth.redirectUri;
			//console.log(`OAuth: handling token: `, { clientId, clientSecret, redirectUri });

			if (!clientId || !redirectUri) {
				console.error('OAuth: Missing Google OAuth configuration');
				return new Response(
					JSON.stringify({
						error: {
							code: 'MISSING_CONFIG',
							message: 'Google OAuth configuration incomplete',
							reason: 'missing_oauth_config',
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
				'https://www.googleapis.com/auth/documents', // read and write access to docs
				//'https://www.googleapis.com/auth/documents.readonly', // read access to docs
				'https://www.googleapis.com/auth/drive', // read and write access to files
				//'https://www.googleapis.com/auth/drive.readonly', // read access to files
				//'https://www.googleapis.com/auth/drive.file', // read and write access to files created by BB
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
