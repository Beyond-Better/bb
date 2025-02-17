import { Command } from 'cliffy/command';
import { logger } from 'shared/logger.ts';
import { checkForUpdates, performUpgrade } from 'shared/upgrade.ts';
import { getCurrentInstallLocation } from 'shared/install.ts';

export const upgrade = new Command()
	.name('upgrade')
	.description('Upgrade BB to the latest version')
	.option('--check', 'Check for updates without installing')
	.action(async ({ check }) => {
		const installLocation = await getCurrentInstallLocation();

		if (check) {
			const result = await checkForUpdates();
			if (!result.success) {
				logger.error(`Failed to check for updates: ${result.error}`);
				Deno.exit(1);
			}

			if (result.needsUpdate) {
				logger.info(`Update available: ${result.currentVersion} → ${result.latestVersion}`);
				if (result.needsSudo) {
					logger.info('Note: System-wide installation requires sudo for upgrade');
				}
			} else {
				logger.info(`BB is up to date (version ${result.currentVersion})`);
			}
			return;
		}

		// Performing actual upgrade
		logger.info(`Current installation: ${installLocation.type} (${installLocation.path})`);

		if (installLocation.type === 'system') {
			logger.error('System-wide installation requires manual upgrade with sudo');
			logger.info('To upgrade, either:');
			logger.info('1. Run upgrade with sudo');
			logger.info('2. Use "bb migrate --to user" to switch to user installation');
			Deno.exit(1);
		}

		const result = await performUpgrade();
		if (!result.success) {
			logger.error(`Upgrade failed: ${result.error}`);
			Deno.exit(1);
		}

		logger.info(`Successfully upgraded from ${result.currentVersion} to ${result.latestVersion}`);
		logger.info('Please restart the API server if it is running');
	});
