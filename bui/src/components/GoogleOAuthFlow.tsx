import { useState } from 'preact/hooks';
import type { AuthConfig } from 'api/dataSources/interfaces/authentication.ts';
import { LoadingSpinner } from './LoadingSpinner.tsx';

interface GoogleOAuthFlowProps {
	onAuth: (authConfig: AuthConfig) => void;
	onError: (error: string) => void;
	authConfig?: AuthConfig;
	className?: string;
}

interface OAuthTokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	scope: string;
	token_type: string;
}

/**
 * Component for handling Google OAuth flow in BUI.
 *
 * Features:
 * - Popup-based OAuth authentication
 * - Required scopes for Google Docs and Drive access
 * - Token exchange and validation
 * - Loading states and error handling
 * - Re-authentication support
 *
 * @example
 * <GoogleOAuthFlow
 *   onAuth={(authConfig) => handleAuth(authConfig)}
 *   onError={(error) => setError(error)}
 *   authConfig={existingAuth}
 * />
 */
export function GoogleOAuthFlow({ onAuth, onError, authConfig, className = '' }: GoogleOAuthFlowProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isAuthenticated, setIsAuthenticated] = useState(!!authConfig?.tokenData?.refreshToken);

	// Required scopes for Google Docs and Drive access
	const REQUIRED_SCOPES = [
		'https://www.googleapis.com/auth/documents',
		'https://www.googleapis.com/auth/drive.readonly',
		'https://www.googleapis.com/auth/drive.file',
	].join(' ');

	// OAuth endpoints
	const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
	const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

	/**
	 * Get OAuth configuration from BUI endpoint
	 */
	const getOAuthConfig = async () => {
		try {
			const response = await fetch('/api/v1/oauth/google/config');
			if (!response.ok) {
				throw new Error('Failed to get OAuth configuration');
			}
			const config = await response.json();
			return {
				clientId: config.clientId,
				clientSecret: '', // Don't expose client secret in frontend
				redirectUri: config.redirectUri || globalThis.location.origin + '/oauth/google/callback',
			};
		} catch (error) {
			throw new Error('OAuth configuration not available. Please check your server configuration.');
		}
	};

	/**
	 * Generate OAuth authorization URL
	 */
	const generateAuthUrl = (clientId: string, redirectUri: string, state: string) => {
		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: REQUIRED_SCOPES,
			access_type: 'offline',
			prompt: 'consent',
			state: state,
		});

		return `${GOOGLE_AUTH_URL}?${params.toString()}`;
	};

	/**
	 * Handle OAuth popup flow
	 */
	const handleOAuthFlow = async () => {
		setIsLoading(true);

		try {
			// Get OAuth configuration
			const oauthConfig = await getOAuthConfig();

			// Generate state parameter for security
			const state = crypto.randomUUID();

			// Generate authorization URL
			const authUrl = generateAuthUrl(oauthConfig.clientId, oauthConfig.redirectUri, state);

			// Open popup window
			const popup = globalThis.open(
				authUrl,
				'google-oauth',
				'width=500,height=600,scrollbars=yes,resizable=yes',
			);

			if (!popup) {
				throw new Error('Popup blocked. Please allow popups for this site and try again.');
			}

			// Listen for the OAuth callback
			const authResult = await waitForOAuthCallback(popup, state);

			// Exchange authorization code for tokens
			const tokens = await exchangeCodeForTokens(authResult.code, state);

			// Create AuthConfig object
			const authConfig: AuthConfig = {
				method: 'oauth2',
				credentials: {
					accessToken: tokens.access_token,
					clientId: oauthConfig.clientId,
					clientSecret: oauthConfig.clientSecret,
				},
				tokenData: {
					refreshToken: tokens.refresh_token || '',
					expiresAt: Date.now() + (tokens.expires_in * 1000),
					scope: tokens.scope,
				},
			};

			setIsAuthenticated(true);
			onAuth(authConfig);
		} catch (error) {
			console.error('OAuth flow error:', error);
			onError(error instanceof Error ? error.message : 'Authentication failed');
		} finally {
			setIsLoading(false);
		}
	};

	/**
	 * Wait for OAuth callback from popup
	 */
	const waitForOAuthCallback = (popup: Window, expectedState: string): Promise<{ code: string; state: string }> => {
		return new Promise((resolve, reject) => {
			const checkClosed = setInterval(() => {
				if (popup.closed) {
					clearInterval(checkClosed);
					reject(new Error('Authentication cancelled by user'));
				}
			}, 1000);

			// Listen for message from popup
			const messageHandler = (event: MessageEvent) => {
				// Verify origin for security
				if (event.origin !== globalThis.location.origin) {
					return;
				}

				if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
					clearInterval(checkClosed);
					globalThis.removeEventListener('message', messageHandler);
					popup.close();

					// Verify state parameter
					if (event.data.state !== expectedState) {
						reject(new Error('Invalid state parameter. Possible CSRF attack.'));
						return;
					}

					resolve({
						code: event.data.code,
						state: event.data.state,
					});
				} else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
					clearInterval(checkClosed);
					globalThis.removeEventListener('message', messageHandler);
					popup.close();
					reject(new Error(event.data.error || 'Authentication failed'));
				}
			};

			globalThis.addEventListener('message', messageHandler);
		});
	};

	/**
	 * Exchange authorization code for access tokens
	 */
	const exchangeCodeForTokens = async (code: string, state: string): Promise<OAuthTokenResponse> => {
		try {
			const response = await fetch('/api/v1/oauth/google/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ code, state }),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error?.message || 'Failed to exchange authorization code');
			}

			const result = await response.json();
			return {
				access_token: result.accessToken,
				refresh_token: result.refreshToken,
				expires_in: result.expiresIn,
				scope: result.scope,
				token_type: result.tokenType,
			};
		} catch (error) {
			throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	/**
	 * Handle disconnection/re-authentication
	 */
	const handleDisconnect = () => {
		setIsAuthenticated(false);
		onAuth({
			method: 'oauth2',
			credentials: {
				clientId: '',
				clientSecret: '',
				accessToken: '',
			},
			tokenData: undefined,
		});
	};

	/**
	 * Check if current authentication is valid
	 */
	const isAuthValid = () => {
		if (!authConfig?.tokenData) return false;
		return authConfig.tokenData.expiresAt > Date.now();
	};

	const authStatus = isAuthenticated && isAuthValid() ? 'connected' : 'disconnected';

	return (
		<div className={`space-y-4 ${className}`}>
			<div className='space-y-2'>
				<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
					Google Authentication
				</label>

				{/* Authentication Status */}
				<div className='flex items-center space-x-2'>
					<div
						className={`w-2 h-2 rounded-full ${
							authStatus === 'connected' ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400'
						}`}
					/>
					<span
						className={`text-sm ${
							authStatus === 'connected'
								? 'text-green-700 dark:text-green-300'
								: 'text-red-700 dark:text-red-300'
						}`}
					>
						{authStatus === 'connected' ? 'Connected to Google' : 'Not connected'}
					</span>
				</div>

				{/* Scope Information */}
				{authStatus === 'connected' && authConfig?.tokenData?.scope && (
					<div className='text-xs text-gray-500 dark:text-gray-400'>
						Scopes: {authConfig.tokenData.scope}
					</div>
				)}
			</div>

			{/* Authentication Button */}
			<div className='flex space-x-2'>
				{authStatus === 'disconnected'
					? (
						<button
							type='button'
							onClick={handleOAuthFlow}
							disabled={isLoading}
							className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed'
						>
							{isLoading
								? (
									<>
										<LoadingSpinner className='w-4 h-4 mr-2' />
										Authenticating...
									</>
								)
								: (
									<>
										<svg className='w-4 h-4 mr-2' viewBox='0 0 24 24'>
											<path
												fill='currentColor'
												d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
											/>
											<path
												fill='currentColor'
												d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
											/>
											<path
												fill='currentColor'
												d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
											/>
											<path
												fill='currentColor'
												d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
											/>
										</svg>
										Authenticate with Google
									</>
								)}
						</button>
					)
					: (
						<button
							type='button'
							onClick={handleDisconnect}
							className='inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
						>
							Disconnect
						</button>
					)}

				{authStatus === 'connected' && !isAuthValid() && (
					<button
						type='button'
						onClick={handleOAuthFlow}
						disabled={isLoading}
						className='inline-flex items-center px-4 py-2 border border-yellow-300 dark:border-yellow-600 text-sm font-medium rounded-md shadow-sm text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500'
					>
						{isLoading
							? (
								<>
									<LoadingSpinner className='w-4 h-4 mr-2' />
									Re-authenticating...
								</>
							)
							: (
								'Re-authenticate'
							)}
					</button>
				)}
			</div>

			{/* Help Text */}
			<div className='text-xs text-gray-500 dark:text-gray-400'>
				<p>Required permissions:</p>
				<ul className='list-disc list-inside ml-2 mt-1'>
					<li>View and manage Google Docs documents</li>
					<li>View Google Drive files</li>
					<li>Create and edit files in Google Drive</li>
				</ul>
			</div>
		</div>
	);
}
