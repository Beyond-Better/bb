import { invoke } from '@tauri-apps/api/core';
import { ApiConfig, ApiStartResult, ApiStatus } from '../types/api';

export async function startApi(): Promise<ApiStartResult> {
	return invoke('start_api');
}

export async function stopApi(): Promise<boolean> {
	return invoke('stop_api');
}

export async function checkApiStatus(): Promise<ApiStatus> {
	return invoke('check_api_status');
}

export async function checkApiStatusNative(): Promise<ApiStatus> {
	const config = await getApiConfig();
	const protocol = config.tls.useTls ? 'https' : 'http';
	const url = `${protocol}://${config.hostname}:${config.port}/api/v1/status`;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
			},
		});

		if (response.ok) {
			return {
				pid_exists: true,
				process_responds: true,
				api_responds: true,
				pid: null, // We don't get PID from HTTP check
				error: null,
			};
		} else {
			return {
				pid_exists: false,
				process_responds: false,
				api_responds: false,
				pid: null,
				error: `Server returned status ${response.status}`,
			};
		}
	} catch (error) {
		return {
			pid_exists: false,
			process_responds: false,
			api_responds: false,
			pid: null,
			error: error.message,
		};
	}
}

export async function getApiConfig(): Promise<ApiConfig> {
	return invoke('get_api_config');
}

export async function getApiLogPath(): Promise<string> {
	return invoke('get_api_log_path');
}

export async function getApiConfigDefault(): Promise<ApiConfig> {
	// For now, return default config until we implement config storage
	return {
		hostname: 'localhost',
		port: 3162,
		tls: {
			useTls: false,
		},
	};
}
