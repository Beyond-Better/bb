import type { Context } from '@oak/oak';
import { ConfigManager } from 'shared/configManager.ts';
import type { FullConfigSchema } from 'shared/configSchema.ts';
import { readFromBbDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { getCertificateInfo } from 'shared/tlsCerts.ts';
//import { logger } from 'shared/logger.ts';

type ExpiryStatus = 'valid' | 'expiring' | 'expired';
type SupportedPlatform = 'darwin' | 'windows' | 'linux';

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZoneName: 'short',
	}).format(date);
}

function getExpiryStatus(validTo: Date): ExpiryStatus {
	const now = new Date();
	const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

	if (validTo < now) {
		return 'expired';
	}
	if (validTo.getTime() - now.getTime() < thirtyDays) {
		return 'expiring';
	}
	return 'valid';
}

function getExpiryStatusColor(status: ExpiryStatus): string {
	switch (status) {
		case 'valid':
			return '#059669';
		case 'expiring':
			return '#d97706';
		case 'expired':
			return '#dc2626';
	}
}

function getExpiryStatusText(status: ExpiryStatus): string {
	switch (status) {
		case 'valid':
			return 'Valid';
		case 'expiring':
			return 'Expiring Soon';
		case 'expired':
			return 'Expired';
	}
}

interface StatusData {
	platform: string;
	platformDisplay: string;
	trustStoreLocation?: string;
	status: string;
	message: string;
	tls: {
		enabled: boolean;
		certType?: 'custom' | 'self-signed';
		certPath?: string;
		certSource?: 'config' | 'project' | 'global';
		validFrom?: string;
		validUntil?: string;
		issuer?: string;
		subject?: string;
		expiryStatus?: ExpiryStatus;
	};
	configType: 'project' | 'global';
	projectName?: string;
}

