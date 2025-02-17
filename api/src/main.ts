import { Application } from '@oak/oak';
import type { ListenOptions, ListenOptionsTls } from '@oak/oak';
import oak_logger from 'oak_logger';
import { parseArgs } from '@std/cli';
import { oakCors } from 'cors';

import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { ApiConfig } from 'shared/config/v2/types.ts';
import router from './routes/routes.ts';
import { logger } from 'shared/logger.ts';
import type { BbState } from 'api/types.ts';
import { getProjectId, getProjectRootFromStartDir, readFromBbDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { apiFileLogger } from 'api/utils/fileLogger.ts';
import { getVersionInfo } from 'shared/version.ts';
import { SessionManager } from './auth/session.ts';
import { KVManager } from 'api/utils/kvManager.ts';

// CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly

let projectId;
try {
	const startDir = Deno.cwd();
	const projectRoot = await getProjectRootFromStartDir(startDir);
	projectId = await getProjectId(projectRoot);
} catch (_error) {
	//console.error(`Could not set ProjectId: ${(error as Error).message}`);
	projectId = undefined;
}

const configManager = await ConfigManagerV2.getInstance();

// Ensure configs are at latest version
await configManager.ensureLatestGlobalConfig();
const globalConfig = await configManager.getGlobalConfig();
const globalRedactedConfig = await configManager.getRedactedGlobalConfig();

let apiConfig: ApiConfig;

if (projectId) {
	await configManager.ensureLatestProjectConfig(projectId);
	const projectConfig = await configManager.getProjectConfig(projectId);
	apiConfig = projectConfig.settings.api as ApiConfig || globalConfig.api;
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
  -t, --use-tls <boolean>    Specify whether the API server should use TLS (default: ${useTls})
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
logger.info('Auth system initialized');

const app = new Application<BbState>();

// Set up app state
app.state = {
	auth: {
		sessionManager,
	},
};

app.use(oak_logger.logger);
if (apiConfig.logLevel === 'debug') {
	app.use(oak_logger.responseTime);
}

app.use(oakCors({
	origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/((www|chat)\.)?(bbai\.tips|beyondbetter\.dev)$/],
})); // Enable CORS for localhost, bbai.tips, and chat.bbai.tips, beyondbetter.dev, and chat.beyondbetter.dev
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', ({ hostname, port, secure }: { hostname: string; port: number; secure: boolean }) => {
	logger.info(`Starting API with config:`, globalRedactedConfig);
	if (apiConfig.ignoreLLMRequestCache) {
		logger.warn('Cache for LLM requests is disabled!');
	}
	logger.info(`Environment: ${environment}`);
	logger.info(`Log level: ${apiConfig.logLevel}`);
	logger.info(`Listening on: ${secure ? 'https://' : 'http://'}${hostname ?? 'localhost'}:${port}`);
});
app.addEventListener('error', (evt: ErrorEvent) => {
	logger.error(`Application error:`, evt.error);
});

const cleanup = async (code: number = 0) => {
	try {
		await KVManager.closeAll();
		Deno.exit(code);
	} catch (error) {
		console.error('Error cleaning up:', error);
	} finally {
		Deno.exit(1);
	}
};
// Windows only supports SIGINT and SIGBREAK, while Unix-like systems support SIGINT and SIGTERM
const signals: Deno.Signal[] = Deno.build.os === 'windows' ? ['SIGINT', 'SIGBREAK'] : ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
	Deno.addSignalListener(signal, cleanup);
}

if (import.meta.main) {
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
		logger.error(`Failed to start server: ${(error as Error).message}`);
		logger.error(`Stack trace: ${(error as Error).stack}`);
		Deno.exit(1);
	}
}

export { app };
