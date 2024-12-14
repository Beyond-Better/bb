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
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { ApiConfig } from 'shared/config/v2/types.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';
import { apiFileLogPath } from 'api/utils/fileLogger.ts';

export async function startApiServer(
	projectId: string|undefined,
	apiHostname?: string,
	apiPort?: string,
	apiUseTls?: boolean,
	apiLogLevel?: string,
	apiLogFile?: string,
	follow?: boolean,
): Promise<{ pid: number; apiLogFilePath: string; listen: string }> {
	// First reconcile any existing state
	await reconcilePidState(projectId);
	const configManager = await ConfigManagerV2.getInstance();
	const globalConfig = await configManager.getGlobalConfig();
	let apiConfig: ApiConfig;
	if (projectId) {
		const projectConfig = await configManager.getProjectConfig(projectId);
		apiConfig = projectConfig.settings.api as ApiConfig || globalConfig.api;
	} else {
		apiConfig = globalConfig.api;
	}
	const status = await checkApiStatus(projectId);
	if (status.apiResponds) {
		logger.info('BB API server is already running and responding.');
		const pid = await getPid(projectId);
		const apiLogFileName = apiLogFile || apiConfig.logFile || 'api.log';
		const apiLogFilePath = await apiFileLogPath(apiLogFileName, projectId);
		const apiHostname = apiConfig.hostname || 'localhost';
		const apiPort = apiConfig.port || 3162;
		const apiUseTls = typeof apiConfig.tls?.useTls !== 'undefined' ? apiConfig.tls.useTls : false;
		return { pid: pid || 0, apiLogFilePath, listen: `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}` };
	}

	const projectRoot = projectId ?  await getProjectRoot(projectId) : Deno.cwd();
	const apiLogFileName = apiLogFile || apiConfig.logFile || 'api.log';
	const apiLogFilePath = await apiFileLogPath(apiLogFileName, projectId);
	const logLevel = apiLogLevel || apiConfig.logLevel || 'info';
	if (!apiHostname) apiHostname = `${apiConfig.hostname}`;
	if (!apiPort) apiPort = `${apiConfig.port}`;
	if (typeof apiUseTls === 'undefined') {
		apiUseTls = typeof apiConfig.tls?.useTls !== 'undefined' ? apiConfig.tls.useTls : false;
	}
	const apiHostnameArgs = apiHostname ? ['--hostname', apiHostname] : [];
	const apiPortArgs = apiPort ? ['--port', apiPort] : [];
	const apiUseTlsArgs = typeof apiUseTls !== 'undefined' ? ['--use-tls', apiUseTls ? 'true' : 'false'] : [];

	//const redactedFullConfig = await ConfigManager.redactedFullConfig(projectId);
	//logger.debug(`Starting API with config:`, redactedFullConfig);
	logger.debug(
		`Starting BB API server from ${projectId} on ${apiHostname}:${apiPort}, logging to ${apiLogFilePath}`,
	);

	let command: Deno.Command;

	if (isCompiledBinary()) {
		const bbApiExecFile = await Deno.realPath(join(dirname(Deno.execPath()), globalConfig.bbApiExeName));
		logger.debug(`Starting BB API as compiled binary using ${bbApiExecFile}`);
		command = new Deno.Command(bbApiExecFile, {
			args: ['--log-file', apiLogFilePath, ...apiHostnameArgs, ...apiPortArgs, ...apiUseTlsArgs],
			cwd: projectRoot,
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
	await savePid(pid, projectId);

	if (!follow) {
		// Unref the child process to allow the parent to exit
		process.unref();
		logger.debug(`Detached from BB API and returning with PID ${pid}`);
	}

	return { pid, apiLogFilePath, listen: `${apiHostname}:${apiPort}` };
}

export async function stopApiServer(projectId?: string): Promise<void> {
	const status = await checkApiStatus(projectId);

	if (!status.pidExists && !status.apiResponds) {
		logger.info('BB API server is not running.');
		await removePid(projectId); // Cleanup any stale PID file
		return;
	}

	if (status.pidExists && !status.apiResponds) {
		logger.warn('API process exists but is not responding - attempting forced shutdown.');
	}

	logger.info('Stopping BB API server...');

	const pid = await getPid(projectId);
	if (pid === null) {
		logger.error('Unable to find API server PID.');
		return;
	}

	try {
		Deno.kill(pid, 'SIGTERM');
		await removePid(projectId);
		logger.info('BB API server stopped successfully.');
	} catch (error) {
		logger.error(`Error stopping BB API server: ${(error as Error).message}`);
	}
}

export async function restartApiServer(
	projectId: string|undefined,
	apiHostname?: string,
	apiPort?: string,
	apiUseTls?: boolean,
	apiLogLevel?: string,
	apiLogFile?: string,
): Promise<{ pid: number; apiLogFilePath: string; listen: string }> {
	await stopApiServer(projectId);

	await delay(1000);

	return await startApiServer(projectId, apiHostname, apiPort, apiUseTls, apiLogLevel, apiLogFile);
}

export async function followApiLogs(apiLogFilePath: string, projectId?: string): Promise<void> {
	try {
		// Set up SIGINT (Ctrl+C) handler
		const ac = new AbortController();
		//const signal = ac.signal;

		Deno.addSignalListener('SIGINT', async () => {
			console.log('\nReceived SIGINT. Stopping API server...');
			await stopApiServer(projectId);
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

export async function getApiStatus(projectId?: string): Promise<{
	running: boolean;
	pid?: number;
	apiUrl?: string;
	apiStatus?: unknown;
	processStatus?: ApiStatusCheck;
	error?: string;
}> {
	const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();
	let apiConfig: ApiConfig;
	if (projectId) {
		const projectConfig = await configManager.getProjectConfig(projectId);
		apiConfig = projectConfig.settings.api as ApiConfig || globalConfig.api;
	} else {
		apiConfig = globalConfig.api;
	}
	const apiHostname = apiConfig.hostname || 'localhost';
	const apiPort = apiConfig.port || 3162;
	const apiUseTls = typeof apiConfig.tls?.useTls !== 'undefined'
		? apiConfig.tls.useTls
		: false;
	const processStatus = await checkApiStatus(projectId);
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
		const pid = await getPid(projectId);
		status.pid = pid !== null ? pid : undefined;
		status.apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;

		try {
			const apiClient = await ApiClient.create(projectId, apiHostname, apiPort, apiUseTls);
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