function getHtmlResponse(statusData: StatusData): string {
	return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>BB API Status</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #f9fafb;
          }
          
          .platform-info {
            background: #f3f4f6;
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 1rem;
          }
          
          .cert-info.self-signed {
            border-left: 4px solid #d97706;
          }
          
          .trust-store {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            padding: 1.25rem;
            margin: 1.5rem 0;
          }

          .trust-store h3 {
            margin: 0 0 1rem 0;
            color: #1f2937;
            font-size: 1.1rem;
          }

          .trust-store p {
            margin: 0.5rem 0;
          }

          .trust-store code {
            background: #e5e7eb;
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
            font-family: ui-monospace, monospace;
          }

          .old-trust-store {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            padding: 1.25rem;
            margin: 1rem 0;
          }
          
          .trust-store h3 {
            margin-top: 0;
            color: #1f2937;
          }
          
          .platform-command {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            padding: 1rem;
            margin: 1rem 0;
            color: #1f2937;
          }

          .platform-command ol {
            margin: 0.5rem 0 0 0;
            padding-left: 1.5rem;
          }

          .platform-command li {
            margin: 0.25rem 0;
          }

          .terminal-command {
            background: #1f2937;
            color: #e5e7eb;
            padding: 0.75rem 1rem;
            border-radius: 0.375rem;
            font-family: ui-monospace, monospace;
            margin: 0.5rem 0;
            overflow-x: auto;
          }
          
          .status { color: #059669; font-weight: bold; }
          .warning { 
            background: #fef3c7;
            border-left: 4px solid #d97706;
            padding: 1rem;
            margin: 1rem 0;
          }
          
          code {
            background: #e5e7eb;
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
          }
          
          .cert-info {
            background: #fff;
            padding: 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
          }
          .config-type {
            display: inline-block;
            background: #e5e7eb;
            padding: 0.2rem 0.6rem;
            border-radius: 1rem;
            font-size: 0.875em;
            margin-left: 0.5rem;
          }
          
          .cert-source {
            font-size: 0.875em;
            color: #6b7280;
            margin-bottom: 1.5rem;
          }
          
          .validity-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            padding: 1.25rem;
            margin: 1.5rem 0;
          }
          
          .validity-info p {
            margin: 0.5rem 0;
          }
          
          .expiry-status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
            margin-top: 1rem !important;
            padding-top: 1rem;
            border-top: 1px solid #e2e8f0;
          }
          
          .expiry-status::before {
            content: "";
            display: inline-block;
            width: 0.75rem;
            height: 0.75rem;
            border-radius: 50%;
            background-color: currentColor;
          }
          
          .cert-details {
            margin: 1.5rem 0;
          }

          .cert-details h3 {
            margin-top: 0;
            color: #1f2937;
            font-size: 1.1rem;
          }

          .help-section {
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 1.25rem;
            margin: 1.5rem 0;
          }

          .help-section h3 {
            margin: 0 0 1rem 0;
            color: #1f2937;
            font-size: 1.1rem;
          }

          .browser-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .browser-list li {
            margin: 1rem 0;
            padding-left: 2rem;
            position: relative;
          }

          .browser-list li::before {
            content: '';
            width: 1.25rem;
            height: 1.25rem;
            position: absolute;
            left: 0;
            top: 0.125rem;
            background-size: contain;
            background-repeat: no-repeat;
          }

          .chrome::before {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%234285F4" d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0z"/><path fill="%2334A853" d="M12 24c3.79 0 7.169-1.757 9.368-4.501l-3.953-6.848A5.454 5.454 0 0 1 12 17.455H1.309A12 12 0 0 0 12 24z"/><path fill="%23EA4335" d="M2.632 4.501A11.947 11.947 0 0 0 0 12c0 1.648.333 3.218.936 4.648l5.063-8.778A5.454 5.454 0 0 1 11.545 12L2.632 4.501z"/></svg>');
          }

          .firefox::before {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23FF9400" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/></svg>');
          }

          .safari::before {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23006CFF" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/></svg>');
          }

          .edge::before {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%230078D7" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/></svg>');
          }

          .docs-links {
            margin: 1rem 0;
          }

          .docs-links a {
            color: #2563eb;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            border-radius: 0.375rem;
          }

          .docs-links a:hover {
            background: #f3f4f6;
          }

          .cert-info h2 {
            font-size: 1.25rem;
            margin-top: 0;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e5e7eb;
            color: #1f2937;
          }

        </style>
      </head>
      <body>
        <h1>BB API Status</h1>

        <div class="platform-info">
          <h2>Environment</h2>
          <p>Platform: ${statusData.platformDisplay}</p>
          <p>Configuration: ${statusData.configType} config${
		statusData.projectName ? `: ${statusData.projectName}` : ''
	}</span>
        </h1>
        <p>Status: <span class="status">${statusData.status}</span></p>
        <p>${statusData.message}</p>

        <div class="cert-info${statusData.tls.certType === 'self-signed' ? ' self-signed' : ''}">
          <h2>TLS Configuration</h2>
          <p>TLS Enabled: <strong style="color: ${statusData.tls.enabled ? '#059669' : '#d97706'}">${
		statusData.tls.enabled ? 'Yes' : 'No'
	}</strong></p>
          ${
		statusData.tls.enabled
			? `
            <p>Certificate Type: <strong>${statusData.tls.certType}</strong></p>

            <div class="trust-store">
              <h3>Trust Store Information</h3>
              <p>System Location: <code>${statusData.trustStoreLocation}</code></p>
              ${
				statusData.platformDisplay === 'macOS'
					? `<div class="platform-command">
                  To view certificate in Keychain Access:
                  <ol>
                    <li>Open Applications → Utilities → Keychain Access</li>
                    <li>Select "System" keychain on the left</li>
                    <li>Click "Certificates" category</li>
                    <li>Look for "Beyond Better CA"</li>
                  </ol>
                </div>`
					: statusData.platformDisplay === 'Windows'
					? `<div class="platform-command">
                  To view certificate in Windows:
                  <ol>
                    <li>Press Windows+R to open Run</li>
                    <li>Type "certmgr.msc" and press Enter</li>
                    <li>Expand "Trusted Root Certification Authorities"</li>
                    <li>Click "Certificates"</li>
                    <li>Look for "Beyond Better CA"</li>
                  </ol>
                </div>`
					: `<div class="platform-command">
                  To view certificates:
                  <ol>
                    <li>Open terminal</li>
                    <li>Run: ls -l ${statusData.trustStoreLocation}</li>
                    <li>Look for bb-ca.crt</li>
                  </ol>
                </div>`
			}
            </div>
            ${
				statusData.tls.certSource
					? `<p>Certificate Location: <strong>${statusData.tls.certSource} config directory</strong></p>`
					: ''
			}
            ${statusData.tls.certPath ? `<p>Certificate File: <code>${statusData.tls.certPath}</code></p>` : ''}
            ${statusData.tls.issuer ? `<p>Issuer: <code>${statusData.tls.issuer}</code></p>` : ''}
            ${statusData.tls.subject ? `<p>Subject: <code>${statusData.tls.subject}</code></p>` : ''}
            ${
				statusData.tls.validFrom && statusData.tls.validUntil
					? `<div class="validity-info">
                <p>Valid From: ${formatDate(statusData.tls.validFrom)}</p>
                <p>Valid Until: ${formatDate(statusData.tls.validUntil)}</p>
                ${
						statusData.tls.expiryStatus
							? `<p class="expiry-status" style="color: ${
								getExpiryStatusColor(statusData.tls.expiryStatus)
							}">
                    Status: ${getExpiryStatusText(statusData.tls.expiryStatus)}
                  </p>`
							: ''
					}
              </div>`
					: ''
			}
          `
			: ''
	}
        </div>

        ${
		!statusData.tls.enabled
			? `
          <div class="warning">
            <h3>Enable Secure HTTPS</h3>
            <p>Your BB API is running without TLS encryption. To enable HTTPS:</p>
            <ol>
              <li>Run: <code>bb secure on</code></li>
              <li>Restart the API</li>
            </ol>
            <p>This will generate and install the necessary certificates for secure communication.</p>
          </div>
        `
			: ''
	}

        ${
		statusData.tls.enabled
			? `
          <div class="help-section">
            <h3>Documentation & Help</h3>
            <div class="docs-links">
              <a href="https://beyondbetter.dev/docs/security/certificates" target="_blank">📚 Certificate Management Guide</a><br>
              <a href="https://beyondbetter.dev/docs/security/trust-store" target="_blank">🔐 Trust Store Guide</a><br>
              <a href="https://beyondbetter.dev/docs/security/troubleshooting" target="_blank">🔧 Security Troubleshooting</a>
            </div>
          </div>
        `
			: ''
	}

        ${
		statusData.tls.certType === 'self-signed'
			? `
          <div class="help-section">
            <h3>Browser Security Warnings</h3>
            <p>You may see security warnings in your browser because this site uses a self-signed certificate. This is normal and expected.</p>
            <ul class="browser-list">
              <li class="chrome"><strong>Chrome/Brave:</strong> Click "Advanced" then "Proceed to localhost (unsafe)"</li>
              <li class="firefox"><strong>Firefox:</strong> Click "Advanced..." then "Accept the Risk and Continue"</li>
              <li class="safari"><strong>Safari:</strong> Click "Show Details" then "visit this website"</li>
              <li class="edge"><strong>Edge:</strong> Click "Advanced" then "Continue to localhost (unsafe)"</li>
            </ul>
            <p>These warnings appear because your browser doesn't recognize our local certificate authority. The connection is still encrypted and secure for local development.</p>
          </div>

          <div class="warning">
            <h3>Self-Signed Certificate</h3>
            <p>Your BB API is using a self-signed certificate. You may see browser warnings about this certificate.</p>
            <p>To use a more secure certificate:</p>
            <ol>
              <li>Install mkcert: 
                <code>${Deno.build.os === 'windows' ? 'choco install mkcert' : 'brew install mkcert'}</code>
              </li>
              <li>Run: <code>bb secure on</code></li>
              <li>Restart the API</li>
            </ol>
          </div>
        `
			: ''
	}
      </body>
    </html>
  `;
}

async function getTlsInfo(config: FullConfigSchema, startDir?: string): Promise<{
	certType?: 'custom' | 'self-signed';
	certPath?: string;
	certSource?: 'config' | 'project' | 'global';
	validFrom?: string;
	validUntil?: string;
	issuer?: string;
	subject?: string;
	expiryStatus?: ExpiryStatus;
}> {
	// Try to get cert content from all possible sources
	let certContent: string | null = null;
	let certSource: 'config' | 'project' | 'global' | undefined;
	let certPath: string | undefined;

	if (config.api.tlsCertPem) {
		certContent = config.api.tlsCertPem;
		certSource = 'config';
	} else {
		const certFile = config.api.tlsCertFile || 'localhost.pem';
		certPath = certFile;

		if (startDir) {
			certContent = await readFromBbDir(startDir, certFile);
			if (certContent) {
				certSource = 'project';
			}
		}

		if (!certContent) {
			certContent = await readFromGlobalConfigDir(certFile);
			if (certContent) {
				certSource = 'global';
			}
		}
	}

	if (!certContent) {
		return {};
	}

	const certInfo = getCertificateInfo(certContent);
	if (!certInfo) return {};

	return {
		certType: certInfo.isSelfSigned ? 'self-signed' : 'custom',
		certPath,
		certSource,
		issuer: certInfo.issuer,
		subject: certInfo.subject,
		validFrom: certInfo.validFrom.toISOString(),
		validUntil: certInfo.validTo.toISOString(),
		expiryStatus: getExpiryStatus(certInfo.validTo),
	};
}

export const getStatus = async (ctx: Context) => {
	// Get config based on startDir if provided
	const dirParam = ctx.request.url.searchParams.get('startDir');
	const startDir = dirParam || undefined;
	const config = startDir ? await ConfigManager.fullConfig(startDir) : await ConfigManager.globalConfig();

	const tlsInfo = config.api.apiUseTls ? await getTlsInfo(config, startDir) : {};

	const statusData: StatusData = {
		status: 'OK',
		message: 'API is running',
		platform: Deno.build.os,
		platformDisplay: (({
			'darwin': 'macOS',
			'windows': 'Windows',
			'linux': 'Linux',
		} as Record<SupportedPlatform, string>)[Deno.build.os as SupportedPlatform] || Deno.build.os),
		trustStoreLocation: ({
			'darwin': '/Library/Keychains/System.keychain',
			'windows': 'Cert:\\LocalMachine\\Root',
			'linux': '/etc/ssl/certs',
		} as Record<SupportedPlatform, string>)[Deno.build.os as SupportedPlatform],
		tls: {
			enabled: config.api.apiUseTls || false,
			...tlsInfo,
		},
		configType: startDir ? 'project' : 'global',
		projectName: startDir ? config.project.name : undefined,
	};

	// Check Accept header
	const acceptHeader = ctx.request.headers.get('Accept') || '';
	const wantsHtml = acceptHeader.includes('text/html');

	if (wantsHtml) {
		ctx.response.type = 'text/html';
		ctx.response.body = getHtmlResponse(statusData);
	} else {
		ctx.response.type = 'application/json';
		ctx.response.body = statusData;
	}
};
