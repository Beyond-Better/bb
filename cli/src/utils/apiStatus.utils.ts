import { join } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import dir from 'dir';
import { getBbDir } from 'shared/dataDir.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { ApiConfig } from 'shared/config/v2/types.ts';
import ApiClient from 'cli/apiClient.ts';
import { logger } from 'shared/logger.ts';

const PID_FILE_NAME = 'api.pid';
const APP_NAME = 'dev.beyondbetter.app';

/* ******************
 * API type can be either global or per-project.
 * The type of API is defined by whether the projectId is supplied.
 * All of the API control functions have projectId as an optional argument
 * If projectId is supplied then API control, such as location of PID file
 * should be relative to the projectRoot.
 * The calling function (CLI command entry point) is responsible for
 * ensuring the projectId is valid, so all commands here can assume that
 * getBbDir, getProjectRoot, etc will succeed (but that's no excuse for not handling errors)
 ****************** */

export async function getAppRuntimeDir(): Promise<string> {
	let runtimeDir: string;

	if (Deno.build.os === 'darwin') {
		// macOS: ~/Library/Application Support/dev.beyondbetter.app/run
		const data = dir('data');
		if (!data) throw new Error('Could not determine data directory');
		runtimeDir = join(data, APP_NAME, 'run');
	} else if (Deno.build.os === 'windows') {
		// Windows: %ProgramData%\dev.beyondbetter.app\run
		const programData = Deno.env.get('ProgramData');
		if (!programData) throw new Error('Could not determine ProgramData directory');
		runtimeDir = join(programData, APP_NAME, 'run');
	} else {
		// Linux: /var/run/dev.beyondbetter.app
		runtimeDir = join('/var/run', APP_NAME.toLowerCase());
	}

	await ensureDir(runtimeDir);
	return runtimeDir;
}

async function getPidFilePath(projectId?: string): Promise<string> {
	const runtimeDir = projectId ? await getBbDir(projectId) : await getAppRuntimeDir();
	return join(runtimeDir, PID_FILE_NAME);
}

export async function savePid(pid: number, projectId?: string): Promise<void> {
	const pidFile = await getPidFilePath(projectId);
	logger.info(`Writing PID to file: ${pidFile}`);
	await Deno.writeTextFile(pidFile, pid.toString());
}

export async function getPid(projectId?: string): Promise<number | null> {
	try {
		const pidFile = await getPidFilePath(projectId);
		if (await exists(pidFile)) {
			const pidString = await Deno.readTextFile(pidFile);
			return parseInt(pidString.trim(), 10);
		}
	} catch (error) {
		logger.debug(`Error reading PID file: ${error}`);
	}
	return null;
}

export async function removePid(projectId?: string): Promise<void> {
	try {
		const pidFile = await getPidFilePath(projectId);
		if (await exists(pidFile)) {
			await Deno.remove(pidFile);
		}
	} catch (error) {
		logger.debug(`Error removing PID file: ${error}`);
	}
}

export interface ApiStatusCheck {
	pidExists: boolean;
	processResponds: boolean;
	apiResponds: boolean;
	pid?: number;
	error?: string;
}

export async function checkApiStatus(projectId?: string): Promise<ApiStatusCheck> {
	const status: ApiStatusCheck = {
		pidExists: false,
		processResponds: false,
		apiResponds: false,
	};

	// Level 1: Check PID file
	const pid = await getPid(projectId);
	if (pid === null) {
		status.error = 'No PID file found';
		return status;
	}
	status.pid = pid;

	// Level 2: Check if process exists
	try {
		if (Deno.build.os === 'windows') {
			// Use tasklist to check process on Windows
			const cmd = new Deno.Command('tasklist', {
				args: ['/FI', `PID eq ${pid}`, '/NH'],
			});
			const output = await cmd.output();
			status.pidExists = new TextDecoder().decode(output.stdout).includes(`${pid}`);
		} else {
			// Unix-like systems can use kill -0
			try {
				Deno.kill(pid, 'SIGCONT');
				status.pidExists = true;
			} catch {
				status.pidExists = false;
			}
		}
	} catch (error) {
		status.error = `Process check failed: ${(error as Error).message}`;
		return status;
	}

	// Level 3: Check if API endpoint responds
	if (status.pidExists) {
		try {
			const configManager = await ConfigManagerV2.getInstance();
			const globalConfig = await configManager.getGlobalConfig();
			let apiConfig: ApiConfig;
			if (projectId) {
				const projectConfig = await configManager.getProjectConfig(projectId);
				// we don't need to check projectConfig.useProjectApi here since caller
				// is responsible for that; if we've got a projectId, we're using projectConfig
				apiConfig = projectConfig.settings.api as ApiConfig || globalConfig.api;
			} else {
				apiConfig = globalConfig.api;
			}
			const apiHostname = apiConfig.hostname || 'localhost';
			const apiPort = apiConfig.port || 3162;
			const apiUseTls = typeof apiConfig.tls?.useTls !== 'undefined' ? apiConfig.tls.useTls : false;

			const apiClient = await ApiClient.create(projectId, apiHostname, apiPort, apiUseTls);
			const response = await apiClient.get('/api/v1/status');
			status.apiResponds = response.ok;
			status.processResponds = true;
		} catch (error) {
			status.error = `API check failed: ${(error as Error).message}`;
		}
	}

	return status;
}

export async function reconcilePidState(projectId?: string): Promise<void> {
	const status = await checkApiStatus(projectId);

	if (!status.pidExists && await getPid(projectId) !== null) {
		// PID file exists but process doesn't - clean up
		logger.warn('Removing stale PID file - process not found');
		await removePid(projectId);
	} else if (status.pidExists && !status.apiResponds) {
		// Process exists but API doesn't respond - potential zombie
		logger.warn('API process exists but is not responding. Consider restarting.');
	} else if (status.apiResponds && await getPid(projectId) === null) {
		// API responds but no PID file - recover state if possible
		logger.warn('API is running but PID file is missing. State mismatch detected.');
		if (status.pid) {
			logger.info(`Recovering PID file with process ID: ${status.pid}`);
			await savePid(status.pid, projectId);
		}
	}
}

export async function isApiRunning(projectId?: string): Promise<boolean> {
	const status = await checkApiStatus(projectId);
	return status.apiResponds;
}
