/*
 * License: AGPL-3.0-or-later
 * Copyright: 2025 - Beyond Better <charlie@beyondbetter.app>
 */

import { defineConfig } from '$fresh/server.ts';
import tailwind from '$fresh/plugins/tailwind.ts';
import { join } from '@std/path';
import { parseArgs } from '@std/cli';
import { getProjectId, getWorkingRootFromStartDir, readFromBbDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { getAppRuntimeDir } from '../../cli/src/utils/apiStatus.utils.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { BuiConfig, ProjectConfig } from 'shared/config/types.ts';
import { getVersionInfo } from 'shared/version.ts';
import { buiFileLogger } from 'bui/utils/fileLogger.ts';
//import { supabaseAuthPlugin } from './plugins/supabaseAuth.ts';
//import { authPlugin } from './plugins/auth.plugin.ts';
import { stateConfigPlugin } from './plugins/stateConfig.plugin.ts';
import type { FreshAppState } from 'bui/types/state.ts';

// CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-bui directly

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
let buiConfig: BuiConfig;

if (projectId) {
	await configManager.ensureLatestProjectConfig(projectId);
	projectConfig = await configManager.getProjectConfig(projectId);
	buiConfig = (projectConfig.bui || globalConfig.bui) as BuiConfig;
} else {
	buiConfig = globalConfig.bui as BuiConfig;
}

const environment = buiConfig.environment || 'local';
const hostname = buiConfig.hostname || 'localhost';
const port = buiConfig.port || 8080;
const useTls = buiConfig.tls?.useTls ?? true;

// Parse command line arguments
const args = parseArgs(Deno.args, {
	string: ['log-file', 'port', 'hostname', 'use-tls'],
	boolean: ['help', 'version'],
	alias: { h: 'help', V: 'version', v: 'version', p: 'port', H: 'hostname', t: 'use-tls', l: 'log-file' },
});

if (args.help) {
	console.log(`
Usage: ${globalConfig.bbBuiExeName} [options]

Options:
  -h, --help                Show this help message
  -V, --version             Show version information
  -H, --hostname <string>   Specify the hostname to run the BUI server (default: ${hostname})
  -p, --port <number>       Specify the port to run the BUI server (default: ${port})
  -t, --use-tls <boolean>   Specify whether the BUI server should use TLS (default: ${useTls})
  -l, --log-file <file>     Specify a log file to write output
  `);
	Deno.exit(0);
}

if (args.version) {
	const versionInfo = await getVersionInfo();
	console.log(`BB BUI version ${versionInfo.version}`);
	Deno.exit(0);
}

// Redirect console.log and console.error to the log file
const buiLogFile = args['log-file'];
if (buiLogFile) await buiFileLogger(buiLogFile);

const customHostname = args.hostname ? args.hostname : hostname;
const customPort: number = args.port ? parseInt(args.port, 10) : port;
const customUseTls: boolean = typeof args['use-tls'] !== 'undefined'
	? (args['use-tls'] === 'true' ? true : false)
	: useTls;
//console.debug(`BB BUI starting at ${customHostname}:${customPort}`);

const writePidFile = async (): Promise<string | null> => {
	try {
		const runtimeDir = await getAppRuntimeDir();
		const pidFile = join(runtimeDir, 'bui.pid');
		//console.log(`Writing PID to ${pidFile}`);
		await Deno.writeTextFile(pidFile, Deno.pid.toString());
		console.log(`PID file written: ${pidFile} with PID: ${Deno.pid}`);
		return pidFile;
	} catch (error) {
		console.error('Error writing PID file:', error);
		return null;
	}
};

const cleanupSetup = (pidFile: string | null) => {
	try {
		// Set up cleanup on exit
		const cleanup = async (code: number = 0) => {
			try {
				if (pidFile) {
					await Deno.remove(pidFile);
					console.log('PID file removed');
					Deno.exit(code);
				} else {
					Deno.exit(2);
				}
			} catch (error) {
				console.error('Error removing PID file:', error);
			} finally {
				Deno.exit(1);
			}
		};

		// Handle various exit signals
		// Windows only supports SIGINT and SIGBREAK, while Unix-like systems support SIGINT and SIGTERM
		const signals: Deno.Signal[] = Deno.build.os === 'windows' ? ['SIGINT', 'SIGBREAK'] : ['SIGINT', 'SIGTERM'];
		for (const signal of signals) {
			Deno.addSignalListener(signal, cleanup);
		}
		//addEventListener('unload', cleanup);
	} catch (error) {
		console.error('Error creating shutdown handlers:', error);
	}
};

// Write PID file on startup
const pidFile = await writePidFile();
cleanupSetup(pidFile);

const versionInfo = await getVersionInfo();

// Fresh server configuration
let serverConfig: {
	hostname: string;
	port: number;
	cert?: string;
	key?: string;
	onListen({ hostname, port }: { hostname: string; port: number }): void;
} = {
	hostname: customHostname,
	port: customPort,
	onListen({ hostname, port }: { hostname: string; port: number }) {
		console.info(`BUIStartup: Starting BUI v${versionInfo.version} with config:`, globalRedactedConfig);
		console.info(`BUIStartup: Version: ${versionInfo.version}`);
		console.info(`BUIStartup: Environment: ${environment}`);
		console.info(`BUIStartup: Log level: ${buiConfig.logLevel}`);
		console.info(
			`BUIStartup: Listening on: ${customUseTls ? 'https://' : 'http://'}${hostname ?? 'localhost'}:${port}`,
		);
	},
};

if (customUseTls) {
	// CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-bui directly
	let projectId;
	try {
		const startDir = Deno.cwd();
		const workingRoot = await getWorkingRootFromStartDir(startDir);
		projectId = await getProjectId(workingRoot);
	} catch (_error) {
		projectId = undefined;
	}

	const cert = globalConfig.bui.tls.certPem ||
		(projectId ? await readFromBbDir(projectId, globalConfig.bui.tls.certFile || 'localhost.pem') : false) ||
		await readFromGlobalConfigDir(globalConfig.bui.tls.certFile || 'localhost.pem') || '';
	const key = globalConfig.bui.tls.keyPem ||
		(projectId ? await readFromBbDir(projectId, globalConfig.bui.tls.keyFile || 'localhost-key.pem') : false) ||
		await readFromGlobalConfigDir(globalConfig.bui.tls.keyFile || 'localhost-key.pem') || '';

	serverConfig = { ...serverConfig, cert, key };
}

// Highlight.js theme styles
const highlightStyles = {
	styles: {
		'code[class*="language-"]': {
			color: '#333',
			background: '#f5f5f5',
			textShadow: 'none',
			fontFamily: 'ui-monospace, monospace',
			fontSize: '0.8em',
			textAlign: 'left',
			whiteSpace: 'pre',
			wordSpacing: 'normal',
			wordBreak: 'normal',
			wordWrap: 'normal',
			lineHeight: '1.5',
			tabSize: '4',
			hyphens: 'none',
		},
		'pre[class*="language-"]': {
			color: '#333',
			background: '#f5f5f5',
			textShadow: 'none',
			fontFamily: 'ui-monospace, monospace',
			fontSize: '0.8em',
			textAlign: 'left',
			whiteSpace: 'pre',
			wordSpacing: 'normal',
			wordBreak: 'normal',
			wordWrap: 'normal',
			lineHeight: '1.5',
			tabSize: '4',
			hyphens: 'none',
			padding: '1em',
			margin: '0.5em 0',
			overflow: 'auto',
			borderRadius: '0.375rem',
		},
		'.hljs-comment': { color: '#998', fontStyle: 'italic' },
		'.hljs-keyword': { color: '#333', fontWeight: 'bold' },
		'.hljs-string': { color: '#d14' },
		'.hljs-number': { color: '#099' },
		'.hljs-function': { color: '#900', fontWeight: 'bold' },
		'.hljs-title': { color: '#900', fontWeight: 'bold' },
		'.hljs-params': { color: '#333' },
		'.hljs-type': { color: '#458', fontWeight: 'bold' },
		'.hljs-literal': { color: '#099' },
		'.hljs-symbol': { color: '#990073' },
		'.hljs-property': { color: '#333' },
		'.hljs-attr': { color: '#333' },
		'.hljs-selector': { color: '#900' },
		'.hljs-operator': { color: '#9a6e3a' },
	},
};

export default defineConfig({
	plugins: [
		tailwind(),
		{
			name: 'highlight.js-theme',
			...highlightStyles,
		},
		stateConfigPlugin({ buiConfig, user: null, session: null }),
	],
	// build: {
	// 	esbuild: {
	// 		loader: {
	// 			'.wasm': 'file',
	// 		},
	// 	},
	// },
	server: serverConfig,
});
