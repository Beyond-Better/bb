import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { spawnDetached } from 'shared/process.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { ensureUserInstallLocation, getCurrentInstallLocation } from 'shared/install.ts';
import { performUpgrade } from 'shared/upgrade.ts';

export async function upgradeApi(ctx: Context) {
	try {
		const installLocation = await getCurrentInstallLocation();

		// System installations require manual upgrade
		if (installLocation.type === 'system') {
			ctx.response.status = 403;
			ctx.response.body = {
				success: false,
				error: 'System-wide installation requires manual upgrade with sudo',
				needsSudo: true,
			};
			return;
		}

		// Ensure user installation directory exists and is writable
		if (!await ensureUserInstallLocation()) {
			ctx.response.status = 403;
			ctx.response.body = {
				success: false,
				error: 'Cannot create or write to user installation directory',
			};
			return;
		}

		// Perform the upgrade
		const result = await performUpgrade();

		if (!result.success) {
			ctx.response.status = 403;
			ctx.response.body = {
				success: false,
				error: result.error,
				currentVersion: result.currentVersion,
				latestVersion: result.latestVersion,
			};
			return;
		}

		logger.info(`Successfully upgraded from ${result.currentVersion} to ${result.latestVersion}`);

		// Send success response before initiating restart
		ctx.response.body = {
			success: true,
			currentVersion: result.currentVersion,
			latestVersion: result.latestVersion,
			needsRestart: true,
		};

		// Schedule restart after response is sent
		setTimeout(async () => {
			const cwd = Deno.cwd();
			logger.info(`Initiating API restart from directory: ${cwd}`);

			// Get current API configuration
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			const {
				hostname: apiHostname = 'localhost',
				port: apiPort = 3162,
				tls,
				logLevel,
				logFile,
			} = globalConfig.api;
			const apiUseTls = tls?.useTls ?? false;

			// Construct restart command with current settings
			const cmd = ['bb', 'restart'];
			if (apiHostname) cmd.push('--hostname', String(apiHostname));
			if (apiPort) cmd.push('--port', String(apiPort));
			if (typeof apiUseTls !== 'undefined') cmd.push('--use-tls', String(apiUseTls));
			if (logLevel) cmd.push('--log-level', logLevel);
			if (logFile) cmd.push('--log-file', logFile);

			logger.info(`Restarting API with command: ${cmd.join(' ')}`);

			const success = await spawnDetached({
				cmd,
				cwd,
			});

			if (!success) {
				logger.error('Failed to initiate API restart');
			} else {
				logger.info('API restart initiated successfully');
			}
		}, 500); // Increased delay to ensure response is sent
	} catch (error) {
		logger.error(`Upgrade failed: ${(error as Error).message}`);
		ctx.response.status = 500;
		ctx.response.body = {
			success: false,
			error: (error as Error).message,
		};
	}
}
