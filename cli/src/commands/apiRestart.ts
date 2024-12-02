import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { delay } from '@std/async';

import { getApiStatus, restartApiServer } from '../utils/apiControl.utils.ts';
import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

export const apiRestart = new Command()
	.name('restart')
	.description('Restart the BB API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write API output', { default: undefined })
	.option('--hostname <string>', 'Specify the hostname for API to listen on', { default: undefined })
	.option('--port <string>', 'Specify the port for API to listen on', { default: undefined })
	.option('--use-tls <boolean>', 'Specify whether API should listen with TLS', { default: undefined })
	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, hostname, port, useTls }) => {
		const startDir = Deno.cwd();
		const fullConfig = await ConfigManager.fullConfig(startDir);

		const apiHostname = `${hostname || fullConfig.api?.apiHostname || 'localhost'}`;
		const apiPort = `${port || fullConfig.api?.apiPort || 3000}`; // cast as string
		const apiUseTls = typeof useTls !== 'undefined'
			? !!useTls
			: typeof fullConfig.api.apiUseTls !== 'undefined'
			? fullConfig.api.apiUseTls
			: true;
		try {
			logger.info('Restarting API...');

			const { pid, apiLogFilePath } = await restartApiServer(
				startDir,
				apiHostname,
				apiPort,
				apiUseTls,
				apiLogLevel,
				apiLogFile,
			);

			// Check if the API is running with enhanced status checking
			let apiRunning = false;
			const maxAttempts = 10;
			const delayMs = 250;

			await delay(delayMs * 2);
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				const apiStatus = await getApiStatus(startDir);

				if (apiStatus.processStatus?.apiResponds && apiStatus.running) {
					apiRunning = true;
					break;
				}

				// Provide detailed apiStatus information
				if (apiStatus.processStatus?.pidExists && !apiStatus.processStatus?.apiResponds) {
					logger.warn(
						`API process exists but is not responding [${attempt}/${maxAttempts}]. PID: ${apiStatus.processStatus?.pid}`,
					);
				} else if (!apiStatus.processStatus?.pidExists) {
					logger.warn(
						`API process not found [${attempt}/${maxAttempts}]. Starting up...`,
					);
				}

				if (apiStatus.error) {
					logger.warn(`API status check [${attempt}/${maxAttempts}]: ${apiStatus.error}`);
				}

				await delay(delayMs * attempt);
			}

			if (!apiRunning) {
				logger.error('Failed to restart the API server.');
				Deno.exit(1);
			}

			console.log(`${colors.bold.blue.underline('BB API restarted successfully!')}`);
			console.log(`\nAPI server restarted with PID: ${pid}`);
			console.log(`Logs are being written to: ${colors.green(apiLogFilePath)}`);
		} catch (error) {
			logger.error(`Error restarting BB API server: ${(error as Error).message}`);
			Deno.exit(1);
		}
	});
