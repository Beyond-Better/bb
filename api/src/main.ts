/*
 * License: AGPL-3.0-or-later
 * Copyright: 2025 - Beyond Better <charlie@beyondbetter.app>
 */

import { Application } from '@oak/oak';
import type { ListenOptions, ListenOptionsTls } from '@oak/oak';
//import oak_logger from 'oak_logger';
import oak_logger from './middlewares/logger.middleware.ts';
import { parseArgs } from '@std/cli';
import { oakCors } from 'cors';

import { getConfigManager } from 'shared/config/configManager.ts';
import type { ApiConfig, ProjectConfig } from 'shared/config/types.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import type { BbState } from 'api/types.ts';
import { getProjectId, getWorkingRootFromStartDir, readFromBbDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { apiFileLogger } from 'api/utils/fileLogger.ts';
import { getVersionInfo } from 'shared/version.ts';
import { SessionManager } from 'api/auth/session.ts';
import { KVManager } from 'api/utils/kvManager.ts';
import { setApiBaseUrl } from 'api/utils/apiBaseUrl.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import { StorageMigration } from 'api/storage/storageMigration.ts';

// CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly

let projectId;
try {
	const startDir = Deno.cwd();
	const workingRoot = await getWorkingRootFromStartDir(startDir);
	projectId = await getProjectId(workingRoot);
} catch (_error) {
	//console.error(`Could not set ProjectId: ${(error as Error).message}`);
	projectId = undefined;
}

const configManager = await getConfigManager();

// Ensure configs are at latest version
await configManager.ensureLatestGlobalConfig();
const globalConfig = await configManager.getGlobalConfig();
const globalRedactedConfig = await configManager.getRedactedGlobalConfig();

let projectConfig: ProjectConfig | undefined;
let apiConfig: ApiConfig;

if (projectId) {
	await configManager.ensureLatestProjectConfig(projectId);
	projectConfig = await configManager.getProjectConfig(projectId);
	apiConfig = projectConfig.api as ApiConfig || globalConfig.api;
} else {
	apiConfig = globalConfig.api;
}

const environment = apiConfig.environment || 'local';
const hostname = apiConfig.hostname || 'localhost';
const port = apiConfig.port || 3162;
const useTls = apiConfig.tls?.useTls ?? false;

// Parse command line arguments
const args = parseArgs(Deno.args, {
	string: ['log-file', 'port', 'hostname', 'use-tls'],
	boolean: ['help', 'version'],
	alias: { h: 'help', V: 'version', v: 'version', p: 'port', H: 'hostname', t: 'use-tls', l: 'log-file' },
});

if (args.help) {
	console.log(`
Usage: ${globalConfig.bbApiExeName} [options]

Options:
  -h, --help                Show this help message
  -V, --version             Show version information
  -H, --hostname <string>   Specify the hostname to run the API server (default: ${hostname})
  -p, --port <number>       Specify the port to run the API server (default: ${port})
  -t, --use-tls <boolean>   Specify whether the API server should use TLS (default: ${useTls})
  -l, --log-file <file>     Specify a log file to write output
  `);
	Deno.exit(0);
}

if (args.version) {
	const versionInfo = await getVersionInfo();
	console.log(`BB API version ${versionInfo.version}`);
	Deno.exit(0);
}

// Redirect console.log and console.error to the log file
const apiLogFile = args['log-file'];
if (apiLogFile) await apiFileLogger(apiLogFile);

const customHostname = args.hostname ? args.hostname : hostname;
const customPort: number = args.port ? parseInt(args.port, 10) : port;
const customUseTls: boolean = typeof args['use-tls'] !== 'undefined'
	? (args['use-tls'] === 'true' ? true : false)
	: useTls;
//console.debug(`BB API starting at ${customHostname}:${customPort}`);

// Initialize auth system
const sessionManager = new SessionManager();
await sessionManager.initialize();
logger.info('APIStartup: Auth system initialized');

const registryService = await ModelRegistryService.getInstance(projectConfig);
//logger.info('APIStartup: Model Registry initialized', registryService.getAllModels());
logger.info(`APIStartup: Model Registry initialized with ${registryService.getAllModels().length} models`);
//logger.info('APIStartup: Model Registry Ollama models', registryService.getModelsByProvider('ollama'));

// Run storage migration at startup
try {
	await StorageMigration.migrateAllProjectsAtStartup();
	logger.info('APIStartup: Storage migration completed successfully');
} catch (error) {
	logger.error(`APIStartup: Storage migration failed: ${(error as Error).message}`);
	// Continue startup even if migration fails - individual projects will retry migration as needed
}

const app = new Application<BbState>();

// Set up app state
app.state = {
	auth: {
		sessionManager,
	},
	apiConfig,
};

app.use(oak_logger.logger);
if (apiConfig.logLevel === 'debug') {
	app.use(oak_logger.responseTime);
}

app.use(oakCors({
	origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/((www|chat)\.)?(bbai\.tips|beyondbetter\.(app|dev|team))$/],
})); // Enable CORS for localhost, bbai.tips, and chat.bbai.tips, beyondbetter.app, and chat.beyondbetter.app, beyondbetter.dev, and chat.beyondbetter.dev
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener(
	'listen',
	async ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
		const versionInfo = await getVersionInfo();
		logger.info(`APIStartup: Starting API v${versionInfo.version} with config:`, globalRedactedConfig);
		if (apiConfig.ignoreLLMRequestCache) {
			logger.warn('APIStartup: Cache for LLM requests is disabled!');
		}
		logger.info(`APIStartup: Version: ${versionInfo.version}`);
		logger.info(`APIStartup: Environment: ${environment}`);
		logger.info(`APIStartup: Log level: ${apiConfig.logLevel}`);
		logger.info(`APIStartup: Listening on: ${secure ? 'https://' : 'http://'}${hostname ?? 'localhost'}:${port}`);
	},
);
app.addEventListener('error', (evt: ErrorEvent) => {
	logger.error(`APIStartup: Application error:`, evt.error);
});

