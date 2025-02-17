import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import type { GlobalConfig, MigrationResult, ProjectConfig, ValidationResult } from '../types.ts';
import { ConfigManagerV2 } from '../mod.ts';
import { GlobalConfigSchema as GlobalConfigV1, ProjectConfigSchema as ProjectConfigV1 } from '../../configSchema.ts';

describe('ConfigManagerV2', () => {
	let testDir: string;
	let configManager: ConfigManagerV2;

	beforeEach(async () => {
		// Create test directory
		testDir = await Deno.makeTempDir();
		// Set custom global config directory
		Deno.env.set('BB_GLOBAL_CONFIG_DIR', testDir);

		await ensureDir(join(testDir, '.bb'));
		await ensureDir(join(testDir, 'global'));

		configManager = await ConfigManagerV2.getInstance();
	});

	afterEach(async () => {
		// Clean up test directory
		await Deno.remove(testDir, { recursive: true });
	});

	describe('Global Configuration', () => {
		it('should load default global config when none exists', async () => {
			const config = await configManager.getGlobalConfig();
			assertEquals(config.version, '2.1.0');
			assertEquals(config.api.hostname, 'localhost');
			assertEquals(config.api.port, 3162);
		});

		it('should save and load global config', async () => {
			const updates: Partial<GlobalConfig> = {
				api: {
					hostname: 'localhost',
					port: 3162,
					maxTurns: 25,
					logLevel: 'info',
					logFileHydration: false,
					ignoreLLMRequestCache: false,
					usePromptCaching: true,
					userToolDirectories: ['./tools'],
					toolConfigs: {},
					tls: {
						useTls: true,
					},
				},
			};

			await configManager.updateGlobalConfig(updates);
			const config = await configManager.getGlobalConfig();

			assertEquals(config.api.hostname, 'localhost');
			assertEquals(config.api.port, 3162);
		});

		it('should reject invalid global config updates', async () => {
			const updates = {
				api: {
					port: 'invalid', // Should be number
					maxTurns: 25,
					logLevel: 'info' as const,
					logFileHydration: false,
					ignoreLLMRequestCache: false,
					usePromptCaching: true,
					userToolDirectories: ['./tools'],
					toolConfigs: {},
					tls: { useTls: true },
					hostname: 'localhost',
				},
			} as unknown as Partial<GlobalConfig>;

			await assertRejects(
				() => configManager.updateGlobalConfig(updates as Partial<GlobalConfig>),
				Error,
				'Invalid configuration',
			);
		});
	});

	describe('Project Management', () => {
		it('should create new project with valid ID', async () => {
			const projectId = await configManager.createProject({ name: 'Test Project', type: 'local', path: testDir });

			assertExists(projectId);
			assertEquals(projectId.length, 12);

			// Verify config file created
			const configPath = join(testDir, '.bb', 'config.yaml');
			const stat = await Deno.stat(configPath);
			assertEquals(stat.isFile, true);
		});

		it('should load project config after creation', async () => {
			const projectId = await configManager.createProject({ name: 'Test Project', type: 'local', path: testDir });
			const config = await configManager.getProjectConfig(projectId);

			assertEquals(config.name, 'Test Project');
			assertEquals(config.type, 'local');
			assertEquals(config.version, '2.1.0');
		});

		it('should update project config', async () => {
			const projectId = await configManager.createProject({ name: 'Test Project', type: 'local', path: testDir });

			const updates: Partial<ProjectConfig> = {
				settings: {
					api: {
						port: 3001,
						tls: {
							useTls: true,
						},
					},
				},
			};

			await configManager.updateProjectConfig(projectId, updates);

			const config = await configManager.getProjectConfig(projectId);
			assertEquals(config.settings.api?.port, 3001);
		});

		it('should reject invalid project paths', async () => {
			await assertRejects(
				() => configManager.createProject({ name: 'Test Project', type: 'local', path: '/invalid/path' }),
				Error,
				'Project path /invalid/path does not exist',
			);
		});
	});

	describe('Migration', () => {
		it('should migrate v1 global config to v21', async () => {
			const v1Config = {
				version: '1.0.0',
				myPersonsName: 'TestUser',
				myAssistantsName: 'TestAssistant',
				noBrowser: false,
				api: {
					apiHostname: 'localhost',
					apiPort: 3162,
					apiUseTls: true,
					maxTurns: 25,
					logLevel: 'info',
					logFileHydration: false,
					ignoreLLMRequestCache: false,
					usePromptCaching: true,
					userToolDirectories: ['./tools'],
					toolConfigs: {},
				},
				bui: {
					buiHostname: 'localhost',
					buiPort: 8080,
					buiUseTls: true,
				},
				cli: {
					historySize: 1000,
				},
			} as unknown as GlobalConfigV1;

			const result = await configManager.migrateConfig(v1Config);
			//console.log('Migration result:', result);

			assertEquals(result.success, true);
			assertEquals(result.version.from, '1.0.0');
			assertEquals(result.version.to, '2.1.0');
			assertExists(result.backupPath);

			// Verify changes tracked
			// Check version change
			// const versionChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'version'
			// );
			// assertExists(versionChange);
			// assertEquals(versionChange.from, '1.0.0');
			// assertEquals(versionChange.to, '2.1.0');
			//
			// // Check port change
			// const portChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'api.port'
			// );
			// assertExists(portChange);
			// assertEquals(portChange.from, 3162);
			// assertEquals(portChange.to, 3162);
			//
			// // Check hostname change
			// const hostnameChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'api.hostname'
			// );
			// assertExists(hostnameChange);
			// assertEquals(hostnameChange.from, 'localhost');
			// assertEquals(hostnameChange.to, 'localhost');
		});

		it('should migrate v1 project config to v21', async () => {
			const v1Config = {
				version: '1.0.0',
				project: {
					name: 'Old Project',
					type: 'local',
				},
				api: {
					apiHostname: 'localhost',
					apiPort: 3162,
					apiUseTls: true,
					maxTurns: 25,
					logLevel: 'info',
					logFileHydration: false,
					ignoreLLMRequestCache: false,
					usePromptCaching: true,
					userToolDirectories: ['./tools'],
					toolConfigs: {},
				},
				bui: {
					buiHostname: 'localhost',
					buiPort: 8080,
					buiUseTls: true,
				},
				cli: {
					historySize: 1000,
				},
			} as unknown as ProjectConfigV1;

			const result = await configManager.migrateConfig(v1Config);
			//console.log('Project migration result:', result);

			assertEquals(result.success, true);
			assertEquals(result.version.from, '1.0.0');
			assertEquals(result.version.to, '2.1.0');

			// Verify structure converted to settings
			// Check version change
			// const versionChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'version'
			// );
			// assertExists(versionChange);
			// assertEquals(versionChange.from, '1.0.0');
			// assertEquals(versionChange.to, '2.1.0');
			//
			// // Check port change
			// const portChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'settings.api.port'
			// );
			// assertExists(portChange);
			// assertEquals(portChange.from, 3162);
			// assertEquals(portChange.to, 3162);
			//
			// const hostnameChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'settings.api.hostname'
			// );
			// assertExists(hostnameChange);
			// assertEquals(hostnameChange.from, 'localhost');
			// assertEquals(hostnameChange.to, 'localhost');
		});
	});

	describe('Validation', () => {
		it('should validate global config structure', async () => {
			const invalidConfig = {
				version: '2.1.0',
				// Missing required fields
			};

			const result = await configManager.validateConfig(invalidConfig);
			assertEquals(result.isValid, false);
			assertEquals(result.errors.length > 0, true);
		});

		it('should validate project config structure', async () => {
			const invalidConfig = {
				version: '2.1.0',
				projectId: 'invalid', // Wrong format
				name: 'Test',
				type: 'invalid', // Invalid type
				settings: {},
			};

			const result = await configManager.validateConfig(invalidConfig);
			assertEquals(result.isValid, false);

			// Should have projectId and type errors
			const idError = result.errors.find((e: { path: string[]; message: string; value?: unknown }) =>
				e.path[0] === 'projectId'
			);
			const typeError = result.errors.find((e: { path: string[]; message: string; value?: unknown }) =>
				e.path[0] === 'type'
			);
			assertExists(idError);
			assertExists(typeError);
		});

		it('should validate component settings', async () => {
			const config = {
				version: '2.1.0',
				projectId: '123456789abc',
				name: 'Test',
				type: 'local',
				settings: {
					api: {
						port: 'invalid', // Should be number
						hostname: 'localhost',
						tls: { useTls: true },
						maxTurns: 25,
						logLevel: 'info',
						logFileHydration: false,
						ignoreLLMRequestCache: false,
						usePromptCaching: true,
						userToolDirectories: ['./tools'],
						toolConfigs: {},
					},
				},
			};

			const result = await configManager.validateConfig(config);
			assertEquals(result.isValid, false);

			const portError = result.errors.find((e: { path: string[]; message: string; value?: unknown }) =>
				e.path.join('.') === 'settings.api.port'
			);
			assertExists(portError);
		});
	});
});
