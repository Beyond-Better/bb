import { Handlers } from '$fresh/server.ts';

/**
 * Exchange authorization code for Google OAuth tokens
 */
export const handler: Handlers = {
	async POST(req, _ctx) {
		try {
			const body = await req.json();
			const { code, state } = body;

			if (!code) {
				return new Response(JSON.stringify({
					error: {
						code: 'INVALID_REQUEST',
						message: 'Authorization code is required',
						reason: 'missing_code',
					},
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Get OAuth configuration from environment variables
			const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
			const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
			const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') || 
				'http://localhost:3000/oauth/google/callback';

			if (!clientId || !clientSecret) {
				console.error('OAuth: Missing Google OAuth configuration');
				return new Response(JSON.stringify({
					error: {
						code: 'MISSING_CONFIG',
						message: 'Google OAuth configuration incomplete',
						reason: 'missing_oauth_config',
					},
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Exchange authorization code for tokens directly with Google
			console.log('OAuth: Exchanging authorization code for tokens');

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
				console.error(`OAuth: Token exchange failed (${tokenResponse.status}): ${errorText}`);
				
				return new Response(JSON.stringify({
					error: {
						code: 'TOKEN_EXCHANGE_FAILED',
						message: 'Failed to exchange authorization code for tokens',
						reason: 'invalid_code',
					},
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const tokenData = await tokenResponse.json();
			
			// Calculate expiration timestamp
			const expiresAt = tokenData.expires_in 
				? Date.now() + (tokenData.expires_in * 1000)
				: undefined;

			console.log('OAuth: Successfully exchanged authorization code for tokens');

			return new Response(JSON.stringify({
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				expiresIn: tokenData.expires_in,
				expiresAt,
				tokenType: tokenData.token_type || 'Bearer',
				scope: tokenData.scope,
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});

		} catch (error) {
			console.error('OAuth: Token exchange error:', error);
			return new Response(JSON.stringify({
				error: {
					code: 'SERVER_ERROR',
					message: 'Internal server error',
				},
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
};