const cleanup = async (code: number = 0) => {
	try {
		await KVManager.closeAll();
		Deno.exit(code);
	} catch (error) {
		console.error('APICleanup: Error cleaning up:', error);
	} finally {
		Deno.exit(1);
	}
};
// Windows only supports SIGINT and SIGBREAK, while Unix-like systems support SIGINT and SIGTERM
const signals: Deno.Signal[] = Deno.build.os === 'windows' ? ['SIGINT', 'SIGBREAK'] : ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
	Deno.addSignalListener(signal, cleanup);
}

addEventListener('unhandledrejection', (event) => {
	logger.error('APIEventLoop: Unhandled Promise Rejection at:', event.promise, 'reason:', event.reason);
	// Optionally prevent default behavior (though this doesn't stop the error)
	event.preventDefault();
});

if (import.meta.main) {
	// Initialize API base URL for use throughout the application
	const baseUrl = `${customUseTls ? 'https' : 'http'}://${customHostname}:${customPort}`;
	setApiBaseUrl(baseUrl);
	logger.info(`APIStartup: Set API base URL to ${baseUrl}`);

	let listenOpts: ListenOptions = { hostname: customHostname, port: customPort };
	if (customUseTls) {
		const cert = apiConfig.tls.certPem ||
			(projectId ? await readFromBbDir(projectId, apiConfig.tls.certFile || 'localhost.pem') : false) ||
			await readFromGlobalConfigDir(apiConfig.tls.certFile || 'localhost.pem') || '';
		const key = apiConfig.tls.keyPem ||
			(projectId ? await readFromBbDir(projectId, apiConfig.tls.keyFile || 'localhost-key.pem') : false) ||
			await readFromGlobalConfigDir(apiConfig.tls.keyFile || 'localhost-key.pem') || '';

		listenOpts = { ...listenOpts, secure: true, cert, key } as ListenOptionsTls;
	}

	try {
		await app.listen(listenOpts);
	} catch (error) {
		logger.error(`APIStartup: Failed to start server: ${(error as Error).message}`);
		logger.error(`APIStartup: Stack trace: ${(error as Error).stack}`);
		Deno.exit(1);
	}
}

export { app };
