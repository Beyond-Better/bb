import { readFromBbDir, removeFromBbDir, writeToBbDir } from 'shared/dataDir.ts';
import { ConfigManager } from 'shared/configManager.ts';
import ApiClient from 'cli/apiClient.ts';
import { logger } from 'shared/logger.ts';

const PID_FILE_NAME = 'api.pid';

export async function savePid(startDir: string, pid: number): Promise<void> {
	await writeToBbDir(startDir, PID_FILE_NAME, pid.toString());
}

export async function getPid(startDir: string): Promise<number | null> {
	const pidString = await readFromBbDir(startDir, PID_FILE_NAME);
	return pidString ? parseInt(pidString, 10) : null;
}

export async function removePid(startDir: string): Promise<void> {
	await removeFromBbDir(startDir, PID_FILE_NAME);
}

export interface ApiStatusCheck {
	pidExists: boolean;
	processResponds: boolean;
	apiResponds: boolean;
	pid?: number;
	error?: string;
}

export async function checkApiStatus(startDir: string): Promise<ApiStatusCheck> {
	const status: ApiStatusCheck = {
		pidExists: false,
		processResponds: false,
		apiResponds: false,
	};

	// Level 1: Check PID file
	const pid = await getPid(startDir);
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
			const fullConfig = await ConfigManager.fullConfig(startDir);
			const apiHostname = fullConfig.api.apiHostname || 'localhost';
			const apiPort = fullConfig.api.apiPort || 3000;
			const apiUseTls = typeof fullConfig.api.apiUseTls !== 'undefined' ? fullConfig.api.apiUseTls : true;

			const apiClient = await ApiClient.create(startDir, apiHostname, apiPort, apiUseTls);
			const response = await apiClient.get('/api/v1/status');
			status.apiResponds = response.ok;
			status.processResponds = true;
		} catch (error) {
			status.error = `API check failed: ${(error as Error).message}`;
		}
	}

	return status;
}

export async function reconcilePidState(startDir: string): Promise<void> {
	const status = await checkApiStatus(startDir);

	if (!status.pidExists && await getPid(startDir) !== null) {
		// PID file exists but process doesn't - clean up
		logger.warn('Removing stale PID file - process not found');
		await removePid(startDir);
	} else if (status.pidExists && !status.apiResponds) {
		// Process exists but API doesn't respond - potential zombie
		logger.warn('API process exists but is not responding. Consider restarting.');
	} else if (status.apiResponds && await getPid(startDir) === null) {
		// API responds but no PID file - recover state if possible
		logger.warn('API is running but PID file is missing. State mismatch detected.');
		if (status.pid) {
			logger.info(`Recovering PID file with process ID: ${status.pid}`);
			await savePid(startDir, status.pid);
		}
	}
}

export async function isApiRunning(startDir: string): Promise<boolean> {
	const status = await checkApiStatus(startDir);
	return status.apiResponds;
}
