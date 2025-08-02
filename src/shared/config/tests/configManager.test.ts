import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import type { GlobalConfig, MigrationResult, ProjectConfig, ValidationResult } from '../types.ts';
import { type ConfigManagerV2, getConfigManager } from '../mod.ts';
import { GlobalConfigSchema as GlobalConfigV1, ProjectConfigSchema as ProjectConfigV1 } from '../configSchema.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import { FilesystemProvider } from 'api/dataSources/filesystemProvider.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';

describe('ConfigManagerV2', () => {
	let testDir: string;
	let configManager: ConfigManagerV2;

	beforeEach(async () => {
		Deno.env.set('BB_UNIT_TESTS', '1');
		// Create test directory
		testDir = await Deno.makeTempDir();
		// Set custom global config directory
		Deno.env.set('BB_GLOBAL_CONFIG_DIR', testDir);
		// Generate a unique ID for this test run
		const testInstanceId = crypto.randomUUID();
		Deno.env.set('BB_TEST_INSTANCE_ID', testInstanceId);
		//Deno.env.set('BB_NO_SINGLETON_CONFIG_MANGER', '1');
		//Deno.env.set('BB_NO_SINGLETON_PROJECT_REGISTRY', '1');

		console.log(`Using temp global dir: ${testDir}`);
		await ensureDir(join(testDir, '.bb'));
		await ensureDir(join(testDir, 'global'));

		// Force a new instance for each test
		// [TODO] choose to allow instance to be undefined??
		// TS2322 [ERROR]: Type 'undefined' is not assignable to type 'ConfigManagerV2'.
		// For now, manually create a new instance in tests.
		// ConfigManagerV2.resetInstance(); // Add this method to your class
		configManager = await getConfigManager();
	});

	afterEach(async () => {
		// Clean up test directory
		await Deno.remove(testDir, { recursive: true });
	});

	describe('Global Configuration', () => {
		it('should load default global config when none exists', async () => {
			const config = await configManager.getGlobalConfig();
			assertEquals(config.version, '2.2.0');
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
			const dataSourceRegistry = await getDataSourceRegistry();
			const dataSourceRoot = await Deno.makeTempDir();
			const dsConnection = FilesystemProvider.createFileSystemDataSource(
				'primary',
				dataSourceRoot,
				dataSourceRegistry,
				{
					id: 'ds-fs-primary',
					isPrimary: true,
					//projectConfig: projectConfig,
				},
			);

			const projectPersistenceManager = await getProjectPersistenceManager();
			const projectData = await projectPersistenceManager.createProject({
				name: 'Test Project',
				dsConnections: [dsConnection],
			});
			const projectId = projectData.projectId;

			assertExists(projectId);
			assertEquals(projectId.length, 12);
			const projectAdminDir = join(testDir, 'projects', projectId);
			Deno.env.set('BB_PROJECT_ADMIN_DIR', projectAdminDir);

			// Verify config file created
			const configPath = join(projectAdminDir, 'config.yaml');
			const stat = await Deno.stat(configPath);
			assertEquals(stat.isFile, true);

			//projectData.delete();
		});

		it('should load project config after creation', async () => {
			const dataSourceRegistry = await getDataSourceRegistry();
			const dataSourceRoot = await Deno.makeTempDir();
			const dsConnection = FilesystemProvider.createFileSystemDataSource(
				'primary',
				dataSourceRoot,
				dataSourceRegistry,
				{
					id: 'ds-fs-primary',
					isPrimary: true,
					//projectConfig: projectConfig,
				},
			);
			const projectPersistenceManager = await getProjectPersistenceManager();
			const projectData = await projectPersistenceManager.createProject({
				name: 'Test Project',
				dsConnections: [dsConnection],
			});
			const projectId = projectData.projectId;

			const projectAdminDir = join(testDir, 'projects', projectId);
			Deno.env.set('BB_PROJECT_ADMIN_DIR', projectAdminDir);

			const config = await configManager.getProjectConfig(projectId);

			assertEquals(config.name, 'Test Project');
			assertEquals(config.version, '2.2.0');

			//projectData.delete();
		});

		it('should update project config', async () => {
			const dataSourceRegistry = await getDataSourceRegistry();
			const dataSourceRoot = await Deno.makeTempDir();
			const dsConnection = FilesystemProvider.createFileSystemDataSource(
				'primary',
				dataSourceRoot,
				dataSourceRegistry,
				{
					id: 'ds-fs-primary',
					isPrimary: true,
				},
			);
			const projectPersistenceManager = await getProjectPersistenceManager();
			const projectData = await projectPersistenceManager.createProject({
				name: 'Test Project',
				dsConnections: [dsConnection],
			});
			const projectId = projectData.projectId;

			const projectAdminDir = join(testDir, 'projects', projectId);
			Deno.env.set('BB_PROJECT_ADMIN_DIR', projectAdminDir);

			const updates: Partial<ProjectConfig> = {
				api: {
					port: 3001,
					tls: {
						useTls: true,
					},
				},
			};

			await configManager.updateProjectConfig(projectId, updates);

			const config = await configManager.getProjectConfig(projectId);
			assertEquals(config.api?.port, 3001);

			//projectData.delete();
		});

		it('should reject invalid project paths', async () => {
			await assertRejects(
				async () => {
					const dataSourceRegistry = await getDataSourceRegistry();
					const dsConnection = FilesystemProvider.createFileSystemDataSource(
						'primary',
						'/invalid/path',
						dataSourceRegistry,
						{
							id: 'ds-fs-primary',
							isPrimary: true,
							//projectConfig: projectConfig,
						},
					);
					const projectPersistenceManager = await getProjectPersistenceManager();
					const projectData = await projectPersistenceManager.createProject({
						name: 'Test Project',
						dsConnections: [dsConnection],
					});
				},
				Error,
				//'Failed to create project: Read-only file system (os error 30): mkdir \'/invalid/path/.bb\'',
				'Failed to create project: ',
			);
		});
	});

	describe('Migration', () => {
		it('should migrate v1 global config to v22', async () => {
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
			assertEquals(result.version.to, '2.2.0');
			assertExists(result.backupPath);

			// Verify changes tracked
			// Check version change
			// const versionChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'version'
			// );
			// assertExists(versionChange);
			// assertEquals(versionChange.from, '1.0.0');
			// assertEquals(versionChange.to, '2.2.0');
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

		it('should migrate v1 project config to v22', async () => {
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
			assertEquals(result.version.to, '2.2.0');

			// Verify structure converted to settings
			// Check version change
			// const versionChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'version'
			// );
			// assertExists(versionChange);
			// assertEquals(versionChange.from, '1.0.0');
			// assertEquals(versionChange.to, '2.2.0');
			//
			// // Check port change
			// const portChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'api.port'
			// );
			// assertExists(portChange);
			// assertEquals(portChange.from, 3162);
			// assertEquals(portChange.to, 3162);
			//
			// const hostnameChange = result.changes.find((c: { path: string[]; from: unknown; to: unknown }) =>
			// 	c.path.join('.') === 'api.hostname'
			// );
			// assertExists(hostnameChange);
			// assertEquals(hostnameChange.from, 'localhost');
			// assertEquals(hostnameChange.to, 'localhost');
		});
	});

	describe('Validation', () => {
		it('should validate global config structure', async () => {
			const invalidConfig = {
				version: '2.2.0',
				// Missing required fields
			};

			const result = await configManager.validateConfig(invalidConfig);
			assertEquals(result.isValid, false);
			assertEquals(result.errors.length > 0, true);
		});

		it('should validate project config structure', async () => {
			const invalidConfig = {
				version: '2.2.0',
				projectId: 'invalid', // Wrong format
				name: 'Test',
				type: 'invalid', // Invalid type
				api: {},
			};

			const result = await configManager.validateConfig(invalidConfig);
			assertEquals(result.isValid, false);

			// Should have projectId and type errors
			const idError = result.errors.find((e: { path: string[]; message: string; value?: unknown }) =>
				e.path[0] === 'projectId'
			);
			assertExists(idError);
		});

		it('should validate component settings', async () => {
			const config = {
				version: '2.2.0',
				projectId: '123456789abc',
				name: 'Test',
				type: 'local',
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
			};

			const result = await configManager.validateConfig(config);
			assertEquals(result.isValid, false);

			const portError = result.errors.find((e: { path: string[]; message: string; value?: unknown }) =>
				e.path.join('.') === 'api.port'
			);
			assertExists(portError);
		});
	});
});
