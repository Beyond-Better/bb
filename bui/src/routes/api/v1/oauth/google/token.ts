import { type FreshContext, Handlers } from '$fresh/server.ts';
import type { FreshAppState } from 'bui/types/state.ts';

/**
 * Handle Google OAuth token operations:
 * 1. Exchange authorization code for tokens using PKCE (Proof Key for Code Exchange - RFC 7636)
 * 2. Refresh access tokens using refresh tokens
 *
 * PKCE eliminates the need for client secrets in public clients like desktop apps.
 * Instead of storing a shared secret, we use cryptographic proof that the same
 * client that initiated the auth flow is completing the token exchange.
 *
 * For token refresh, the client secret is securely handled server-side.
 */
export const handler: Handlers<any, FreshAppState> = {
	async POST(req, ctx: FreshContext<FreshAppState>) {
		const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

		try {
			const body = await req.json();
			const { code, codeVerifier, state: _state, refreshToken, operation } = body;
			//console.log(`OAuth: handling token for ${operation || 'exchange'}`);

			// Determine operation type - refresh or token exchange
			const isRefreshOperation = operation === 'refresh';

			// Validate parameters based on operation type
			if (isRefreshOperation) {
				if (!refreshToken) {
					return new Response(
						JSON.stringify({
							error: {
								code: 'INVALID_REQUEST',
								message: 'Refresh token is required for refresh operation',
								reason: 'missing_refresh_token',
							},
						}),
						{
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						},
					);
				}
			} else {
				// Validate required PKCE parameters for token exchange
				if (!code) {
					return new Response(
						JSON.stringify({
							error: {
								code: 'INVALID_REQUEST',
								message: 'Authorization code is required',
								reason: 'missing_code',
							},
						}),
						{
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						},
					);
				}

				if (!codeVerifier) {
					return new Response(
						JSON.stringify({
							error: {
								code: 'INVALID_REQUEST',
								message: 'PKCE code verifier is required',
								reason: 'missing_code_verifier',
							},
						}),
						{
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						},
					);
				}
			}

			// Get OAuth configuration from state (set by stateConfig plugin)
			const clientId = ctx.state.buiConfig.googleOauth.clientId;
			const clientSecret = ctx.state.buiConfig.googleOauth.clientSecret;
			const redirectUri = ctx.state.buiConfig.googleOauth.redirectUri;
			//console.log(`OAuth: handling token: `, { clientId, clientSecret, redirectUri });

			if (!clientId || !clientSecret || !redirectUri) {
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

			let tokenResponse: Response;
			let operationLog: string;

			if (isRefreshOperation) {
				// Handle token refresh
				operationLog = 'refreshing access token';
				console.log('OAuth: Refreshing access token');
				console.log('OAuth: Using Client ID:', clientId);
				console.log('OAuth: Request body:', {
					refresh_token: refreshToken ? 'present' : 'missing',
					redirectUri,
				});

				tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: new URLSearchParams({
						grant_type: 'refresh_token',
						refresh_token: refreshToken,
						client_id: clientId,
						client_secret: clientSecret,
					}),
				});
			} else {
				// Handle authorization code exchange using PKCE
				operationLog = 'exchanging authorization code for tokens using PKCE';
				console.log('OAuth: Exchanging authorization code for tokens using PKCE');
				console.log('OAuth: Using Client ID:', clientId);
				console.log('OAuth: Request body:', {
					code: code ? 'present' : 'missing',
					codeVerifier: codeVerifier ? 'present' : 'missing',
					redirectUri,
				});

				// // Log the exact parameters being sent to Google
				// const tokenParams = {
				// 	code,
				// 	client_id: clientId,
				// 	client_secret: clientSecret, // Use the actual secret Google provided
				// 	code_verifier: codeVerifier,
				// 	redirect_uri: redirectUri,
				// 	grant_type: 'authorization_code',
				// };
				// console.log('OAuth: Exact token request params:', tokenParams);

				tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: new URLSearchParams({
						code,
						client_id: clientId,
						client_secret: clientSecret, // Empty string for Desktop PKCE
						// PKCE: Use code_verifier instead of client_secret
						code_verifier: codeVerifier,
						redirect_uri: redirectUri,
						grant_type: 'authorization_code',
						// Empty client_secret + PKCE for Desktop apps
					}),
				});
			}

			if (!tokenResponse.ok) {
				const errorText = await tokenResponse.text();
				console.error(`OAuth: ${operationLog} failed (${tokenResponse.status}): ${errorText}`);

				return new Response(
					JSON.stringify({
						error: {
							code: isRefreshOperation ? 'TOKEN_REFRESH_FAILED' : 'TOKEN_EXCHANGE_FAILED',
							message: isRefreshOperation
								? 'Failed to refresh access token'
								: 'Failed to exchange authorization code for tokens using PKCE',
							reason: isRefreshOperation ? 'invalid_refresh_token' : 'invalid_code_or_verifier',
						},
					}),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					},
				);
			}

			const tokenData = await tokenResponse.json();

			// Calculate expiration timestamp
			const expiresAt = tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : undefined;

			console.log(`OAuth: Successfully ${operationLog}`);

			// Return token data in format expected by AuthConfig
			// Note: clientId is not included - it comes from app config, not user credentials
			return new Response(
				JSON.stringify({
					accessToken: tokenData.access_token,
					refreshToken: tokenData.refresh_token,
					expiresIn: tokenData.expires_in,
					expiresAt,
					tokenType: tokenData.token_type || 'Bearer',
					scope: tokenData.scope,
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		} catch (error) {
			console.error('OAuth: Token operation error:', error);
			return new Response(
				JSON.stringify({
					error: {
						code: 'SERVER_ERROR',
						message: 'Internal server error during OAuth token operation',
					},
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	},
	// // GET request is handled by /oauth/google/callback
	/*
	async GET(req, _ctx) {
		// Handle OAuth callback from Google (authorization code in query params)
		try {
			const url = new URL(req.url);
			const code = url.searchParams.get('code');
			const state = url.searchParams.get('state');
			const error = url.searchParams.get('error');

			// Handle OAuth errors
			if (error) {
				console.error('OAuth: Authorization error:', error);
				const errorDescription = url.searchParams.get('error_description') || 'Unknown error';

				// Return HTML page that posts error message to parent window
				return new Response(`
					<!DOCTYPE html>
					<html>
					<head><title>OAuth Error</title></head>
					<body>
						<script>
							window.opener?.postMessage({
								type: 'GOOGLE_OAUTH_ERROR',
								error: '${error}: ${errorDescription}'
							}, window.location.origin);
							window.close();
						</script>
					</body>
					</html>
				`, {
					status: 200,
					headers: { 'Content-Type': 'text/html' },
				});
			}

			// Validate required parameters
			if (!code || !state) {
				console.error('OAuth: Missing required parameters in callback');

				// Return HTML page that posts error message to parent window
				return new Response(`
					<!DOCTYPE html>
					<html>
					<head><title>OAuth Error</title></head>
					<body>
						<script>
							window.opener?.postMessage({
								type: 'GOOGLE_OAUTH_ERROR',
								error: 'Missing authorization code or state parameter'
							}, window.location.origin);
							window.close();
						</script>
					</body>
					</html>
				`, {
					status: 200,
					headers: { 'Content-Type': 'text/html' },
				});
			}

			console.log('OAuth: Received authorization callback with code and state');

			// Return HTML page that posts success message to parent window
			return new Response(`
				<!DOCTYPE html>
				<html>
				<head><title>OAuth Success</title></head>
				<body>
					<script>
						window.opener?.postMessage({
							type: 'GOOGLE_OAUTH_SUCCESS',
							code: '${code}',
							state: '${state}'
						}, window.location.origin);
						window.close();
					</script>
				</body>
				</html>
			`, {
				status: 200,
				headers: { 'Content-Type': 'text/html' },
			});

		} catch (error) {
			console.error('OAuth: Callback handling error:', error);

			// Return HTML page that posts error message to parent window
			return new Response(`
				<!DOCTYPE html>
				<html>
				<head><title>OAuth Error</title></head>
				<body>
					<script>
						window.opener?.postMessage({
							type: 'GOOGLE_OAUTH_ERROR',
							error: 'Internal error handling OAuth callback'
						}, window.location.origin);
						window.close();
					</script>
				</body>
				</html>
			`, {
				status: 200,
				headers: { 'Content-Type': 'text/html' },
			});
		}
	},
 */
};
