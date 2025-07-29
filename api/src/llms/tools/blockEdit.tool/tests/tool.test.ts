/**
 * Tests for BlockEdit tool
 */
import { assert, assertEquals, assertRejects, assertStringIncludes } from 'api/tests/deps.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestInteraction,
	getProjectEditor,
	getToolManager,
	withTestProject,
} from 'api/tests/testSetup.ts';
import { generatePortableTextKey } from 'api/dataSources/notion/portableTextConverter.ts';
import type { PortableTextOperation } from 'api/dataSources/notion/notionAccessor.ts';

// Mock data source connection that supports block editing
class MockBlockEditConnection {
	id = 'mock-notion';
	name = 'Mock Notion';
	dataSourceType = 'notion';

	async isResourceWithinDataSource(_resourceUri: string): Promise<boolean> {
		return true;
	}

	getUriForResource(resourcePath: string): string {
		return `notion://${resourcePath}`;
	}

	async getResourceAccessor() {
		return new MockBlockResourceAccessor();
	}

	getDataSourceRoot(): string {
		return 'mock-notion-root';
	}
}

// Mock resource accessor that implements block editing interface
class MockBlockResourceAccessor {
	private mockPortableTextBlocks = [
		{
			_type: 'block',
			_key: 'block-1',
			style: 'normal',
			children: [
				{
					_type: 'span',
					_key: 'span-1',
					text: 'Original content',
				},
			],
		},
		{
			_type: 'block',
			_key: 'block-2',
			style: 'h1',
			children: [
				{
					_type: 'span',
					_key: 'span-2',
					text: 'Original heading',
				},
			],
		},
	];

	hasCapability(capability: string): boolean {
		return capability === 'blockEdit';
	}

	async getDocumentAsPortableText(_resourceUri: string) {
		return [...this.mockPortableTextBlocks];
	}

	async applyPortableTextOperations(_resourceUri: string, operations: PortableTextOperation[]) {
		const results = [];
		
		for (let i = 0; i < operations.length; i++) {
			const operation = operations[i];
			
			try {
				switch (operation.type) {
					case 'update':
						if (!operation.content) {
							results.push({
								operationIndex: i,
								type: 'update',
								success: false,
								message: 'Update operation requires content',
							});
							continue;
						}
						
						let updateIndex = -1;
						if (typeof operation.index === 'number') {
							updateIndex = operation.index;
						} else if (operation._key) {
							updateIndex = this.mockPortableTextBlocks.findIndex(b => b._key === operation._key);
						}
						
						if (updateIndex === -1 || updateIndex >= this.mockPortableTextBlocks.length) {
							results.push({
								operationIndex: i,
								type: 'update',
								success: false,
								message: `Block not found for update operation`,
							});
							continue;
						}
						
						// Update the mock data
						this.mockPortableTextBlocks[updateIndex] = { ...operation.content };
						
						results.push({
							operationIndex: i,
							type: 'update',
							success: true,
							message: `Updated block at index ${updateIndex}`,
							originalIndex: updateIndex,
							affectedKey: operation.content._key,
						});
						break;
						
					case 'insert':
						if (!operation.block) {
							results.push({
								operationIndex: i,
								type: 'insert',
								success: false,
								message: 'Insert operation requires block',
							});
							continue;
						}
						
						const position = operation.position ?? this.mockPortableTextBlocks.length;
						if (position < 0 || position > this.mockPortableTextBlocks.length) {
							results.push({
								operationIndex: i,
								type: 'insert',
								success: false,
								message: `Invalid insert position: ${position}`,
							});
							continue;
						}
						
						// Insert the block
						this.mockPortableTextBlocks.splice(position, 0, operation.block);
						
						results.push({
							operationIndex: i,
							type: 'insert',
							success: true,
							message: `Inserted block at position ${position}`,
							newIndex: position,
							affectedKey: operation.block._key,
						});
						break;
						
					case 'delete':
						let deleteIndex = -1;
						if (typeof operation.index === 'number') {
							deleteIndex = operation.index;
						} else if (operation._key) {
							deleteIndex = this.mockPortableTextBlocks.findIndex(b => b._key === operation._key);
						}
						
						if (deleteIndex === -1 || deleteIndex >= this.mockPortableTextBlocks.length) {
							results.push({
								operationIndex: i,
								type: 'delete',
								success: false,
								message: `Block not found for delete operation`,
							});
							continue;
						}
						
						const deletedKey = this.mockPortableTextBlocks[deleteIndex]._key;
						this.mockPortableTextBlocks.splice(deleteIndex, 1);
						
						results.push({
							operationIndex: i,
							type: 'delete',
							success: true,
							message: `Deleted block at index ${deleteIndex}`,
							originalIndex: deleteIndex,
							affectedKey: deletedKey,
						});
						break;
						
					case 'move':
						let fromIndex = -1;
						if (typeof operation.from === 'number') {
							fromIndex = operation.from;
						} else if (operation.fromKey) {
							fromIndex = this.mockPortableTextBlocks.findIndex(b => b._key === operation.fromKey);
						}
						
						let toIndex = -1;
						if (typeof operation.to === 'number') {
							toIndex = operation.to;
						} else if (typeof operation.toPosition === 'number') {
							toIndex = operation.toPosition;
						}
						
						if (fromIndex === -1 || fromIndex >= this.mockPortableTextBlocks.length) {
							results.push({
								operationIndex: i,
								type: 'move',
								success: false,
								message: `Source block not found for move operation`,
							});
							continue;
						}
						
						if (toIndex === -1 || toIndex < 0 || toIndex > this.mockPortableTextBlocks.length) {
							results.push({
								operationIndex: i,
								type: 'move',
								success: false,
								message: `Invalid target position for move operation: ${toIndex}`,
							});
							continue;
						}
						
						if (fromIndex === toIndex) {
							results.push({
								operationIndex: i,
								type: 'move',
								success: false,
								message: `Source and target positions are the same: ${fromIndex}`,
							});
							continue;
						}
						
						// Move the block
						const [movedBlock] = this.mockPortableTextBlocks.splice(fromIndex, 1);
						const actualToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
						this.mockPortableTextBlocks.splice(actualToIndex, 0, movedBlock);
						
						results.push({
							operationIndex: i,
							type: 'move',
							success: true,
							message: `Moved block from index ${fromIndex} to ${actualToIndex}`,
							originalIndex: fromIndex,
							newIndex: actualToIndex,
							affectedKey: movedBlock._key,
						});
						break;
						
					default:
						results.push({
							operationIndex: i,
							type: operation.type,
							success: false,
							message: `Unsupported operation type: ${operation.type}`,
						});
				}
			} catch (error) {
				results.push({
					operationIndex: i,
					type: operation.type,
					success: false,
					message: `Operation failed: ${error.message}`,
					error: error.message,
				});
			}
		}
		
		return results;
	}
}

