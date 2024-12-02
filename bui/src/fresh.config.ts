import { defineConfig } from '$fresh/server.ts';
import tailwind from '$fresh/plugins/tailwind.ts';
import { readFromBbDir, readFromGlobalConfigDir } from 'shared/dataDir.ts';
import { ConfigManager } from 'shared/configManager.ts';

// CWD is set by `bb` in Deno.Command, or implicitly set by user if calling bb-api directly
const startDir = Deno.cwd();
const fullConfig = await ConfigManager.fullConfig(startDir);
const redactedFullConfig = await ConfigManager.redactedFullConfig(startDir);
const { buiHostname, buiPort, buiUseTls } = fullConfig.bui;

// it appears that Deno Fresh doesn't honour the `hostname` option - it's always 'localhost'
let listenOpts: Deno.ListenOptions = { hostname: buiHostname, port: buiPort || 8000 };

if (buiUseTls) {
	const cert = fullConfig.bui.tlsCertPem ||
		await readFromBbDir(startDir, fullConfig.bui.tlsCertFile || 'localhost.pem') ||
		await readFromGlobalConfigDir(fullConfig.bui.tlsCertFile || 'localhost.pem') || '';
	const key = fullConfig.bui.tlsKeyPem ||
		await readFromBbDir(startDir, fullConfig.bui.tlsKeyFile || 'localhost-key.pem') ||
		await readFromGlobalConfigDir(fullConfig.bui.tlsKeyFile || 'localhost-key.pem') || '';

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
