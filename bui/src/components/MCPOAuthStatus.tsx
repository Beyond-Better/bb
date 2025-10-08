import type { MCPServerConfig } from 'shared/config/types.ts';
import { useEffect, useState } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState.ts';

interface OAuthConfigStatus {
	serverId: string;
	hasOAuth: boolean;
	grantType?: string;
	configurationStatus: 'complete' | 'missing_client_credentials' | 'discovery_failed';
	supportsDynamicRegistration: boolean;
	dynamicRegistrationStatus: 'successful' | 'failed' | 'not_attempted' | 'not_supported';
	discoveredEndpoints?: {
		authorization_endpoint?: string;
		token_endpoint?: string;
		registration_endpoint?: string;
	};
	hasClientCredentials: boolean;
	hasAccessToken: boolean;
}

interface MCPOAuthStatusProps {
	server: MCPServerConfig;
	mode?: 'compact' | 'full';
}

export default function MCPOAuthStatus({ server, mode = 'full' }: MCPOAuthStatusProps) {
	const appState = useAppState();
	const [oauthConfig, setOauthConfig] = useState<OAuthConfigStatus | null>(null);
	const [isLoadingConfig, setIsLoadingConfig] = useState(true);

	// Load OAuth configuration status
	useEffect(() => {
		const loadOAuthConfig = async () => {
			if (!appState.value.apiClient || server.transport !== 'http' || !server.oauth) {
				console.log('MCPOAuthStatus: OAuth config load skipped', {
					hasApiClient: !!appState.value.apiClient,
					transport: server.transport,
					hasOAuth: !!server.oauth,
				});
				setIsLoadingConfig(false);
				return;
			}

			console.log('MCPOAuthStatus: Starting OAuth discovery for server:', server.id);

			try {
				setIsLoadingConfig(true);

				const config = await appState.value.apiClient.mcpServerOAuthConfig(server.id);

				console.log('MCPOAuthStatus: OAuth discovery complete', {
					serverId: server.id,
					configurationStatus: config?.configurationStatus,
					dynamicRegistrationStatus: config?.dynamicRegistrationStatus,
					supportsDynamicRegistration: config?.supportsDynamicRegistration,
					hasClientCredentials: config?.hasClientCredentials,
				});

				setOauthConfig(config);
			} catch (error) {
				console.error('MCPOAuthStatus: OAuth discovery failed:', error);
			} finally {
				setIsLoadingConfig(false);
			}
		};

		loadOAuthConfig();
	}, [server.id, server.transport, server.oauth, server.oauth?.accessToken, appState.value.apiClient]);

	// Only show OAuth status for HTTP transport with OAuth enabled
	if (server.transport !== 'http' || !server.oauth) {
		return null;
	}

	// Show loading state
	if (isLoadingConfig) {
		if (mode === 'compact') {
			return (
				<span className='text-xs text-gray-500 dark:text-gray-400'>
					⏳ Loading OAuth config...
				</span>
			);
		}
		return (
			<div className='border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20'>
				<div className='flex items-center space-x-2'>
					<div className='animate-pulse h-4 w-4 bg-blue-300 dark:bg-blue-600 rounded'></div>
					<span className='text-sm text-gray-600 dark:text-gray-400'>Loading OAuth configuration...</span>
				</div>
			</div>
		);
	}

	const hasAccessToken = !!server.oauth.accessToken;

	// Configuration status indicators
	const configComplete = oauthConfig?.configurationStatus === 'complete';
	const supportsDynamicReg = oauthConfig?.supportsDynamicRegistration ?? false;
	const dynamicRegSuccess = oauthConfig?.dynamicRegistrationStatus === 'successful';
	const dynamicRegFailed = oauthConfig?.dynamicRegistrationStatus === 'failed';
	const hasClientCredentials = oauthConfig?.hasClientCredentials ?? false;

	// Compact mode for display views
	if (mode === 'compact') {
		return (
			<div className='flex items-center space-x-2'>
				{/* Configuration status */}
				{!configComplete && (
					<span className='text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded'>
						⚠️ Config needed
					</span>
				)}

				{/* Dynamic registration status */}
				{supportsDynamicReg && (
					<span
						className={`text-xs px-2 py-0.5 rounded ${
							dynamicRegSuccess
								? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
								: dynamicRegFailed
								? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
								: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
						}`}
						title={dynamicRegSuccess
							? 'BB successfully registered with the MCP server automatically'
							: dynamicRegFailed
							? 'Automatic registration with MCP server failed - manual configuration required'
							: 'BB is attempting to register with the MCP server automatically'}
					>
						{dynamicRegSuccess
							? '✅ Auto-registered'
							: dynamicRegFailed
							? '❌ Auto-reg failed'
							: '🔧 Auto-reg'}
					</span>
				)}

				{/* Authentication status indicator */}
				<span
					className={`text-xs px-2 py-0.5 rounded ${
						hasAccessToken
							? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
							: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
					}`}
					title={hasAccessToken
						? 'Authentication with external service completed - BB has valid access tokens'
						: 'Authentication with external service is pending - user authorization required'}
				>
					{hasAccessToken ? '🟢 Auth Complete' : '🔴 Auth Pending'}
				</span>
			</div>
		);
	}

	// Full mode for configuration forms (display-only)
	return (
		<div className='border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20'>
			<div className='flex items-center justify-between mb-3'>
				<h4 className='text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center'>
					<svg
						className='h-4 w-4 mr-2 text-blue-600 dark:text-blue-400'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
						/>
					</svg>
					OAuth Connection Status
				</h4>

				<div className='flex items-center space-x-2'>
					{/* Authentication Status */}
					<span
						className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
							hasAccessToken
								? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
								: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
						}`}
						title={hasAccessToken
							? 'Authentication completed - valid access tokens available'
							: 'Authentication required - no valid access tokens'}
					>
						{hasAccessToken ? '🟢 Auth Complete' : '🔴 Auth Required'}
					</span>

					{/* Dynamic Registration Status */}
					{supportsDynamicReg && (
						<span
							className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
								dynamicRegSuccess
									? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
									: dynamicRegFailed
									? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
									: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
							}`}
							title={dynamicRegSuccess
								? 'BB successfully registered as an OAuth client with the MCP server automatically'
								: dynamicRegFailed
								? 'Automatic client registration failed - using manual configuration'
								: 'BB is attempting automatic client registration with the MCP server'}
						>
							{dynamicRegSuccess
								? '⚙️ Auto-Registered'
								: dynamicRegFailed
								? '⚠️ Manual Config'
								: '🔄 Registering...'}
						</span>
					)}
				</div>
			</div>

			<div className='space-y-4'>
				{/* OAuth Configuration Status */}
				{oauthConfig && (
					<div className='bg-gray-50 dark:bg-gray-800 rounded-md p-3 space-y-2'>
						<h5 className='text-sm font-medium text-gray-900 dark:text-gray-100'>Configuration Status</h5>
						<div className='grid grid-cols-1 gap-2 text-xs'>
							<div className='flex justify-between'>
								<span className='text-gray-600 dark:text-gray-400'>Discovery:</span>
								<span
									className={`font-medium ${
										oauthConfig.discoveredEndpoints
											? 'text-green-600 dark:text-green-400'
											: 'text-yellow-600 dark:text-yellow-400'
									}`}
								>
									{oauthConfig.discoveredEndpoints ? 'Success' : 'Fallback endpoints'}
								</span>
							</div>
							<div className='flex justify-between'>
								<span className='text-gray-600 dark:text-gray-400'>Dynamic Registration:</span>
								<span
									className={`font-medium ${
										dynamicRegSuccess
											? 'text-green-600 dark:text-green-400'
											: dynamicRegFailed
											? 'text-red-600 dark:text-red-400'
											: supportsDynamicReg
											? 'text-yellow-600 dark:text-yellow-400'
											: 'text-gray-600 dark:text-gray-400'
									}`}
								>
									{dynamicRegSuccess
										? 'Successful'
										: dynamicRegFailed
										? 'Failed'
										: supportsDynamicReg
										? 'Available'
										: 'Not supported'}
								</span>
							</div>
							<div className='flex justify-between'>
								<span className='text-gray-600 dark:text-gray-400'>Client Credentials:</span>
								<span
									className={`font-medium ${
										hasClientCredentials
											? 'text-green-600 dark:text-green-400'
											: 'text-red-600 dark:text-red-400'
									}`}
								>
									{hasClientCredentials ? 'Configured' : 'Missing'}
								</span>
							</div>
							{oauthConfig.discoveredEndpoints && (
								<div className='pt-2 border-t border-gray-200 dark:border-gray-600'>
									<div className='text-xs text-gray-500 dark:text-gray-400 space-y-1'>
										{oauthConfig.discoveredEndpoints.authorization_endpoint && (
											<div>Auth: {oauthConfig.discoveredEndpoints.authorization_endpoint}</div>
										)}
										{oauthConfig.discoveredEndpoints.token_endpoint && (
											<div>Token: {oauthConfig.discoveredEndpoints.token_endpoint}</div>
										)}
										{oauthConfig.discoveredEndpoints.registration_endpoint && (
											<div>
												Registration: {oauthConfig.discoveredEndpoints.registration_endpoint}
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Grant Type Info */}
				<div className='text-sm text-gray-600 dark:text-gray-400'>
					<strong>Grant Type:</strong> {server.oauth.grantType.replace('_', ' ').toUpperCase()}
					{server.oauth.grantType === 'authorization_code' && ' (requires user authorization)'}
					{server.oauth.grantType === 'client_credentials' && ' (automatic app-to-app)'}
				</div>

				{/* Informational Notes */}
				{server.oauth.grantType === 'authorization_code' && !hasAccessToken && (
					<div className='text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded'>
						<strong>Authorization Required:</strong>{' '}
						Use the "Authorize" button in the server list to complete the OAuth flow.
					</div>
				)}

				{server.oauth.grantType === 'client_credentials' && !hasAccessToken && (
					<div className='text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded'>
						<strong>Client Credentials Flow:</strong>{' '}
						Use the "Authorize" button in the server list to connect automatically using your configured
						credentials.
					</div>
				)}
			</div>
		</div>
	);
}
