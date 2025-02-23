import { invoke } from '@tauri-apps/api/core';
import { GlobalConfig, ServerStartResult, ServerStatus, ServiceStartResult, ServiceStatus } from '../types/api';

export async function startServer(): Promise<ServerStartResult> {
	// Start API first, then BUI
	const apiResult = await invoke<ServiceStartResult>('start_api');
	if (!apiResult.success) {
		return {
			api: apiResult,
			bui: {
				success: false,
				pid: null,
				error: 'API failed to start, BUI not attempted',
				requires_settings: false,
			},
			all_services_ready: false,
		};
	}

	// Now start BUI
	const buiResult = await invoke<ServiceStartResult>('start_bui');
	const allReady = apiResult.success && buiResult.success;

	// If BUI fails, stop API
	if (!buiResult.success && apiResult.success) {
		await stopServer();
		buiResult.error = `BUI failed to start: ${buiResult.error}. API stopped.`;
	}

	return {
		api: apiResult,
		bui: buiResult,
		all_services_ready: allReady,
	};
}

export async function stopServer(): Promise<boolean> {
	// Stop BUI first, then API
	const buiStopped = await invoke<boolean>('stop_bui');
	const apiStopped = await invoke<boolean>('stop_api');
	return buiStopped && apiStopped;
}

export async function checkServerStatus(): Promise<ServerStatus> {
	return invoke('check_server_status');
}

export async function checkServerStatusNative(): Promise<ServerStatus> {
	const config = await getGlobalConfig();

	// Check API
	const apiStatus = await checkServiceStatusNative(
		config.api.hostname,
		config.api.port,
		config.api.tls.useTls,
		'/api/v1/status',
	);

	// Check BUI
	const buiStatus = await checkServiceStatusNative(
		config.api.hostname,
		config.api.port,
		config.bui.tls.useTls,
		'/api/v1/status',
	);

	return {
		api: apiStatus,
		bui: buiStatus,
		all_services_ready: apiStatus.service_responds && buiStatus.service_responds,
	};
}

async function checkServiceStatusNative(
	hostname: string,
	port: number,
	useTls: boolean,
	healthEndpoint: string,
): Promise<ServiceStatus> {
	const protocol = useTls ? 'https' : 'http';
	const url = `${protocol}://${hostname}:${port}${healthEndpoint}`;

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
				service_responds: true,
				pid: null, // We don't get PID from HTTP check
				error: null,
			};
		} else {
			return {
				pid_exists: false,
				process_responds: false,
				service_responds: false,
				pid: null,
				error: `Server returned status ${response.status}`,
			};
		}
	} catch (error) {
		return {
			pid_exists: false,
			process_responds: false,
			service_responds: false,
			pid: null,
			error: (error instanceof Error) ? (error.message || 'Unknown error') : error,
		};
	}
}

export async function getGlobalConfig(): Promise<GlobalConfig> {
	return invoke('get_global_config');
}

export async function getApiLogPath(): Promise<string> {
	return invoke('get_api_log_path');
}

export async function getBuiLogPath(): Promise<string> {
	return invoke('get_bui_log_path');
}

export async function getGlobalConfigDefault(): Promise<GlobalConfig> {
	return {
		api: {
			hostname: 'localhost',
			port: 3162,
			tls: {
				useTls: false,
			},
		},
		bui: {
			hostname: 'localhost',
			port: 8080,
			tls: {
				useTls: false,
			},
		},
	};
}
