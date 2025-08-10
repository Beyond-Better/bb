/**
 * Tests for the new ResourceManager implementation
 */
// import { assertEquals, assertExists, assertRejects } from 'api/tests/deps.ts';
// import { afterAll, beforeAll, describe, it } from '@std/testing/bdd';
// import { assertSpyCalls, spy } from '@std/testing/mock';
// import { join } from '@std/path';
// import { ensureDir, exists } from '@std/fs';
// import { dirname } from '@std/path';
//
// import { ResourceManager } from 'api/resources/resourceManager.ts';
// import { FilesystemProvider } from 'api/dataSources/filesystemProvider.ts';
// import { getDataSourceRegistry, type DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
// import { getDataSourceFactory, type DataSourceFactory } from 'api/dataSources/dataSourceFactory.ts';
// //import { DataSource } from '../../src/resources/dataSource.ts';
// import { errorMessage } from 'shared/error.ts';
//
// const registry = await getDataSourceRegistry();
//
// // Mock ProjectEditor for testing
// class MockProjectEditor {
//   projectInfo = { projectId: 'test-project', name: 'Test Project' };
//   projectData = {
//     getDsConnection: (_id: string) => this.dsConnection,
//     getAllDsConnections: (_type?: string) => [this.dsConnection],
//   };
//   dsConnection = FilesystemProvider.createFileSystemDataSource(
// 		'Test Data Source',
// 		Deno.cwd() ,
// 		registry,
// 		 {
// 			id: 'ds-test',
// 			enabled: true,
// 			isPrimary: true,
// 		} );
//   getDsConnectionForPrefix(_prefix: string) {
//     return this.dsConnection;
//   }
// }
//
// describe('ResourceManager (new)', () => {
//   let resourceManager: ResourceManager;
//   let tempDir: string;
//   let registry: DataSourceRegistry;
//   let factory: DataSourceFactory;
//
//   // Setup before all tests
//   beforeAll(async () => {
//     // Create temp directory for tests
//     tempDir = join(Deno.cwd(), 'api', 'tests', 'resources', 'temp');
//     await ensureDir(tempDir);
//
//     // Create test file
//     const testFilePath = join(tempDir, 'test.txt');
//     await Deno.writeTextFile(testFilePath, 'Test content');
//
//     // Create test directory
//     const testDirPath = join(tempDir, 'testdir');
//     await ensureDir(testDirPath);
//
//     // Create a file in the test directory
//     const nestedFilePath = join(testDirPath, 'nested.txt');
//     await Deno.writeTextFile(nestedFilePath, 'Nested test content');
//
//     // Setup registry and provider
//     registry = await getDataSourceRegistry();
//     const filesystemProvider = new FilesystemProvider();
//     registry.registerProvider(filesystemProvider);
//
//     // Setup factory
//     factory = await getDataSourceFactory();
//
//     // Use spies to return our instances when singleton getters are called
//     const getRegistrySpy = spy(registry, 'getInstance', () => Promise.resolve(registry));
//     const getFactorySpy = spy(registry, 'getInstance', () => Promise.resolve(factory));
//
//     // Setup test data source
//     const mockEditor = new MockProjectEditor();
//     mockEditor.dsConnection.config.dsConnectionRoot = tempDir;
//
//     // Create ResourceManager instance
//     resourceManager = new ResourceManager(mockEditor as any);
//     await resourceManager.init();
//   });
//
//   // Cleanup after all tests
//   afterAll(async () => {
//     // Remove temp directory
//     try {
//       await Deno.remove(tempDir, { recursive: true });
//     } catch (error) {
//       console.error(`Error removing temp directory: ${errorMessage(error)}`);
//     }
//   });
//
//   it('should initialize successfully', () => {
//     assertExists(resourceManager);
//   });
//
//   describe('loadResource', () => {
//     it('should load a file resource', async () => {
//       const result = await resourceManager.loadResource('bb+filesystem+test-datasource://test.txt');
//
//       assertEquals(result.content, 'Test content');
//       assertEquals(result.metadata.type, 'file');
//       assertEquals(result.metadata.contentType, 'text');
//       assertEquals(result.metadata.mimeType, 'text/plain');
//     });
//
//     it('should reject for non-existent resources', async () => {
//       await assertRejects(
//         () => resourceManager.loadResource('bb+filesystem+test-datasource://nonexistent.txt'),
//         Error,
//         'Failed to load resource'
//       );
//     });
//   });
//
//   describe('listResources', () => {
//     it('should list resources in a directory', async () => {
//       const result = await resourceManager.listResources('test-ds');
//
//       assertExists(result.resources);
//       assertEquals(result.resources.length >= 2, true);
//
//       // Check that our test file is in the results
//       const testFile = result.resources.find(r => r.name === 'test.txt');
//       assertExists(testFile);
//       assertEquals(testFile.type, 'file');
//       assertEquals(testFile.mimeType, 'text/plain');
//
//       // Check that our test directory is in the results
//       const testDir = result.resources.find(r => r.name === 'testdir');
//       assertExists(testDir);
//       assertEquals(testDir.extraType, 'directory');
//     });
//
//     it('should list resources with specified path', async () => {
//       const result = await resourceManager.listResources('test-ds', { path: 'testdir' });
//
//       assertExists(result.resources);
//       assertEquals(result.resources.length >= 1, true);
//
//       // Check that our nested file is in the results
//       const nestedFile = result.resources.find(r => r.name === 'nested.txt');
//       assertExists(nestedFile);
//       assertEquals(nestedFile.type, 'file');
//       assertEquals(nestedFile.mimeType, 'text/plain');
//     });
//   });
//
//   describe('writeResource', () => {
//     it('should write a new file resource', async () => {
//       const testContent = 'New test content';
//       const uri = 'bb+filesystem+test-datasource://new_test_file.txt';
//
//       // Write the resource
//       const writeResult = await resourceManager.writeResource(uri, testContent);
//
//       // Verify write result
//       assertEquals(writeResult.success, true);
//       assertEquals(writeResult.uri, uri);
//       assertEquals(writeResult.metadata.type, 'file');
//
//       // Load the resource to verify content
//       const loadResult = await resourceManager.loadResource(uri);
//       assertEquals(loadResult.content, testContent);
//
//       // Clean up
//       await Deno.remove(join(tempDir, 'new_test_file.txt'));
//     });
//
//     it('should update an existing file resource', async () => {
//       // Create a test file
//       const filePath = join(tempDir, 'update_test.txt');
//       await Deno.writeTextFile(filePath, 'Original content');
//
//       const updatedContent = 'Updated content';
//       const uri = 'bb+filesystem+test-datasource://update_test.txt';
//
//       // Update the resource
//       await resourceManager.writeResource(uri, updatedContent);
//
//       // Load the resource to verify content
//       const loadResult = await resourceManager.loadResource(uri);
//       assertEquals(loadResult.content, updatedContent);
//
//       // Clean up
//       await Deno.remove(filePath);
//     });
//   });
//
//   describe('moveResource', () => {
//     it('should move a file resource', async () => {
//       // Create a test file
//       const sourceFilePath = join(tempDir, 'source.txt');
//       await Deno.writeTextFile(sourceFilePath, 'Source content');
//
//       const sourceUri = 'bb+filesystem+test-datasource://source.txt';
//       const destUri = 'bb+filesystem+test-datasource://destination.txt';
//
//       // Move the resource
//       const moveResult = await resourceManager.moveResource(sourceUri, destUri);
//
//       // Verify move result
//       assertEquals(moveResult.success, true);
//       assertEquals(moveResult.sourceUri, sourceUri);
//       assertEquals(moveResult.destinationUri, destUri);
//
//       // Check that source file no longer exists
//       assertEquals(await exists(sourceFilePath), false);
//
//       // Check that destination file exists and has the correct content
//       const destFilePath = join(tempDir, 'destination.txt');
//       assertEquals(await exists(destFilePath), true);
//       assertEquals(await Deno.readTextFile(destFilePath), 'Source content');
//
//       // Clean up
//       await Deno.remove(destFilePath);
//     });
//   });
//
//   describe('deleteResource', () => {
//     it('should delete a file resource', async () => {
//       // Create a test file
//       const filePath = join(tempDir, 'to_delete.txt');
//       await Deno.writeTextFile(filePath, 'Delete me');
//
//       const uri = 'bb+filesystem+test-datasource://to_delete.txt';
//
//       // Delete the resource
//       const deleteResult = await resourceManager.deleteResource(uri);
//
//       // Verify delete result
//       assertEquals(deleteResult.success, true);
//       assertEquals(deleteResult.uri, uri);
//       assertEquals(deleteResult.type, 'file');
//
//       // Check that file no longer exists
//       assertEquals(await exists(filePath), false);
//     });
//   });
// });
