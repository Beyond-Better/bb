import { delay } from '@std/async';

import { logger } from 'shared/logger.ts';
import {
	type ApiStatusCheck,
	checkApiStatus,
	getPid,
	reconcilePidState,
	removePid,
	savePid,
} from '../utils/apiStatus.utils.ts';
import { getBbDir, getProjectRoot } from 'shared/dataDir.ts';
import { dirname, join } from '@std/path';
import { isCompiledBinary } from '../utils/environment.utils.ts';
import ApiClient from 'cli/apiClient.ts';
import { watchLogs } from 'shared/logViewer.ts';
import { ConfigManager } from 'shared/configManager.ts';
//import { getProjectRoot } from 'shared/dataDir.ts';

export async function startApiServer(
	startDir: string,
	apiHostname?: string,
	apiPort?: string,
	apiUseTls?: boolean,
	apiLogLevel?: string,
	apiLogFile?: string,
	follow?: boolean,
): Promise<{ pid: number; apiLogFilePath: string; listen: string }> {
	// First reconcile any existing state
	await reconcilePidState(startDir);
	const fullConfig = await ConfigManager.fullConfig(startDir);
	const status = await checkApiStatus(startDir);
	if (status.apiResponds) {
		logger.info('BB API server is already running and responding.');
		const pid = await getPid(startDir);
		const bbDir = await getBbDir(startDir);
		const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
		const apiLogFilePath = join(bbDir, apiLogFileName);
		const apiHostname = fullConfig.api.apiHostname || 'localhost';
		const apiPort = fullConfig.api.apiPort || 3000;
		const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
	}

	const bbDir = await getBbDir(startDir);
	const projectRoot = await getProjectRoot(startDir);
	const apiLogFileName = apiLogFile || fullConfig.api?.logFile || 'api.log';
	const apiLogFilePath = join(bbDir, apiLogFileName);
	const logLevel = apiLogLevel || fullConfig.api?.logLevel || 'info';
	if (!apiHostname) apiHostname = `${fullConfig.api.apiHostname}`;
	if (!apiPort) apiPort = `${fullConfig.api.apiPort}`;
	if (typeof apiUseTls === 'undefined') {
		apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
	}
	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
	const apiPortArgs = apiPort ? ['--port', apiPort] : [];
	const apiUseTlsArgs = typeof apiUseTls !== 'undefined' ? ['--use-tls', apiUseTls ? 'true' : 'false'] : [];

	//const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
	//logger.debug(`Starting API with config:`, redactedFullConfig);
	logger.debug(
		`Starting BB API server from ${startDir} on ${apiHostname}:${apiPort}, logging to ${apiLogFilePath}`,
	);

	let command: Deno.Command;

	if (isCompiledBinary()) {
		const bbApiExecFile = await Deno.realPath(join(dirname(Deno.execPath()), fullConfig.bbApiExeName));
		logger.debug(`Starting BB API as compiled binary using ${bbApiExecFile}`);
		command = new Deno.Command(bbApiExecFile, {
			args: ['--log-file', apiLogFilePath, ...apiHostnameArgs, ...apiPortArgs, ...apiUseTlsArgs],
			cwd: startDir,
			stdout: 'null',
			stderr: 'null',
			stdin: 'null',
			env: {
				...Deno.env.toObject(),
				LOG_LEVEL: logLevel,
			},
		});
	} else {
		logger.info(`Starting BB API as script using ${projectRoot}/api/src/main.ts`);
		const cmdArgs = [
			'run',
			'--allow-read',
			'--allow-write',
			'--allow-env',
			'--allow-net',
			'--allow-run',
		];

		command = new Deno.Command(Deno.execPath(), {
			args: [
				...cmdArgs,
				join(projectRoot, 'api/src/main.ts'),
				'--log-file',
				apiLogFilePath,
				...apiHostnameArgs,
				...apiPortArgs,
			],
			cwd: join(projectRoot, 'api'),
			stdout: 'null',
			stderr: 'null',
			stdin: 'null',
			env: {
				...Deno.env.toObject(),
				LOG_LEVEL: logLevel,
			},
		});
	}

	const process = command.spawn();

	// Wait a short time to ensure the process has started
	await delay(500);

	const pid = process.pid;
	await savePid(startDir, pid);

	if (!follow) {
		// Unref the child process to allow the parent to exit
		process.unref();
		logger.debug(`Detached from BB API and returning with PID ${pid}`);
	}

	return { pid, apiLogFilePath, listen: `${apiHostname}:${apiPort}` };
}

