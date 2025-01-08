import { Command } from 'cliffy/command';
import { colors } from 'cliffy/ansi/colors';
import { delay } from '@std/async';

import { getApiStatus, restartApiServer } from '../utils/apiControl.utils.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import { logger } from 'shared/logger.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';
import type { ApiConfig } from 'shared/config/v2/types.ts';

export const apiRestart = new Command()
	.name('restart')
	.description('Restart the BB API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write API output', { default: undefined })
	.option('--hostname <string>', 'Specify the hostname for API to listen on', { default: undefined })
	.option('--port <string>', 'Specify the port for API to listen on', { default: undefined })
	.option('--use-tls <boolean>', 'Specify whether API should listen with TLS', { default: undefined })
	.action(async ({ logLevel: apiLogLevel, logFile: apiLogFile, hostname, port, useTls }) => {
		let projectId;
		try {
			const startDir = Deno.cwd();
			const projectRoot = await getProjectRootFromStartDir(startDir);
			projectId = await getProjectId(projectRoot);
		} catch (_error) {
			//console.error(`Could not set ProjectId: ${(error as Error).message}`);
			projectId = undefined;
		}

		const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();

		let apiConfig: ApiConfig;
		if (projectId) {
			const projectConfig = await configManager.getProjectConfig(projectId);
			if (projectConfig.useProjectApi) {
				apiConfig = projectConfig.settings.api as ApiConfig || globalConfig.api;
			} else {
				apiConfig = globalConfig.api;
				projectId = undefined;
			}
		} else {
			apiConfig = globalConfig.api;
		}

		const apiHostname = `${hostname || apiConfig.hostname || 'localhost'}`;
		const apiPort = `${port || apiConfig.port || 3162}`; // cast as string
		const apiUseTls = typeof useTls !== 'undefined'
			? !!useTls
			: typeof apiConfig.tls?.useTls !== 'undefined'
			? apiConfig.tls.useTls
			: false;
		try {
			logger.info('Restarting API...');

			const { pid, apiLogFilePath } = await restartApiServer(
				projectId,
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
				const apiStatus = await getApiStatus(projectId);

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
