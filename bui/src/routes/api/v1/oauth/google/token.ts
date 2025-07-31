import { Handlers } from '$fresh/server.ts';

/**
 * Exchange authorization code for Google OAuth tokens using PKCE
 * (Proof Key for Code Exchange - RFC 7636)
 * 
 * PKCE eliminates the need for client secrets in public clients like desktop apps.
 * Instead of storing a shared secret, we use cryptographic proof that the same
 * client that initiated the auth flow is completing the token exchange.
 */
export const handler: Handlers = {
	async POST(req, _ctx) {
		try {
			const body = await req.json();
			const { code, codeVerifier, state } = body;

			// Validate required PKCE parameters
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

			if (!codeVerifier) {
				return new Response(JSON.stringify({
					error: {
						code: 'INVALID_REQUEST',
						message: 'PKCE code verifier is required',
						reason: 'missing_code_verifier',
					},
				}), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Get OAuth configuration from environment variables
			// Note: clientId is application-level config, same for all users
			const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') || '';
			const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') || '';
			const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') || 
				'https://localhost:8080/oauth/google/callback';
				//'https://chat.beyondbetter.app/oauth/google/callback';

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

			// Exchange authorization code for tokens using PKCE
			console.log('OAuth: Exchanging authorization code for tokens using PKCE');
			console.log('OAuth: Using Client ID:', clientId);
			console.log('OAuth: Request body:', { code: code ? 'present' : 'missing', codeVerifier: codeVerifier ? 'present' : 'missing', redirectUri });
			
			// Log the exact parameters being sent to Google
			const tokenParams = {
				code,
				client_id: clientId,
				code_verifier: codeVerifier,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code',
				// Temporary: Some Desktop clients still expect empty client_secret
				client_secret: clientSecret, // Use the actual secret Google provided
			};
			console.log('OAuth: Exact token request params:', tokenParams);

			const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					code,
					client_id: clientId,
					client_secret: '', // Empty string for Desktop PKCE
					// PKCE: Use code_verifier instead of client_secret
					code_verifier: codeVerifier, 
					redirect_uri: redirectUri,
					grant_type: 'authorization_code',
					// Empty client_secret + PKCE for Desktop apps
				}),
			});

			if (!tokenResponse.ok) {
				const errorText = await tokenResponse.text();
				console.error(`OAuth: PKCE token exchange failed (${tokenResponse.status}): ${errorText}`);
				
				return new Response(JSON.stringify({
					error: {
						code: 'TOKEN_EXCHANGE_FAILED',
						message: 'Failed to exchange authorization code for tokens using PKCE',
						reason: 'invalid_code_or_verifier',
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

			console.log('OAuth: Successfully exchanged authorization code for tokens using PKCE');

			// Return token data in format expected by AuthConfig
			// Note: clientId is not included - it comes from app config, not user credentials
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
			console.error('OAuth: PKCE token exchange error:', error);
			return new Response(JSON.stringify({
				error: {
					code: 'SERVER_ERROR',
					message: 'Internal server error during PKCE token exchange',
				},
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
};