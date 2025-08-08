import { assertEquals, assertExists } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import {
	type ApiConfig,
	ApiConfigDefaults,
	type BuiConfig,
	BuiConfigDefaults,
	type CliConfig,
	CliConfigDefaults,
	type DuiConfig,
	DuiConfigDefaults,
	type GlobalConfig,
	GlobalConfigDefaults,
	type ProjectConfig,
	type ServerConfig,
	type TlsConfig,
} from '../mod.ts';

describe('Configuration Types', () => {
	describe('TLS Configuration', () => {
		it('should allow minimal TLS config', () => {
			const config: TlsConfig = {
				useTls: true,
			};
			assertExists(config);
		});

		it('should allow full TLS config', () => {
			const config: TlsConfig = {
				useTls: true,
				keyFile: 'key.pem',
				certFile: 'cert.pem',
				rootCaFile: 'ca.pem',
				keyPem: '-----BEGIN PRIVATE KEY-----',
				certPem: '-----BEGIN CERTIFICATE-----',
				rootCaPem: '-----BEGIN CERTIFICATE-----',
			};
			assertExists(config);
		});
	});

	describe('Server Configuration', () => {
		it('should require hostname and port', () => {
			const config: ServerConfig = {
				hostname: 'localhost',
				port: 3162,
				tls: { useTls: true },
			};
			assertExists(config);
		});
	});

	describe('API Configuration', () => {
		it('should include server config fields', () => {
			const config: ApiConfig = {
				hostname: 'localhost',
				port: 3162,
				tls: { useTls: true },
				maxTurns: 25,
				logLevel: 'info',
				logFileHydration: false,
				ignoreLLMRequestCache: false,
				usePromptCaching: true,
				userPluginDirectories: ['./plugins'],
				toolConfigs: {},
			};
			assertExists(config);
		});

		it('should provide correct defaults', () => {
			const defaults = ApiConfigDefaults;
			assertEquals(defaults.hostname, 'localhost');
			assertEquals(defaults.port, 3162);
			assertEquals(defaults.maxTurns, 25);
			assertEquals(defaults.logLevel, 'info');
			assertEquals(defaults.usePromptCaching, true);
		});
	});

	describe('BUI Configuration', () => {
		it('should include server config fields', () => {
			const config: BuiConfig = {
				hostname: 'localhost',
				port: 8080,
				tls: { useTls: true },
				logLevel: 'info',
				googleOauth: {
					redirectUri: 'https://localhost:8080/oauth/google/callback',
					clientId: '983662643295-xxxx.apps.googleusercontent.com',
					clientSecret: 'GO-xxxx',
				},
			};
			assertExists(config);
		});

		it('should provide correct defaults', () => {
			const defaults = BuiConfigDefaults;
			assertEquals(defaults.hostname, 'localhost');
			assertEquals(defaults.port, 8080);
			assertEquals(defaults.tls.useTls, false);
			assertEquals(defaults.logLevel, 'info');
		});
	});

	describe('CLI Configuration', () => {
		it('should allow optional editor setting', () => {
			const config: CliConfig = {
				historySize: 1000,
			};
			assertExists(config);

			const withEditor: CliConfig = {
				defaultEditor: 'vim',
				historySize: 1000,
			};
			assertExists(withEditor);
		});

		it('should provide correct defaults', () => {
			const defaults = CliConfigDefaults;
			assertEquals(defaults.historySize, 1000);
		});
	});

	describe('DUI Configuration', () => {
		it('should handle default API config', () => {
			const config: DuiConfig = {
				defaultApiConfig: {},
				projectsDirectory: './projects',
				recentProjects: 5,
			};
			assertExists(config);
		});

		it('should provide correct defaults', () => {
			const defaults = DuiConfigDefaults;
			assertEquals(defaults.projectsDirectory, './projects');
			assertEquals(defaults.recentProjects, 5);
		});
	});

	describe('Global Configuration', () => {
		it('should combine all component configs', () => {
			const config: GlobalConfig = {
				version: '2.2.1',
				myPersonsName: 'Test User',
				myAssistantsName: 'Assistant',
				defaultModels: {
					orchestrator: 'claude-3-7-sonnet-20250219',
					agent: 'claude-3-7-sonnet-20250219',
					chat: 'claude-3-haiku-20240307',
				},
				noBrowser: false,
				bbExeName: 'bb',
				bbApiExeName: 'bb-api',
				bbBuiExeName: 'bb-bui',
				api: {
					hostname: 'localhost',
					port: 3162,
					tls: { useTls: true },
					maxTurns: 25,
					logLevel: 'info',
					logFileHydration: false,
					ignoreLLMRequestCache: false,
					usePromptCaching: true,
					userPluginDirectories: ['./plugins'],
					toolConfigs: {},
				},
				bui: {
					hostname: 'localhost',
					port: 8080,
					tls: { useTls: true },
					logLevel: 'info',
					googleOauth: {
						redirectUri: 'https://localhost:8080/oauth/google/callback',
						clientId: '983662643295-xxxx.apps.googleusercontent.com',
						clientSecret: 'GO-xxxx',
					},
				},
				cli: {
					historySize: 1000,
				},
				dui: {
					defaultApiConfig: {},
					projectsDirectory: './projects',
					recentProjects: 5,
				},
			};
			assertExists(config);
		});

		it('should provide correct defaults', () => {
			const defaults = GlobalConfigDefaults;
			assertEquals(defaults.myPersonsName, Deno.env.get('USER') || 'User');
			assertEquals(defaults.myAssistantsName, 'Assistant');
			assertEquals(defaults.noBrowser, false);
			assertExists(defaults.api);
			assertExists(defaults.bui);
			assertExists(defaults.cli);
			assertExists(defaults.dui);
		});
	});

	describe('Project Configuration', () => {
		it('should handle minimal config', () => {
			const config: ProjectConfig = {
				projectId: '123456789abc',
				version: '2.2.0',
				name: 'Test Project',
				repoInfo: { tokenLimit: 1024 },
			};
			assertExists(config);
		});

		it('should handle component overrides', () => {
			const config: ProjectConfig = {
				projectId: '123456789abc',
				version: '2.2.0',
				name: 'Test Project',
				repoInfo: { tokenLimit: 1024 },
				api: {
					port: 3001,
					tls: { useTls: false },
				},
				bui: {
					port: 8001,
				},
			};
			assertExists(config);
		});
	});
});
