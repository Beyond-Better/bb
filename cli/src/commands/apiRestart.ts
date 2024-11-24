import { Command } from 'cliffy/command/mod.ts';
import { restartApiServer } from '../utils/apiControl.utils.ts';
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
			await restartApiServer(startDir, apiHostname, apiPort, apiUseTls, apiLogLevel, apiLogFile);
			logger.info('API restarted successfully.');
		} catch (error) {
			logger.error(`Error restarting BB API server: ${(error as Error).message}`);
		}
	});
