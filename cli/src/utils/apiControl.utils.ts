import { logger } from 'shared/logger.ts';
import { config } from 'shared/configManager.ts';
import { getPid, isApiRunning, removePid, savePid } from '../utils/pid.utils.ts';
import { getBbaiDir, getProjectRoot } from 'shared/dataDir.ts';
import { join } from '@std/path';
import { isCompiledBinary } from '../utils/environment.utils.ts';
import { apiClient } from '../utils/apiClient.ts';

export async function startApiServer(startDir: string, cliLogLevel?: string, cliLogFile?: string): Promise<void> {
	if (await isApiRunning(startDir)) {
		logger.info('bbai API server is already running.');
		return;
	}

	const bbaiDir = await getBbaiDir(startDir);
	const projectRoot = await getProjectRoot(startDir);
	const logFile = cliLogFile || config.logFile || 'api.log';
	const logFilePath = join(bbaiDir, logFile);
	const logLevel = cliLogLevel || config.logLevel || 'info';

	logger.info(`Starting bbai API server...`);

	let command: Deno.Command;

	if (isCompiledBinary()) {
		command = new Deno.Command('bbai-api', {
			args: ['--log-file', logFilePath],
			stdout: 'null',
			stderr: 'null',
			stdin: 'null',
			env: {
				...Deno.env.toObject(),
				LOG_LEVEL: logLevel,
			},
		});
	} else {
		const cmdArgs = [
			'run',
			'--allow-read',
			'--allow-write',
			'--allow-env',
			'--allow-net',
			'--allow-run',
		];

		command = new Deno.Command(Deno.execPath(), {
			args: [...cmdArgs, join(projectRoot, 'api/src/main.ts'), '--log-file', logFilePath],
			cwd: join(projectRoot, 'api'),
			//args: [...cmdArgs, join(Deno.cwd(), './bbai-api'), '--log-file', logFilePath],
			//cwd: join(projectRoot, 'api'),
			//args: [...cmdArgs, Deno.execPath(), 'start', '--log-file', logFilePath],
			//cwd: join(projectRoot, 'api'),
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
	await new Promise((resolve) => setTimeout(resolve, 1000));

	const pid = process.pid;
	await savePid(startDir, pid);

	logger.info(`bbai API server started with PID: ${pid}`);
	logger.info(`Logs at level ${logLevel} are being written to: ${logFilePath}`);
	logger.info("Use 'bbai stop' to stop the server.");

	// Unref the child process to allow the parent to exit
	process.unref();
}

export async function stopApiServer(startDir: string): Promise<void> {
	if (!(await isApiRunning(startDir))) {
		logger.info('bbai API server is not running.');
		return;
	}

	logger.info('Stopping bbai API server...');

	const pid = await getPid(startDir);
	if (pid === null) {
		logger.error('Unable to find API server PID.');
		return;
	}

	try {
		Deno.kill(pid, 'SIGTERM');
		await removePid(startDir);
		logger.info('bbai API server stopped successfully.');
	} catch (error) {
		logger.error(`Error stopping bbai API server: ${error.message}`);
	}
}

export async function restartApiServer(startDir: string, cliLogLevel?: string, cliLogFile?: string): Promise<void> {
	await stopApiServer(startDir);
	await startApiServer(startDir, cliLogLevel, cliLogFile);
}

export async function getApiStatus(startDir: string): Promise<{
	running: boolean;
	pid?: number;
	apiUrl?: string;
	apiStatus?: unknown;
	error?: string;
}> {
	const apiPort = config.api?.apiPort || 3000;
	const isRunning = await isApiRunning(startDir);
	const status: {
		running: boolean;
		pid?: number;
		apiUrl?: string;
		apiStatus?: unknown;
		error?: string;
	} = { running: isRunning };

	if (isRunning) {
		const pid = await getPid(startDir);
		status.pid = pid !== null ? pid : undefined;
		status.apiUrl = `http://localhost:${apiPort}`;

		try {
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
	}

	return status;
}
