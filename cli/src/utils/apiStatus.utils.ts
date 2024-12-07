import { readFromBbDir, removeFromBbDir, writeToBbDir } from 'shared/dataDir.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import ApiClient from 'cli/apiClient.ts';
import { logger } from 'shared/logger.ts';

const PID_FILE_NAME = 'api.pid';

export async function savePid(projectId: string, pid: number): Promise<void> {
	await writeToBbDir(projectId, PID_FILE_NAME, pid.toString());
}

export async function getPid(projectId: string): Promise<number | null> {
	const pidString = await readFromBbDir(projectId, PID_FILE_NAME);
	return pidString ? parseInt(pidString, 10) : null;
}

export async function removePid(projectId: string): Promise<void> {
	await removeFromBbDir(projectId, PID_FILE_NAME);
}

export interface ApiStatusCheck {
	pidExists: boolean;
	processResponds: boolean;
	apiResponds: boolean;
	pid?: number;
	error?: string;
}

export async function checkApiStatus(projectId: string): Promise<ApiStatusCheck> {
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
			const projectConfig = await configManager.getProjectConfig(projectId);
			const apiHostname = projectConfig.settings.api?.hostname || 'localhost';
			const apiPort = projectConfig.settings.api?.port || 3162;
			const apiUseTls = typeof projectConfig.settings.api?.tls?.useTls !== 'undefined'
				? projectConfig.settings.api.tls.useTls
				: true;

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

export async function reconcilePidState(projectId: string): Promise<void> {
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
			await savePid(projectId, status.pid);
		}
	}
}

export async function isApiRunning(projectId: string): Promise<boolean> {
	const status = await checkApiStatus(projectId);
	return status.apiResponds;
}
