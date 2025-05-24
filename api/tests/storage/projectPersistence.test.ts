/**
 * Tests for the refactored ProjectPersistence implementation
 */
// import { assertEquals, assertExists, assertRejects } from 'api/tests/deps.ts';
// import { afterAll, beforeAll, beforeEach, describe, it } from '@std/testing/bdd';
// import { spy, assertSpyCalls, Spy, restore } from '@std/testing/mock';
// import { join } from '@std/path';
// import { ensureDir, exists } from '@std/fs';
// import { dirname } from '@std/path';
//
// import ProjectPersistence from '../../src/storage/projectPersistence.ts';
// import { DataSourceRegistry } from '../../src/dataSources/dataSourceRegistry.ts';
// import { DataSourceFactory } from '../../src/dataSources/dataSourceFactory.ts';
// import { FilesystemProvider } from '../../src/dataSources/filesystem/filesystemProvider.ts';
// import { NotionProvider } from '../../src/dataSources/notion/notionProvider.ts';
// import { DataSourceConnection } from '../../src/dataSources/dataSourceConnection.ts';
//
// // Mock dependencies
// const mockRegistryProjects = new Map();
// const mockProjectRegistry = {
//   getProject: (projectId: string) => mockRegistryProjects.get(projectId),
//   saveProject: (project: any) => {
//     mockRegistryProjects.set(project.projectId, project);
//     return Promise.resolve();
//   },
//   deleteProject: (projectId: string) => {
//     mockRegistryProjects.delete(projectId);
//     return Promise.resolve();
//   },
// };
//
// const mockConfigManager = {
//   getProjectConfig: () => Promise.resolve({ name: 'Test Project', repoInfo: { tokenLimit: 1024 } }),
//   deleteProjectConfig: () => Promise.resolve(),
// };
//
// // Spies and mocks
// let getProjectRegistrySpy: Spy;
// let getConfigManagerSpy: Spy;
// let getDataSourceRegistrySpy: Spy;
// let getDataSourceFactorySpy: Spy;
// let dummyRegistry: DataSourceRegistry;
// let dummyFactory: DataSourceFactory;
//
// describe('ProjectPersistence', () => {
//   // Setup test environment
//   const testProjectId = 'test-project-123';
//   const testProjectDir = join(Deno.cwd(), 'api', 'tests', 'storage', 'test-projects', testProjectId);
//   const testProjectDataDir = join(testProjectDir, 'project.json');
//
//   beforeAll(async () => {
//     // Create test directory structure
//     await ensureDir(testProjectDir);
//
//     // Setup DataSourceRegistry with providers
//     dummyRegistry = new DataSourceRegistry();
//     const filesystemProvider = new FilesystemProvider();
//     const notionProvider = new NotionProvider();
//     dummyRegistry.registerProvider(filesystemProvider);
//     dummyRegistry.registerProvider(notionProvider);
//
//     // Setup DataSourceFactory
//     dummyFactory = new DataSourceFactory();
//
//     // Setup spies
//     getProjectRegistrySpy = spy(
//       { getProjectRegistry: () => Promise.resolve(mockProjectRegistry) },
//       'getProjectRegistry'
//     );
//     getConfigManagerSpy = spy(
//       { getConfigManager: () => Promise.resolve(mockConfigManager) },
//       'getConfigManager'
//     );
//     getDataSourceRegistrySpy = spy(
//       { getDataSourceRegistry: () => Promise.resolve(dummyRegistry) },
//       'getDataSourceRegistry'
//     );
//     getDataSourceFactorySpy = spy(
//       { getDataSourceFactory: () => Promise.resolve(dummyFactory) },
//       'getDataSourceFactory'
//     );
//
//     // Create test project in registry
//     mockRegistryProjects.set(testProjectId, {
//       projectId: testProjectId,
//       name: 'Test Project',
//       status: 'active',
//       dataSourcePaths: [Deno.cwd()],
//     });
//   });
//
//   afterAll(async () => {
//     // Clean up test directory
//     try {
//       await Deno.remove(join(Deno.cwd(), 'api', 'tests', 'storage', 'test-projects'), { recursive: true });
//     } catch (error) {
//       console.error(`Error removing test directory: ${error.message}`);
//     }
//
//     // Restore all spies
//     restore();
//
//     // Clear test projects
//     mockRegistryProjects.clear();
//   });
//
//   it('should initialize successfully', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     assertExists(projectPersistence);
//     assertEquals(projectPersistence.projectId, testProjectId);
//     assertEquals(projectPersistence.name, 'Test Project');
//     assertEquals(projectPersistence.status, 'active');
//   });
//
//   it('should register a filesystem data source', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     const dataSourceId = await projectPersistence.registerFileSystemDataSource(
//       'Test Filesystem',
//       Deno.cwd()
//     );
//
//     assertExists(dataSourceId);
//     const dataSource = projectPersistence.getDataSource(dataSourceId);
//     assertExists(dataSource);
//     assertEquals(dataSource.type, 'filesystem');
//     assertEquals(dataSource.name, 'Test Filesystem');
//     assertEquals(dataSource.isPrimary, false);
//   });
//
//   it('should register a primary filesystem data source', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     const dataSourceId = await projectPersistence.registerPrimaryFileSystemDataSource(
//       'Primary Filesystem',
//       Deno.cwd()
//     );
//
//     assertExists(dataSourceId);
//     const dataSource = projectPersistence.getDataSource(dataSourceId);
//     assertExists(dataSource);
//     assertEquals(dataSource.isPrimary, true);
//
//     // Check that this is the primary source
//     const primarySource = projectPersistence.getPrimaryDataSource();
//     assertExists(primarySource);
//     assertEquals(primarySource.id, dataSourceId);
//   });
//
//   it('should update a data source', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     const dataSourceId = await projectPersistence.registerFileSystemDataSource(
//       'Update Test',
//       Deno.cwd()
//     );
//
//     // Update the data source
//     await projectPersistence.updateDataSource(dataSourceId, {
//       name: 'Updated Name',
//       priority: 50,
//     });
//
//     const dataSource = projectPersistence.getDataSource(dataSourceId);
//     assertExists(dataSource);
//     assertEquals(dataSource.name, 'Updated Name');
//     assertEquals(dataSource.priority, 50);
//   });
//
//   it('should remove a data source', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     const dataSourceId = await projectPersistence.registerFileSystemDataSource(
//       'To Remove',
//       Deno.cwd()
//     );
//
//     assertExists(projectPersistence.getDataSource(dataSourceId));
//
//     // Remove the data source
//     await projectPersistence.removeDataSource(dataSourceId);
//
//     assertEquals(projectPersistence.getDataSource(dataSourceId), undefined);
//   });
//
//   it('should set a data source as primary', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     // Add two data sources
//     const dataSourceId1 = await projectPersistence.registerFileSystemDataSource(
//       'Source 1',
//       Deno.cwd()
//     );
//     const dataSourceId2 = await projectPersistence.registerFileSystemDataSource(
//       'Source 2',
//       Deno.cwd()
//     );
//
//     // Set the second one as primary
//     await projectPersistence.setPrimaryDataSource(dataSourceId2);
//
//     // Check that the second one is primary
//     const source1 = projectPersistence.getDataSource(dataSourceId1);
//     const source2 = projectPersistence.getDataSource(dataSourceId2);
//     assertExists(source1);
//     assertExists(source2);
//     assertEquals(source1.isPrimary, false);
//     assertEquals(source2.isPrimary, true);
//
//     // Check the primary source
//     const primarySource = projectPersistence.getPrimaryDataSource();
//     assertExists(primarySource);
//     assertEquals(primarySource.id, dataSourceId2);
//   });
//
//   it('should enable and disable a data source', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     const dataSourceId = await projectPersistence.registerFileSystemDataSource(
//       'Enable/Disable Test',
//       Deno.cwd()
//     );
//
//     // Disable the data source
//     await projectPersistence.disableDataSource(dataSourceId);
//
//     let dataSource = projectPersistence.getDataSource(dataSourceId);
//     assertExists(dataSource);
//     assertEquals(dataSource.enabled, false);
//
//     // Enable the data source
//     await projectPersistence.enableDataSource(dataSourceId);
//
//     dataSource = projectPersistence.getDataSource(dataSourceId);
//     assertExists(dataSource);
//     assertEquals(dataSource.enabled, true);
//   });
//
//   it('should resolve data sources by ID and name', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     const dataSourceId = await projectPersistence.registerFileSystemDataSource(
//       'Resolve Test',
//       Deno.cwd()
//     );
//
//     // Resolve by ID
//     const result1 = projectPersistence.resolveDataSources([dataSourceId]);
//     assertEquals(result1.dataSources.length, 1);
//     assertEquals(result1.dataSources[0].id, dataSourceId);
//     assertEquals(result1.notFound.length, 0);
//
//     // Resolve by name
//     const result2 = projectPersistence.resolveDataSources(['Resolve Test']);
//     assertEquals(result2.dataSources.length, 1);
//     assertEquals(result2.dataSources[0].id, dataSourceId);
//     assertEquals(result2.notFound.length, 0);
//
//     // Resolve non-existent source
//     const result3 = projectPersistence.resolveDataSources(['non-existent']);
//     assertEquals(result3.dataSources.length, 0);
//     assertEquals(result3.notFound.length, 1);
//     assertEquals(result3.notFound[0], 'non-existent');
//   });
//
//   it('should store and retrieve project resources', async () => {
//     const projectPersistence = new ProjectPersistence(testProjectId);
//     await projectPersistence.init();
//
//     const resourceUri = 'test://resource';
//     const content = 'Test content';
//     const metadata = {
//       type: 'file',
//       contentType: 'text',
//       name: 'Test Resource',
//       uri: resourceUri,
//       mimeType: 'text/plain',
//       size: content.length,
//     };
//
//     // Store a resource
//     await projectPersistence.storeProjectResource(resourceUri, content, metadata);
//
//     // Check if resource exists
//     const exists = await projectPersistence.hasProjectResource(resourceUri);
//     assertEquals(exists, true);
//
//     // Retrieve the resource
//     const retrieved = await projectPersistence.getProjectResource(resourceUri);
//     assertExists(retrieved);
//     assertEquals(retrieved.content, content);
//     assertExists(retrieved.metadata);
//     assertEquals(retrieved.metadata?.uri, resourceUri);
//   });
// });
