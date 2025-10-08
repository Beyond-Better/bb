import type { PageProps } from '$fresh/server.ts';
import { IS_BROWSER } from '$fresh/runtime.ts';

export default function McpOAuthCallback({ params, url }: PageProps) {
	// Extract serverId from route parameters
	const { serverId } = params;

	// Debug logging - server side
	console.log('='.repeat(50));
	console.log('[MCP OAuth Callback] SERVER-SIDE Route reached!');
	console.log('[MCP OAuth Callback] serverId:', serverId);
	console.log('[MCP OAuth Callback] Full URL:', url.toString());
	console.log('[MCP OAuth Callback] Query params:', {
		code: url.searchParams.get('code'),
		state: url.searchParams.get('state'),
		error: url.searchParams.get('error'),
		error_description: url.searchParams.get('error_description'),
	});
	console.log('='.repeat(50));

	// Extract OAuth query parameters
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state') || '';
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	// Parse state data to get CSRF token and origin
	let stateData: { csrf?: string; origin?: string; isDui?: boolean } = {};
	try {
		if (state) {
			stateData = JSON.parse(atob(state));
		}
	} catch (e) {
		console.error('Failed to parse state data:', e);
	}
	const targetOrigin = stateData.origin || globalThis.location.origin;
	const isDui = stateData.isDui || false;

	const scriptCode = isDui
		? `// Import Tauri API
			import { invoke } from 'https://esm.sh/@tauri-apps/api@2.8.0/core';

			(async function() {
				const messageEl = document.getElementById('message');
				const resultEl = document.getElementById('result');
				const spinnerEl = document.getElementById('spinner');

				function hideSpinner() {
					spinnerEl.style.display = 'none';
					resultEl.style.display = 'block';
				}

				function showSuccess(message) {
					hideSpinner();
					messageEl.style.display = 'none';
					resultEl.className = 'success';
					resultEl.textContent = message;
				}

				function showError(message) {
					hideSpinner();
					messageEl.style.display = 'none';
					resultEl.className = 'error';
					resultEl.textContent = message;
				}

				try {
					// Extract OAuth parameters
					const serverId = ${JSON.stringify(serverId)};
					const code = ${JSON.stringify(code)};
					const state = ${JSON.stringify(state)};
					const error = ${JSON.stringify(error)};
					const errorDescription = ${JSON.stringify(errorDescription)};

					if (error) {
						const errorMessage = errorDescription || error || 'MCP authentication failed';
						showError('MCP authentication failed: ' + errorMessage);

						// Send error to main window via Tauri
						await invoke('complete_oauth_flow', {
							result: {
								success: false,
								provider: 'mcp',
								serverId: serverId,
								error: errorMessage
							}
						});
						return;
					}

					if (!code) {
						showError('No authorization code received from MCP server');
						await invoke('complete_oauth_flow', {
							result: {
								success: false,
								provider: 'mcp',
								serverId: serverId,
								error: 'No authorization code received'
							}
						});
						return;
					}

					showSuccess('MCP authentication successful! Closing window...');

					// Send success result to main window via Tauri
					// The main window will handle the token exchange with proper API context
					await invoke('complete_oauth_flow', {
						result: {
							success: true,
							provider: 'mcp',
							serverId: serverId,
							code: code,
							state: state
						}
					});

				} catch (err) {
					console.error('Tauri MCP OAuth callback error:', err);
					const errorMessage = err instanceof Error ? err.message : (err || 'An unexpected error occurred');
					showError('Authentication failed: ' + errorMessage);

					try {
						await invoke('complete_oauth_flow', {
							result: {
								success: false,
								provider: 'mcp',
								serverId: ${JSON.stringify(serverId)},
								error: errorMessage,
							}
						});
					} catch (invokeErr) {
						console.error('Failed to invoke complete_oauth_flow:', invokeErr);
					}
				}
			})();
		`
		: `(function() {
				const messageEl = document.getElementById('message');
				const resultEl = document.getElementById('result');
				const spinnerEl = document.getElementById('spinner');
	
				function hideSpinner() {
					spinnerEl.style.display = 'none';
					resultEl.style.display = 'block';
				}
	
				function showSuccess(message) {
					hideSpinner();
					messageEl.style.display = 'none';
					resultEl.className = 'success';
					resultEl.textContent = message;
				}
	
				function showError(message) {
					hideSpinner();
					messageEl.style.display = 'none';
					resultEl.className = 'error';
					resultEl.textContent = message;
				}
	
				try {
					// Check if we have a parent window (popup scenario)
					if (!window.opener) {
						showError('This window should be opened as a popup.');
						return;
					}
	
					// Handle OAuth error
					const error = ${JSON.stringify(error)};
					const errorDescription = ${JSON.stringify(errorDescription)};
					const serverId = ${JSON.stringify(serverId)};
					
					const targetOrigin = ${JSON.stringify(targetOrigin)};
					
					if (error) {
						const errorMessage = errorDescription || error || 'MCP authentication failed';
						showError('MCP authentication failed: ' + errorMessage);
	
						// Send error message to parent window
						window.opener.postMessage({
							type: 'MCP_OAUTH_ERROR',
							serverId: serverId,
							error: errorMessage
						}, targetOrigin);
	
						// Close popup after delay
						setTimeout(() => window.close(), 3000);
						return;
					}
	
					// Handle successful OAuth
					const code = ${JSON.stringify(code)};
					const state = ${JSON.stringify(state)};
					
					if (code) {
						showSuccess('Authentication successful! Closing window...');

						// Send success message to parent window
						window.opener.postMessage({
							type: 'MCP_OAUTH_SUCCESS',
							serverId: serverId,
							code: code,
							state: state
						}, targetOrigin);

						// Close popup after short delay
						setTimeout(() => window.close(), 1500);
					} else {
						showError('No authorization code received');

						window.opener.postMessage({
							type: 'MCP_OAUTH_ERROR',
							serverId: serverId,
							error: 'No authorization code received'
						}, targetOrigin);

						setTimeout(() => window.close(), 3000);
					}
	
				} catch (err) {
					console.error('MCP OAuth callback error:', err);
					showError('An unexpected error occurred');
	
					if (window.opener) {
						window.opener.postMessage({
							type: 'MCP_OAUTH_ERROR',
							serverId: ${JSON.stringify(serverId)},
							error: 'An unexpected error occurred'
						}, targetOrigin);
					}
	
					//setTimeout(() => window.close(), 5000);
				}
			})();
		`;

	return (
		<html>
			<head>
				<title>MCP OAuth Callback</title>
				<meta charset='UTF-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1.0' />
				<style>
					{`
					body {
						font-family: system-ui, -apple-system, sans-serif;
						display: flex;
						align-items: center;
						justify-content: center;
						height: 100vh;
						margin: 0;
						background-color: #f5f5f5;
					}
					.container {
						text-align: center;
						padding: 20px;
						background: white;
						border-radius: 8px;
						box-shadow: 0 2px 10px rgba(0,0,0,0.1);
						max-width: 400px;
					}
					.spinner {
						border: 4px solid #f3f3f3;
						border-top: 4px solid #3b82f6;
						border-radius: 50%;
						width: 30px;
						height: 30px;
						animation: spin 1s linear infinite;
						margin: 0 auto 20px;
					}
					@keyframes spin {
						0% { transform: rotate(0deg); }
						100% { transform: rotate(360deg); }
					}
					.success {
						color: #059669;
						margin-top: 10px;
					}
					.error {
						color: #dc2626;
						margin-top: 10px;
					}
					.server-id {
						font-size: 12px;
						color: #6b7280;
						margin-top: 5px;
					}
				`}
				</style>
			</head>
			<body>
				<div className='container'>
					<div className='spinner' id='spinner'></div>
					<p id='message'>Processing MCP authentication...</p>
					<p id='result' style={{ display: 'none' }}></p>
					{serverId && (
						<div className='server-id'>
							Server: {serverId}
						</div>
					)}
				</div>

				<script
					type='module'
					dangerouslySetInnerHTML={{
						__html: scriptCode,
					}}
				/>
			</body>
		</html>
	);
}
