import { defineConfig } from '$fresh/server.ts';
import tailwind from '$fresh/plugins/tailwind.ts';
import { getProjectId, getProjectRootFromStartDir, readFromBbDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import { supabaseAuthPlugin } from './plugins/supabaseAuth.ts';

const configManager = await ConfigManagerV2.getInstance();
const globalConfig = await configManager.getGlobalConfig();
const globalRedactedConfig = await configManager.getRedactedGlobalConfig();
//console.log('BUI Config: ', globalRedactedConfig);

const environment = globalConfig.bui.environment || 'local';
const hostname = globalConfig.bui.hostname || 'localhost';
const port = globalConfig.bui.port || 8000;
const useTls = globalConfig.bui.tls?.useTls ?? true;

// it appears that Deno Fresh doesn't honour the `hostname` option - it's always 'localhost'
let listenOpts: Deno.ListenOptions = { hostname, port };

if (useTls) {
	// CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly
	let projectId;
	try {
		const startDir = Deno.cwd();
		const projectRoot = await getProjectRootFromStartDir(startDir);
		projectId = await getProjectId(projectRoot);
	} catch (error) {
		projectId = undefined;
	}

	const cert = globalConfig.bui.tls.certPem ||
		(projectId ? await readFromBbDir(projectId, globalConfig.bui.tls.certFile || 'localhost.pem') : false) ||
		await readFromGlobalConfigDir(globalConfig.bui.tls.certFile || 'localhost.pem') || '';
	const key = globalConfig.bui.tls.keyPem ||
		(projectId ? await readFromBbDir(projectId, globalConfig.bui.tls.keyFile || 'localhost-key.pem') : false) ||
		await readFromGlobalConfigDir(globalConfig.bui.tls.keyFile || 'localhost-key.pem') || '';

	listenOpts = { ...listenOpts, secure: true, cert, key } as Deno.TcpListenOptions;
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
		supabaseAuthPlugin(globalConfig.bui),
// 		{
// 			name: 'supabase_auth'
// 		},

	],
	// build: {
	// 	esbuild: {
	// 		loader: {
	// 			'.wasm': 'file',
	// 		},
	// 	},
	// },
	...listenOpts,
});
