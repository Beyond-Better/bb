import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';
import { readFromBbDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';

export default class ApiClient {
	private baseUrl: string;
	private wsUrl: string;
	//private httpClient: Deno.HttpClient;
	//private fetchArgs: RequestInit & {client: Deno.HttpClient};

	private constructor(baseUrl: string, wsUrl: string, _rootCert: string) {
		this.baseUrl = baseUrl;
		this.wsUrl = wsUrl;
		// [TODO] the custom httpClient doesn't solve websocket connections
		// So using --unsafely-ignore-certificate-errors=localhost on cli instead
		// It's set in `build` task in deno.jsonc and in scripts/bb shebang
		//this.httpClient = Deno.createHttpClient({ caCerts: [rootCert] });
	}

	static async create(
		startDir: string,
		hostname?: string,
		port?: number,
		useTls?: boolean,
	): Promise<ApiClient> {
		const fullConfig = await ConfigManager.fullConfig(startDir);
		const apiHostname = hostname || fullConfig.api.apiHostname || 'localhost';
		const apiPort = port || fullConfig.api.apiPort || 3000;
		const apiUseTls = typeof useTls !== 'undefined'
			? useTls
			: typeof fullConfig.api.apiUseTls !== 'undefined'
			? fullConfig.api.apiUseTls
			: true;
		const baseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
		const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
		const rootCert = fullConfig.api.tlsRootCaPem ||
			await readFromBbDir(startDir, fullConfig.api.tlsRootCaFile || 'rootCA.pem') ||
			await readFromGlobalConfigDir(fullConfig.api.tlsRootCaFile || 'rootCA.pem') || '';

		logger.debug(`APIClient: client created with baseUrl: ${baseUrl}, wsUrl: ${wsUrl}`);
		return new ApiClient(baseUrl, wsUrl, rootCert);
	}

	async get(endpoint: string) {
		try {
			//logger.info(`APIClient: GET request to: ${this.baseUrl}${endpoint}`);
			//const response = await fetch(`${this.baseUrl}${endpoint}`, { client: this.httpClient });
			const response = await fetch(`${this.baseUrl}${endpoint}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response;
		} catch (error) {
			logger.error(`APIClient: GET request failed for ${endpoint}: ${(error as Error).message}`);
			throw error;
		}
	}

	async post(endpoint: string, data: Record<string, unknown>) {
		try {
			//logger.info(`APIClient: POST request to: ${this.baseUrl}${endpoint}`);
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
				//client: this.httpClient,
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response;
		} catch (error) {
			logger.error(`APIClient: POST request failed for ${endpoint}: ${(error as Error).message}`);
			throw error;
		}
	}

	connectWebSocket(endpoint: string): Promise<WebSocket> {
		const fullWsUrl = `${this.wsUrl}${endpoint}`;
		//logger.info(`APIClient: Connecting WebSocket to: ${fullWsUrl}`);
		const ws = new WebSocket(fullWsUrl);

		return new Promise((resolve, reject) => {
			ws.onopen = () => {
				//logger.info('APIClient: WebSocket connection opened');
				resolve(ws);
			};
			ws.onerror = (error: Event) => {
				//logger.error('APIClient: WebSocket connection error:', error);
				const errorEvent = error as ErrorEvent;
				logger.error(
					`APIClient: WebSocket connection error: ${errorEvent.message} - ${
						(errorEvent.target as WebSocket).url
					}`,
				);
				reject(error);
			};
		});
	}
}
