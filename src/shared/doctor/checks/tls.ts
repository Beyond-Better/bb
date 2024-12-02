import { DiagnosticResult } from '../types.ts';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
import type { GlobalConfigSchema } from 'shared/configSchema.ts';
import { certificateFileExists, getCertificateInfo, isCertSelfSigned } from '../../utils/tlsCerts.utils.ts';
import { join } from '@std/path';
import { getGlobalConfigDir } from 'shared/dataDir.ts';

interface TlsCheckContext {
	configManager: ConfigManager;
	globalConfig: GlobalConfigSchema;
	globalDir: string;
}

async function checkCertificateExists(
	context: TlsCheckContext,
): Promise<DiagnosticResult | null> {
	const certFile = 'localhost.pem';
	const keyFile = 'localhost-key.pem';
	const certPath = join(context.globalDir, certFile);
	const keyPath = join(context.globalDir, keyFile);

	try {
		const certExists = await certificateFileExists(certFile);
		const keyExists = await certificateFileExists(keyFile);

		if (!certExists || !keyExists) {
			return {
				category: 'tls',
				status: 'error',
				message: 'TLS certificate files missing',
				details: [
					!certExists ? `Certificate file not found: ${certFile}` : '',
					!keyExists ? `Key file not found: ${keyFile}` : '',
				].filter(Boolean).join('\n'),
				fix: {
					description: 'Generate new TLS certificates',
					command: 'bb secure on',
					apiEndpoint: '/api/v1/secure/generate',
					requiresElevated: true,
				},
			};
		}
	} catch (error) {
		logger.error('Failed to check certificate existence:', error);
		return {
			category: 'tls',
			status: 'error',
			message: 'Failed to check certificate files',
			details: (error as Error).message,
		};
	}

	return null;
}

async function checkCertificateValidity(
	context: TlsCheckContext,
): Promise<DiagnosticResult | null> {
	const certFile = 'localhost.pem';
	const certPath = join(context.globalDir, certFile);

	try {
		const certContent = await Deno.readTextFile(certPath);
		const certInfo = getCertificateInfo(certContent);

		if (!certInfo) {
			return {
				category: 'tls',
				status: 'error',
				message: 'Invalid TLS certificate',
				details: 'Could not read certificate information',
				fix: {
					description: 'Generate new TLS certificates',
					command: 'bb secure on',
					apiEndpoint: '/api/v1/secure/generate',
					requiresElevated: true,
				},
			};
		}

		const now = new Date();
		const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

		if (certInfo.validTo < now) {
			return {
				category: 'tls',
				status: 'error',
				message: 'TLS certificate has expired',
				details: `Expired on ${certInfo.validTo.toLocaleString()}`,
				fix: {
					description: 'Generate new TLS certificates',
					command: 'bb secure on',
					apiEndpoint: '/api/v1/secure/generate',
					requiresElevated: true,
				},
			};
		}

		if (certInfo.validTo.getTime() - now.getTime() < thirtyDays) {
			return {
				category: 'tls',
				status: 'warning',
				message: 'TLS certificate will expire soon',
				details: `Expires on ${certInfo.validTo.toLocaleString()}`,
				fix: {
					description: 'Generate new TLS certificates',
					command: 'bb secure on',
					apiEndpoint: '/api/v1/secure/generate',
					requiresElevated: true,
				},
			};
		}

		// Check if self-signed and warn if it is
		const isSelfSigned = await isCertSelfSigned(certContent);
		if (isSelfSigned) {
			return {
				category: 'tls',
				status: 'warning',
				message: 'Using self-signed certificate',
				details: 'Self-signed certificates may cause browser warnings',
				fix: {
					description: 'Add certificate to system trust store',
					command: 'bb secure on',
					apiEndpoint: '/api/v1/secure/trust',
					requiresElevated: true,
				},
			};
		}
	} catch (error) {
		logger.error('Failed to check certificate validity:', error);
		return {
			category: 'tls',
			status: 'error',
			message: 'Failed to check certificate validity',
			details: (error as Error).message,
		};
	}

	return null;
}

export async function checkTls(): Promise<DiagnosticResult[]> {
	const results: DiagnosticResult[] = [];

	try {
		const configManager = await ConfigManager.getInstance();
		const globalConfig = await configManager.loadGlobalConfig();
		const globalDir = await getGlobalConfigDir();

		const context: TlsCheckContext = {
			configManager,
			globalConfig,
			globalDir,
		};

		// Check if TLS is enabled
		const tlsEnabled = globalConfig.api?.apiUseTls;
		if (!tlsEnabled) {
			results.push({
				category: 'tls',
				status: 'warning',
				message: 'TLS is disabled',
				details: 'Running without TLS is not recommended for production use',
				fix: {
					description: 'Enable TLS',
					command: 'bb secure on',
					apiEndpoint: '/api/v1/secure/enable',
				},
			});
			return results;
		}

		// Run all TLS checks
		const checks = [
			checkCertificateExists,
			checkCertificateValidity,
		];

		for (const check of checks) {
			const result = await check(context);
			if (result) {
				results.push(result);
			}
		}

		// If no issues found, add an OK result
		if (results.length === 0) {
			results.push({
				category: 'tls',
				status: 'ok',
				message: 'TLS is properly configured and certificates are valid',
			});
		}
	} catch (error) {
		logger.error('Failed to check TLS status:', error);
		results.push({
			category: 'tls',
			status: 'error',
			message: 'Failed to check TLS configuration',
			details: (error as Error).message,
		});
	}

	return results;
}
