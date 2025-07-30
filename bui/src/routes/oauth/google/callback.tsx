import { type PageProps } from '$fresh/server.ts';

export default function GoogleOAuthCallback({ url }: PageProps) {
	// Extract query parameters
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	return (
		<html>
			<head>
				<title>Google OAuth Callback</title>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<style>{`
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
						border-top: 4px solid #4285f4;
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
						color: #d93025;
						margin-top: 10px;
					}
					.logo {
						width: 24px;
						height: 24px;
						margin-right: 8px;
						vertical-align: middle;
					}
				`}</style>
			</head>
			<body>
				<div className="container">
					<div className="spinner" id="spinner"></div>
					<p id="message">Processing authentication...</p>
					<p id="result" style={{ display: 'none' }}></p>
				</div>

				<script dangerouslySetInnerHTML={{
					__html: `
						(function() {
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
								
								if (error) {
									const errorMessage = errorDescription || error || 'Authentication failed';
									showError('Authentication failed: ' + errorMessage);

									// Send error message to parent window
									window.opener.postMessage({
										type: 'GOOGLE_OAUTH_ERROR',
										error: errorMessage
									}, window.location.origin);

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
										type: 'GOOGLE_OAUTH_SUCCESS',
										code: code,
										state: state
									}, window.location.origin);

									// Close popup after short delay
									setTimeout(() => window.close(), 1500);
								} else {
									showError('No authorization code received');

									window.opener.postMessage({
										type: 'GOOGLE_OAUTH_ERROR',
										error: 'No authorization code received'
									}, window.location.origin);

									setTimeout(() => window.close(), 3000);
								}
							} catch (err) {
								console.error('OAuth callback error:', err);
								showError('An unexpected error occurred');

								if (window.opener) {
									window.opener.postMessage({
										type: 'GOOGLE_OAUTH_ERROR',
										error: 'An unexpected error occurred'
									}, window.location.origin);
								}

								setTimeout(() => window.close(), 3000);
							}
						})();
					`
				}} />
			</body>
		</html>
	);
}