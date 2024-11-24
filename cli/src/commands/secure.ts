import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
import {
	addToSystemTrustStore,
	certificateFileExists,
	generateCertificateMkcert,
	getCertificateInfo,
} from 'shared/tlsCerts.ts';
import { join } from '@std/path';
import { exists } from '@std/fs';
import { getGlobalConfigDir } from 'shared/dataDir.ts';

async function enableTls(startDir: string, configManager: ConfigManager): Promise<void> {
	console.log('Enabling TLS for BB API...');

	try {
		const globalConfig = await configManager.loadGlobalConfig();
		const certFileName = globalConfig.api.tlsCertFile || 'localhost.pem';

		if (!await certificateFileExists(certFileName)) {
			const domain = globalConfig.api.apiHostname || 'localhost';
			const validityDays = 365;
			await generateCertificateMkcert(domain, validityDays);
			console.log(colors.green('TLS certificate has been created.'));

			// Add CA to system trust store
			try {
				await addToSystemTrustStore();
			} catch (error) {
				console.warn(colors.yellow(`Warning: Failed to add CA to trust store: ${(error as Error).message}`));
				console.warn(colors.yellow('You may need to manually trust the CA certificate.'));
			}
		}

		if (await certificateFileExists(certFileName)) {
			// Update configuration
			await configManager.setGlobalConfigValue('api.apiUseTls', 'true');
			await configManager.setProjectConfigValue('api.apiUseTls', 'true', startDir);

			console.log(colors.green('TLS has been enabled successfully.'));
		} else {
			await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
			await configManager.setProjectConfigValue('api.apiUseTls', 'false', startDir);

			console.log(colors.red('TLS has been disabled since no certificate file exists.'));
		}
		console.log('\nNext steps:');
		console.log('1. Restart the BB API server for changes to take effect:');
		console.log(`   ${colors.bold('bb restart')}`);
	} catch (error) {
		logger.error(`Failed to enable TLS: ${(error as Error).message}`);
		throw error;
	}
}

async function disableTls(startDir: string, configManager: ConfigManager): Promise<void> {
	console.log('Disabling TLS for BB API...');

	try {
		// Update configuration
		await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
		await configManager.setProjectConfigValue('api.apiUseTls', 'false', startDir);

		console.log(colors.yellow('TLS has been disabled.'));
		console.log('\nNext steps:');
		console.log('1. Restart the BB API server for changes to take effect:');
		console.log(`   ${colors.bold('bb restart')}`);
		console.log(colors.yellow('\nWarning: Running without TLS is not recommended for production use.'));
	} catch (error) {
		logger.error(`Failed to disable TLS: ${(error as Error).message}`);
		throw error;
	}
}

export const secure = new Command()
	.name('secure')
	.description('Manage TLS security for BB API')
	.action(() => {
		secure.showHelp();
		Deno.exit(1);
	})
	.command('on', 'Enable TLS for BB API')
	.action(async () => {
		const startDir = Deno.cwd();
		try {
			const configManager = await ConfigManager.getInstance();
			await enableTls(startDir, configManager);
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	})
	.command('off', 'Disable TLS for BB API')
	.action(async () => {
		const startDir = Deno.cwd();
		try {
			const configManager = await ConfigManager.getInstance();
			await disableTls(startDir, configManager);
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	})
	.command('status', 'Show current TLS status')
	.action(async () => {
		const startDir = Deno.cwd();
		try {
			const config = await ConfigManager.fullConfig(startDir);
			const tlsEnabled = config.api.apiUseTls;
			const globalDir = await getGlobalConfigDir();

			if (!tlsEnabled) {
				console.log(`TLS Status: ${colors.yellow('Disabled')}`);
				console.log('\nTo enable TLS, run:');
				console.log(colors.bold('  bb secure on'));
				return;
			}

			console.log(`TLS Status: ${colors.green('Enabled')}`);

			const certFile = config.api.tlsCertFile || 'localhost.pem';
			const keyFile = config.api.tlsKeyFile || 'localhost-key.pem';
			const certPath = join(globalDir, certFile);
			const keyPath = join(globalDir, keyFile);

			console.log(`Certificate File: ${certFile}`);
			console.log(`Key File: ${keyFile}`);

			// Check if files exist
			const certExists = await exists(certPath);
			const keyExists = await exists(keyPath);

			if (!certExists || !keyExists) {
				console.log(colors.red('\nWarning: Certificate files are missing!'));
				if (!certExists) console.log(colors.red(`Certificate file not found: ${certFile}`));
				if (!keyExists) console.log(colors.red(`Key file not found: ${keyFile}`));
				console.log('\nTo regenerate certificates, run:');
				console.log(colors.bold('  bb secure on'));
				return;
			}

			// Read and verify certificate
			const certContent = await Deno.readTextFile(certPath);
			const certInfo = getCertificateInfo(certContent);

			if (certInfo) {
				console.log('\nCertificate Details:');
				console.log(`Type: ${certInfo.isSelfSigned ? 'Self-signed' : 'CA-signed'}`);
				console.log(`Issuer: ${certInfo.issuer}`);
				console.log(`Subject: ${certInfo.subject}`);
				console.log(`Valid From: ${certInfo.validFrom.toLocaleString()}`);
				console.log(`Valid Until: ${certInfo.validTo.toLocaleString()}`);

				// Check expiry
				const now = new Date();
				const thirtyDays = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

				if (certInfo.validTo < now) {
					console.log(colors.red('\nWarning: Certificate has expired!'));
					console.log('To renew the certificate, run:');
					console.log(colors.bold('  bb secure on'));
				} else if (certInfo.validTo.getTime() - now.getTime() < thirtyDays) {
					console.log(colors.yellow('\nWarning: Certificate will expire soon!'));
					console.log('To renew the certificate, run:');
					console.log(colors.bold('  bb secure on'));
				}
			} else {
				console.log(colors.red('\nWarning: Could not read certificate information!'));
			}
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	});