// Mock connection that doesn't support block editing
class MockNonBlockEditConnection {
	id = 'mock-filesystem';
	name = 'Mock FileSystem';
	dataSourceType = 'filesystem';

	async isResourceWithinDataSource(_resourceUri: string): Promise<boolean> {
		return true;
	}

	getUriForResource(resourcePath: string): string {
		return `file://${resourcePath}`;
	}

	async getResourceAccessor() {
		return new MockNonBlockResourceAccessor();
	}

	getDataSourceRoot(): string {
		return 'mock-fs-root';
	}
}

class MockNonBlockResourceAccessor {
	hasCapability(capability: string): boolean {
		return capability !== 'blockEdit';
	}
}

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'BlockEditTool - Basic update operation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			// Mock the getDsConnectionsById method to return our mock connection
			const mockConnection = new MockBlockEditConnection();
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			assert(tool, 'Failed to get block_edit tool');

			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: 'page/test-page-id',
						operations: [
							{
								type: 'update',
								index: 0,
								content: {
									_type: 'block',
									_key: 'block-1',
									style: 'normal',
									children: [
										{
											_type: 'span',
											_key: generatePortableTextKey('span'),
											text: 'Updated content',
										},
									],
								},
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB applied block edit operations');
				assertStringIncludes(result.toolResponse, '1/1 operations succeeded');

				// Check toolResults
				assert(Array.isArray(result.toolResults), 'toolResults should be an array');
				assert(result.toolResults.length >= 2, 'toolResults should have at least 2 elements');

				const operationResult = result.toolResults.find((r: any) => 
					r.text && r.text.includes('✅ Operation 1 (update)')
				);
				assert(operationResult, 'Should find successful operation result');
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'BlockEditTool - Insert operation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const mockConnection = new MockBlockEditConnection();
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: 'page/test-page-id',
						operations: [
							{
								type: 'insert',
								position: 1,
								block: {
									_type: 'block',
									_key: generatePortableTextKey(),
									style: 'normal',
									children: [
										{
											_type: 'span',
											_key: generatePortableTextKey('span'),
											text: 'Inserted content',
										},
									],
								},
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB applied block edit operations');
				assertStringIncludes(result.toolResponse, '1/1 operations succeeded');

				const operationResult = result.toolResults.find((r: any) => 
					r.text && r.text.includes('✅ Operation 1 (insert)')
				);
				assert(operationResult, 'Should find successful insert operation result');
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'BlockEditTool - Delete operation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const mockConnection = new MockBlockEditConnection();
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: 'page/test-page-id',
						operations: [
							{
								type: 'delete',
								index: 0,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB applied block edit operations');
				assertStringIncludes(result.toolResponse, '1/1 operations succeeded');

				const operationResult = result.toolResults.find((r: any) => 
					r.text && r.text.includes('✅ Operation 1 (delete)')
				);
				assert(operationResult, 'Should find successful delete operation result');
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'BlockEditTool - Move operation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const mockConnection = new MockBlockEditConnection();
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: 'page/test-page-id',
						operations: [
							{
								type: 'move',
								from: 0,
								to: 1,
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB applied block edit operations');
				assertStringIncludes(result.toolResponse, '1/1 operations succeeded');

				const operationResult = result.toolResults.find((r: any) => 
					r.text && r.text.includes('✅ Operation 1 (move)')
				);
				assert(operationResult, 'Should find successful move operation result');
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'BlockEditTool - Multiple operations with mixed success',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const mockConnection = new MockBlockEditConnection();
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: 'page/test-page-id',
						operations: [
							{
								type: 'update',
								index: 0,
								content: {
									_type: 'block',
									_key: 'block-1',
									style: 'h1',
									children: [
										{
											_type: 'span',
											_key: generatePortableTextKey('span'),
											text: 'Updated heading',
										},
									],
								},
							},
							{
								type: 'update',
								index: 10, // Invalid index
								content: {
									_type: 'block',
									_key: 'block-invalid',
									style: 'normal',
									children: [],
								},
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB applied block edit operations');
				assertStringIncludes(result.toolResponse, '1/2 operations succeeded');

				// Should have both success and failure results
				const successResult = result.toolResults.find((r: any) => 
					r.text && r.text.includes('✅ Operation 1 (update)')
				);
				const failureResult = result.toolResults.find((r: any) => 
					r.text && r.text.includes('❌ Operation 2 (update)')
				);
				
				assert(successResult, 'Should find successful operation result');
				assert(failureResult, 'Should find failed operation result');
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'BlockEditTool - Data source without block edit capability',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			// Mock the getDsConnectionsById method to return non-block-edit connection
			const mockConnection = new MockNonBlockEditConnection();
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: 'test.txt',
						operations: [
							{
								type: 'update',
								index: 0,
								content: {
									_type: 'block',
									_key: 'block-1',
									style: 'normal',
									children: [],
								},
							},
						],
					},
				};

				await assertRejects(
					() => tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Data source does not support block editing operations',
				);
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'BlockEditTool - Resource outside data source',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			// Mock connection that denies access
			const mockConnection = new MockBlockEditConnection();
			mockConnection.isResourceWithinDataSource = async () => false;
			
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: '../outside/file.txt',
						operations: [
							{
								type: 'update',
								index: 0,
								content: {
									_type: 'block',
									_key: 'block-1',
									style: 'normal',
									children: [],
								},
							},
						],
					},
				};

				await assertRejects(
					() => tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Access denied:',
				);
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'BlockEditTool - Invalid operation validation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);
			const interaction = await createTestInteraction('test-collaboration', 'test-interaction', projectEditor);

			const mockConnection = new MockBlockEditConnection();
			const originalGetDsConnectionsById = projectEditor.getDsConnectionsById;
			projectEditor.getDsConnectionsById = () => ({
				primaryDsConnection: mockConnection as any,
				dsConnections: [mockConnection as any],
				notFound: [],
			});

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('block_edit');
			const logChangeAndCommitStub = orchestratorControllerStubMaker.logChangeAndCommitStub(() =>
				Promise.resolve()
			);
			
			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'block_edit',
					toolInput: {
						resourcePath: 'page/test-page-id',
						operations: [
							{
								type: 'update',
								// Missing content and index/key
							},
						],
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				assert(isString(result.bbResponse), 'bbResponse should be a string');
				assertStringIncludes(result.bbResponse, 'BB applied block edit operations');
				assertStringIncludes(result.toolResponse, '0/1 operations succeeded');

				// Should show operation failure
				const failureResult = result.toolResults.find((r: any) => 
					r.text && r.text.includes('❌ Operation 1 (update)')
				);
				assert(failureResult, 'Should find failed operation result');
			} finally {
				logChangeAndCommitStub.restore();
				projectEditor.getDsConnectionsById = originalGetDsConnectionsById;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});