import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
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
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';

async function enableTls(_projectId: string, configManager: ConfigManagerV2): Promise<void> {
	console.log('Enabling TLS for BB API...');

	try {
		const globalConfig = await configManager.getGlobalConfig();
		const certFileName = globalConfig.api.tls?.certFile || 'localhost.pem';

		if (!await certificateFileExists(certFileName)) {
			const domain = globalConfig.api.hostname || 'localhost';
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
			await configManager.updateGlobalConfig({
				api: {
					...globalConfig.api,
					tls: { ...globalConfig.api.tls, useTls: true },
				},
			});
			// TODO: Update project config TLS settings in v2

			console.log(colors.green('TLS has been enabled successfully.'));
		} else {
			await configManager.updateGlobalConfig({
				api: {
					...globalConfig.api,
					tls: { ...globalConfig.api.tls, useTls: false },
				},
			});
			// TODO: Update project config TLS settings in v2

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

async function disableTls(_projectId: string, configManager: ConfigManagerV2): Promise<void> {
	const globalConfig = await configManager.getGlobalConfig();
	console.log('Disabling TLS for BB API...');

	try {
		// Update configuration
		await configManager.updateGlobalConfig({
			api: {
				...globalConfig.api,
				tls: { ...globalConfig.api.tls, useTls: false },
			},
		});
		// TODO: Update project config TLS settings in v2

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
		const projectRoot = await getProjectRootFromStartDir(startDir);
		const projectId = await getProjectId(projectRoot);
		try {
			const configManager = await ConfigManagerV2.getInstance();
			await enableTls(projectId, configManager);
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	})
	.command('off', 'Disable TLS for BB API')
	.action(async () => {
		const startDir = Deno.cwd();
		const projectRoot = await getProjectRootFromStartDir(startDir);
		const projectId = await getProjectId(projectRoot);
		try {
			const configManager = await ConfigManagerV2.getInstance();
			await disableTls(projectId, configManager);
		} catch (error) {
			console.error(colors.red(`Error: ${(error as Error).message}`));
			Deno.exit(1);
		}
	})
	.command('status', 'Show current TLS status')
	.action(async () => {
		// const startDir = Deno.cwd();
		// const projectRoot = await getProjectRootFromStartDir(startDir);
		// const projectId = await getProjectId(projectRoot);
		try {
			const configManager = await ConfigManagerV2.getInstance();
			const config = await configManager.getGlobalConfig();
			const tlsEnabled = config.api.tls?.useTls;
			const globalDir = await getGlobalConfigDir();

			if (!tlsEnabled) {
				console.log(`TLS Status: ${colors.yellow('Disabled')}`);
				console.log('\nTo enable TLS, run:');
				console.log(colors.bold('  bb secure on'));
				return;
			}

			console.log(`TLS Status: ${colors.green('Enabled')}`);

			const certFile = config.api.tls?.certFile || 'localhost.pem';
			const keyFile = config.api.tls?.keyFile || 'localhost-key.pem';
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