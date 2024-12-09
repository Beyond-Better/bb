import { Command } from 'cliffy/command/mod.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { delay } from '@std/async';

import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import { followApiLogs, getApiStatus, startApiServer, stopApiServer } from '../utils/apiControl.utils.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';

export const apiStart = new Command()
	.name('start')
	.description('Start the BB API server')
	.option('--log-level <level:string>', 'Set the log level for the API server', { default: undefined })
	.option('--log-file <file:string>', 'Specify a log file to write output', { default: undefined })
	.option('--hostname <string>', 'Specify the hostname for API to listen on', { default: undefined })
	.option('--port <string>', 'Specify the port for API to listen on', { default: undefined })
	.option('--use-tls <boolean>', 'Specify whether API should listen with TLS', { default: undefined })
	.option('--nobrowser', 'Skip opening a browser window', { default: false })
	.option('--follow', 'Do not detach and follow the API logs', { default: false })
	.action(
		async (
			{ logLevel: apiLogLevel, logFile: apiLogFile, hostname, port, useTls, nobrowser: noBrowser, follow },
		) => {
			const startDir = Deno.cwd();
			const projectRoot = await getProjectRootFromStartDir(startDir);
			const projectId = await getProjectId(projectRoot);

			const configManager = await ConfigManagerV2.getInstance();
			const globalConfig = await configManager.getGlobalConfig();
			const projectConfig = await configManager.getProjectConfig(projectId);
			const apiHostname = `${hostname || projectConfig.settings.api?.hostname || 'localhost'}`;
			const apiPort = `${port || projectConfig.settings.api?.port || 3162}`; // cast as string
			const apiUseTls = typeof useTls !== 'undefined'
				? !!useTls
				: typeof projectConfig.settings.api?.tls?.useTls !== 'undefined'
				? projectConfig.settings.api.tls.useTls
				: true;
			// console.error(
			// 	colors.yellow(`Use TLS - useTls: `),
			// 	useTls,
			// );
			// console.error(
			// 	colors.yellow(`Use TLS - project: `),
			// 	projectConfig.settings.api?.tls?.useTls,
			// );
			// console.error(
			// 	colors.yellow(`Use TLS - final: `),
			// 	apiUseTls,
			// );

			const startNoBrowser = noBrowser ||
				(typeof globalConfig.noBrowser !== 'undefined' ? globalConfig.noBrowser : false);

			// Start the server
			const { pid, apiLogFilePath } = await startApiServer(
				projectId,
				apiHostname,
				apiPort,
				apiUseTls,
				apiLogLevel,
				apiLogFile,
				follow,
			);

			const chatUrl = `https://chat.beyondbetter.dev/#apiHostname=${
				encodeURIComponent(apiHostname)
			}&apiPort=${apiPort}&apiUseTls=${apiUseTls ? 'true' : 'false'}&projectId=${encodeURIComponent(projectId)}`;

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
					console.error(colors.yellow(
						`API process exists but is not responding [${attempt}/${maxAttempts}]. PID: ${apiStatus.processStatus?.pid}`,
					));
				} else if (!apiStatus.processStatus?.pidExists) {
					console.error(colors.yellow(
						`API process not found [${attempt}/${maxAttempts}]. Starting up...`,
					));
				}

				if (apiStatus.error) {
					console.error(colors.yellow(`API status check [${attempt}/${maxAttempts}]: ${apiStatus.error}`));
				}

				await delay(delayMs * attempt);
			}

			if (!apiRunning) {
				console.error(colors.bold.red('Failed to start the API server.'));
				Deno.exit(1);
			}

			if (!startNoBrowser) {
				try {
					let command;
					if (Deno.build.os === 'windows') {
						// Escape & with ^ for Windows command prompt
						const escapedUrl = chatUrl.replace(/&/g, '^&');
						command = new Deno.Command('cmd', { args: ['/c', 'start', escapedUrl] });
					} else if (Deno.build.os === 'darwin') {
						command = new Deno.Command('open', { args: [chatUrl] });
					} else {
						command = new Deno.Command('xdg-open', { args: [chatUrl] });
					}
					await command.output();
				} catch (error) {
					console.error('Failed to open the browser automatically. Please open the URL manually.', error);
				}
			}

			if (follow) {
				await followApiLogs(apiLogFilePath, projectId);
				await stopApiServer(projectId);
			} else {
				console.log(`${colors.bold.blue.underline('BB API started successfully!')}`);

				console.log(`\nAPI server started with PID: ${pid}`);
				console.log(`Logs are being written to: ${colors.green(apiLogFilePath)}`);
				console.log(`Chat URL: ${colors.bold.cyan(chatUrl)}`);
				console.log(`Use ${colors.bold.green(`'${globalConfig.bbExeName} stop'`)} to stop the server.`);
				if (!startNoBrowser) console.log('\nAttempting to open the chat in your default browser...');
				Deno.exit(0);
			}
		},
	);