export async function stopApiServer(startDir: string): Promise<void> {
	const status = await checkApiStatus(startDir);

	if (!status.pidExists && !status.apiResponds) {
		logger.info('BB API server is not running.');
		await removePid(startDir); // Cleanup any stale PID file
		return;
	}

	if (status.pidExists && !status.apiResponds) {
		logger.warn('API process exists but is not responding - attempting forced shutdown.');
	}

	logger.info('Stopping BB API server...');

	const pid = await getPid(startDir);
	if (pid === null) {
		logger.error('Unable to find API server PID.');
		return;
	}

	try {
		Deno.kill(pid, 'SIGTERM');
		await removePid(startDir);
		logger.info('BB API server stopped successfully.');
	} catch (error) {
		logger.error(`Error stopping BB API server: ${(error as Error).message}`);
	}
}

export async function restartApiServer(
	startDir: string,
	apiHostname?: string,
	apiPort?: string,
	apiUseTls?: boolean,
	apiLogLevel?: string,
	apiLogFile?: string,
): Promise<{ pid: number; apiLogFilePath: string; listen: string }> {
	await stopApiServer(startDir);

	await delay(1000);

	return await startApiServer(startDir, apiHostname, apiPort, apiUseTls, apiLogLevel, apiLogFile);
}

export async function followApiLogs(apiLogFilePath: string, startDir: string): Promise<void> {
	try {
		// Set up SIGINT (Ctrl+C) handler
		const ac = new AbortController();
		//const signal = ac.signal;

		Deno.addSignalListener('SIGINT', async () => {
			console.log('\nReceived SIGINT. Stopping API server...');
			await stopApiServer(startDir);
			ac.abort();
			Deno.exit(0);
		});

		await watchLogs(apiLogFilePath, (content: string) => {
			console.log(content);
		});
	} catch (error) {
		if (error instanceof Deno.errors.Interrupted) {
			console.log('Log following interrupted.');
		} else {
			console.error(`Error following logs: ${(error as Error).message}`);
		}
	} finally {
		Deno.removeSignalListener('SIGINT', () => {});
	}
}

export async function getApiStatus(startDir: string): Promise<{
	running: boolean;
	pid?: number;
	apiUrl?: string;
	apiStatus?: unknown;
	processStatus?: ApiStatusCheck;
	error?: string;
}> {
	const fullConfig = await ConfigManager.fullConfig(startDir);
	const apiHostname = fullConfig.api.apiHostname || 'localhost';
	const apiPort = fullConfig.api.apiPort || 3000;
	const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;
	const processStatus = await checkApiStatus(startDir);
	const status: {
		running: boolean;
		pid?: number;
		apiUrl?: string;
		apiStatus?: unknown;
		processStatus?: ApiStatusCheck;
		error?: string;
	} = {
		running: processStatus.apiResponds,
		processStatus,
	};

	if (processStatus.apiResponds) {
		const pid = await getPid(startDir);
		status.pid = pid !== null ? pid : undefined;
		status.apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;

		try {
			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
			const response = await apiClient.get('/api/v1/status');
			if (response.ok) {
				const apiStatus = await response.json();
				status.apiStatus = apiStatus;
			} else {
				status.error = `Error fetching API status: ${response.statusText}`;
			}
		} catch (error) {
			status.error = `Error connecting to API: ${error instanceof Error ? error.message : String(error)}`;
		}
	} else {
		status.error = 'Process is not running (or has no saved PID)';
	}

	return status;
}
