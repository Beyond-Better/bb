import { join } from '@std/path';
//import { existsSync } from '@std/fs';

import { assert, assertStringIncludes } from 'api/tests/deps.ts';
//import type LLMToolSearchProject from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

async function createTestResources(testProjectRoot: string) {
	Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
	Deno.writeTextFileSync(join(testProjectRoot, 'file2.js'), 'console.log("Hello, JavaScript!");');
	Deno.mkdirSync(join(testProjectRoot, 'subdir'));
	Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file3.txt'), 'Hello from subdirectory!');
	Deno.writeTextFileSync(join(testProjectRoot, 'large_file.txt'), 'A'.repeat(10000)); // 10KB file
	// Create an empty file for edge case testing
	Deno.writeTextFileSync(join(testProjectRoot, 'empty_file.txt'), '');

	// Create a large resource with a pattern that spans potential buffer boundaries
	const largeResourceContent = 'A'.repeat(1024 * 1024) + // 1MB of 'A's
		'Start of pattern\n' +
		'B'.repeat(1024) + // 1KB of 'B's
		'\nEnd of pattern' +
		'C'.repeat(1024 * 1024); // Another 1MB of 'C's

	Deno.writeTextFileSync(join(testProjectRoot, 'large_file_with_pattern.txt'), largeResourceContent);

	// Create resources with special content for regex testing
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test1.txt'), 'This is a test. Another test.');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test2.txt'), 'Testing 123, testing 456.');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test3.txt'), 'Test@email.com and another.test@email.com');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test4.txt'), 'https://example.com and http://test.com');
	Deno.writeTextFileSync(join(testProjectRoot, 'regex_test5.txt'), 'Telephone: 123-456-7890 and (987) 654-3210');

	// Set specific modification times for date-based search tests
	const pastDate = new Date('2023-01-01T00:00:00Z');
	const futureDate = new Date('2025-01-01T00:00:00Z');
	const currentDate = new Date();
	await setResourceModificationTime(join(testProjectRoot, 'file1.txt'), pastDate);
	await setResourceModificationTime(join(testProjectRoot, 'file2.js'), futureDate);
	await setResourceModificationTime(join(testProjectRoot, 'subdir', 'file3.txt'), pastDate);
	await setResourceModificationTime(join(testProjectRoot, 'large_file.txt'), currentDate);
	await setResourceModificationTime(join(testProjectRoot, 'empty_file.txt'), currentDate);
	// Set modification time for the very large resource
	await setResourceModificationTime(join(testProjectRoot, 'large_file_with_pattern.txt'), currentDate);
}

async function createTestResourcesSimple(testProjectRoot: string) {
	await Deno.writeTextFile(join(testProjectRoot, 'file1.js'), 'console.log("Hello");');
	await Deno.writeTextFile(join(testProjectRoot, 'file2.ts'), 'const greeting: string = "Hello";');
	await Deno.writeTextFile(join(testProjectRoot, 'data.json'), '{ "greeting": "Hello" }');
	await Deno.writeTextFile(join(testProjectRoot, 'readme.md'), '# Hello');
}

async function createTestResourcesSimpleDir(testProjectRoot: string) {
	await Deno.mkdir(join(testProjectRoot, 'src'));
	await Deno.mkdir(join(testProjectRoot, 'test'));
	await Deno.writeTextFile(join(testProjectRoot, 'src', 'main.js'), 'console.log("Hello");');
	await Deno.writeTextFile(join(testProjectRoot, 'src', 'util.ts'), 'export const greet = () => "Hello";');
	await Deno.writeTextFile(join(testProjectRoot, 'test', 'main.test.js'), 'assert(true);');
	await Deno.writeTextFile(join(testProjectRoot, 'test', 'util.test.ts'), 'test("greet", () => {});');
}

async function createTestResourcesSearchProjectTest(testProjectRoot: string) {
	// Create directories at different depths
	await Deno.mkdir(join(testProjectRoot, 'src', 'tools'), { recursive: true });
	await Deno.mkdir(join(testProjectRoot, 'tests', 'deep', 'nested'), { recursive: true });
	await Deno.mkdir(join(testProjectRoot, 'lib'), { recursive: true });
	await Deno.mkdir(join(testProjectRoot, 'src', 'tools', 'searchProject.tool', 'tests'), { recursive: true });

	// Add test resources at various depths with searchProject in the name
	await Deno.writeTextFile(
		join(testProjectRoot, 'src', 'tools', 'searchProject.tool', 'tests', 'tool.test.ts'),
		'export const test = true;',
	);
	await Deno.writeTextFile(
		join(testProjectRoot, 'src', 'tools', 'searchProject.test.ts'),
		'export const test = true;',
	);
	await Deno.writeTextFile(
		join(testProjectRoot, 'tests', 'deep', 'nested', 'mySearchProject.test.ts'),
		'describe("test", () => {});',
	);
	await Deno.writeTextFile(
		join(testProjectRoot, 'tests', 'deep', 'nested', 'searchProject.test.ts'),
		'describe("test", () => {});',
	);
	await Deno.writeTextFile(
		join(testProjectRoot, 'lib', 'searchProjectUtil.test.ts'),
		'test("util", () => {});',
	);
	// Add some non-matching resources
	await Deno.writeTextFile(
		join(testProjectRoot, 'src', 'search.test.ts'),
		'// Should not match',
	);
	await Deno.writeTextFile(
		join(testProjectRoot, 'tests', 'project.test.ts'),
		'// Should not match',
	);
}

async function createTestResourcesKubernetes(testProjectRoot: string) {
	// Create deep Kubernetes directory structure
	await Deno.mkdir(join(testProjectRoot, 'deploy', 'Kubernetes', 'base'), { recursive: true });
	await Deno.mkdir(join(testProjectRoot, 'deploy', 'Kubernetes', 'overlays', 'dev'), { recursive: true });
	await Deno.mkdir(join(testProjectRoot, 'deploy', 'Kubernetes', 'overlays', 'prod'), { recursive: true });

	// Add resources at various levels
	await Deno.writeTextFile(join(testProjectRoot, 'deploy', 'Kubernetes', 'kustomization.yaml'), 'bases:\n  - base');
	await Deno.writeTextFile(
		join(testProjectRoot, 'deploy', 'Kubernetes', 'base', 'deployment.yaml'),
		'kind: Deployment',
	);
	await Deno.writeTextFile(join(testProjectRoot, 'deploy', 'Kubernetes', 'base', 'service.yaml'), 'kind: Service');
	await Deno.writeTextFile(
		join(testProjectRoot, 'deploy', 'Kubernetes', 'overlays', 'dev', 'kustomization.yaml'),
		'bases:\n  - ../../base',
	);
	await Deno.writeTextFile(
		join(testProjectRoot, 'deploy', 'Kubernetes', 'overlays', 'prod', 'kustomization.yaml'),
		'bases:\n  - ../../base',
	);
}

// Helper function to set resource modification time
async function setResourceModificationTime(resourcePath: string, date: Date) {
	await Deno.utime(resourcePath, date, date);
}

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'SearchProjectTool - Basic content search functionality',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Basic content search functionality - bbResponse:', result.bbResponse);
			// console.log('Basic content search functionality - toolResponse:', result.toolResponse);
			// console.log('Basic content search functionality - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					'BB found 3 resources matching the search criteria: content pattern "Hello", case-insensitive',
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 3 resources matching the search criteria: content pattern "Hello"',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '3 resources match the search criteria: content pattern "Hello"');
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['file1.txt', 'file2.js', 'subdir/file3.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);

			// Add a delay before cleanup
			await new Promise((resolve) => setTimeout(resolve, 1000));
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search pattern spanning multiple buffers',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Start of pattern\\n[B]+\\nEnd of pattern',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search pattern spanning multiple buffers - bbResponse:', result.bbResponse);
			// console.log('Search pattern spanning multiple buffers - toolResponse:', result.toolResponse);
			// console.log('Search pattern spanning multiple buffers - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 1 resources matching the search criteria: content pattern "Start of pattern\\n[B]+\\nEnd of pattern", case-insensitive`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 1 resources matching the search criteria',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '1 resources match the search criteria');

			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['large_file_with_pattern.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Date-based search',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					dateAfter: '2024-01-01',
					dateBefore: '2026-01-01',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Date-based search - bbResponse:', result.bbResponse);
			// console.log('Date-based search - toolResponse:', result.toolResponse);
			// console.log('Date-based search - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 9 resources matching the search criteria: modified after 2024-01-01, modified before 2026-01-01`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 9 resources matching the search criteria: modified after 2024-01-01, modified before 2026-01-01',
			);

			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'9 resources match the search criteria: modified after 2024-01-01, modified before 2026-01-01',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = [
				'file2.js',
				'large_file.txt',
				'empty_file.txt',
				'large_file_with_pattern.txt',
				'regex_test1.txt',
				'regex_test2.txt',
				'regex_test3.txt',
				'regex_test4.txt',
				'regex_test5.txt',
			];
			//console.log('Expected resources:', expectedResources);
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Resource-only search (metadata)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					resourcePattern: '*.txt',
					sizeMin: 1,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Resource-only search (metadata) - bbResponse:', result.bbResponse);
			// console.log('Resource-only search (metadata) - toolResponse:', result.toolResponse);
			// console.log('Resource-only search (metadata) - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 9 resources matching the search criteria: resource pattern "*.txt", minimum size 1 bytes`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 9 resources matching the search criteria: resource pattern "*.txt", minimum size 1 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'9 resources match the search criteria: resource pattern "*.txt", minimum size 1 bytes',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = [
				'file1.txt',
				'large_file.txt',
				'large_file_with_pattern.txt',
				'regex_test1.txt',
				'regex_test2.txt',
				'regex_test3.txt',
				'regex_test4.txt',
				'regex_test5.txt',
				'subdir/file3.txt',
			];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Combining all search criteria',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
					resourcePattern: '*.txt',
					sizeMin: 1,
					sizeMax: 1000,
					dateAfter: '2022-01-01',
					dateBefore: '2024-01-01',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Combining all search criteria - bbResponse:', result.bbResponse);
			// console.log('Combining all search criteria - toolResponse:', result.toolResponse);
			// console.log('Combining all search criteria - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 2 resources matching the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 2 resources matching the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 resources match the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt", modified after 2022-01-01, modified before 2024-01-01, minimum size 1 bytes, maximum size 1000 bytes',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['file1.txt', 'subdir/file3.txt'];
			console.log('Expected resources:', expectedResources);
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Edge case: empty resource',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					resourcePattern: '*.txt',
					sizeMax: 0,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 1 resources matching the search criteria: resource pattern "*.txt", maximum size 0 bytes`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 1 resources matching the search criteria: resource pattern "*.txt", maximum size 0 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'1 resources match the search criteria: resource pattern "*.txt", maximum size 0 bytes',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['empty_file.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with resource pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
					resourcePattern: '*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 2 resources matching the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 2 resources matching the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt"',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 resources match the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt"',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['file1.txt', 'subdir/file3.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with resource size criteria',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					resourcePattern: '*.txt',
					sizeMin: 5000,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 2 resources matching the search criteria: resource pattern "*.txt", minimum size 5000 bytes`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 2 resources matching the search criteria: resource pattern "*.txt", minimum size 5000 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 resources match the search criteria: resource pattern "*.txt", minimum size 5000 bytes',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['large_file.txt', 'large_file_with_pattern.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with no results',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'NonexistentPattern',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 0 resources matching the search criteria: content pattern "NonexistentPattern"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 0 resources matching the search criteria: content pattern "NonexistentPattern"',
			);
			assertStringIncludes(
				result.toolResults as string,
				'0 resources match the search criteria: content pattern "NonexistentPattern"',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Error handling for invalid search pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: '[', // Invalid regex pattern
				},
			};
			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Error handling for invalid search pattern - bbResponse:', result.bbResponse);
			// console.log('Error handling for invalid search pattern - toolResponse:', result.toolResponse);
			// console.log('Error handling for invalid search pattern - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 0 resources matching the search criteria: content pattern "["`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 0 resources matching the search criteria: content pattern "["',
			);
			assertStringIncludes(
				result.toolResults as string,
				'Invalid regular expression: /[/i: Unterminated character class',
			);
			assertStringIncludes(
				result.toolResults as string,
				'0 resources match the search criteria: content pattern "["',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with multiple criteria',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: 'Hello',
					resourcePattern: '*.txt',
					sizeMax: 1000,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 2 resources matching the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt", maximum size 1000 bytes`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 2 resources matching the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt", maximum size 1000 bytes',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'2 resources match the search criteria: content pattern "Hello", case-insensitive, resource pattern "*.txt", maximum size 1000 bytes',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['file1.txt', 'subdir/file3.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with bare filename',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					resourcePattern: 'file2.js',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 1 resources matching the search criteria: resource pattern "file2.js`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				'Found 1 resources matching the search criteria: resource pattern "file2.js"',
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				'1 resources match the search criteria: resource pattern "file2.js"',
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['file2.js'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with specific content and resource pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			// Create a test resource with the specific content
			const testResourcePath = join(testProjectRoot, 'bui', 'src', 'islands', 'Chat.tsx');
			await Deno.mkdir(join(testProjectRoot, 'bui', 'src', 'islands'), { recursive: true });
			await Deno.writeTextFile(testResourcePath, 'const title = currentConversation?.title;');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: String.raw`currentConversation\?\.title`,
					resourcePattern: 'bui/src/islands/Chat.tsx',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			//console.log('Search with specific content and resource pattern - bbResponse:', result.bbResponse);
			//console.log('Search with specific content and resource pattern - toolResponse:', result.toolResponse);
			//console.log('Search with specific content and resource pattern - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "currentConversation\?\.title", case-insensitive, resource pattern "bui/src/islands/Chat.tsx"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			assertStringIncludes(
				result.toolResponse,
				String
					.raw`Found 1 resources matching the search criteria: content pattern "currentConversation\?\.title", case-insensitive, resource pattern "bui/src/islands/Chat.tsx"`,
			);
			const toolResults = result.toolResults as string;
			assertStringIncludes(
				toolResults,
				String
					.raw`1 resources match the search criteria: content pattern "currentConversation\?\.title", case-insensitive, resource pattern "bui/src/islands/Chat.tsx"`,
			);
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['bui/src/islands/Chat.tsx'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);

			// Clean up the test resource
			await Deno.remove(testResourcePath);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with word boundary regex',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'search_project',
				toolInput: {
					contentPattern: String.raw`\btest\b`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 3 resources matching the search criteria: content pattern "\btest\b", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test1.txt');
			assert(!toolResults.includes('regex_test2.txt'), 'regex_test2.txt should not be in the results');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with email regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test3.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with URL regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test4.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with phone number regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`(\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s*\d{3}[-.]?\d{4})`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "(\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s*\d{3}[-.]?\d{4})", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test5.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with complex regex pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test3.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with regex using quantifiers - case-sensitive',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`test.*test`,
					resourcePattern: 'regex_test*.txt',
					caseSensitive: true,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search with regex using quantifiers - case-sensitive - bbResponse:', result.bbResponse);
			// console.log('Search with regex using quantifiers - case-sensitive - toolResponse:', result.toolResponse);
			// console.log('Search with regex using quantifiers - case-sensitive - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "test.*test", case-sensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test1.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with regex using quantifiers - case-insensitive',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`test.*test`,
					resourcePattern: 'regex_test*.txt',
					caseSensitive: false,
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search with regex using quantifiers - case-insensitive - bbResponse:', result.bbResponse);
			// console.log('Search with regex using quantifiers - case-insensitive - toolResponse:', result.toolResponse);
			// console.log('Search with regex using quantifiers - case-insensitive - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 3 resources matching the search criteria: content pattern "test.*test", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test1.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with regex using character classes',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`[Tt]esting [0-9]+`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "[Tt]esting [0-9]+", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test2.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with lookahead regex',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`Test(?=ing)`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 1 resources matching the search criteria: content pattern "Test(?=ing)", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'regex_test2.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Search with negative lookahead regex',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: String.raw`test(?!ing)`,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Search with negative lookahead regex - bbResponse:', result.bbResponse);
			// console.log('Search with negative lookahead regex - toolResponse:', result.toolResponse);
			// console.log('Search with negative lookahead regex - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					String
						.raw`BB found 3 resources matching the search criteria: content pattern "test(?!ing)", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;

			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['regex_test1.txt', 'regex_test3.txt', 'regex_test4.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Case-sensitive search',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: 'Test',
					caseSensitive: true,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Case-sensitive search - bbResponse:', result.bbResponse);
			// console.log('Case-sensitive search - toolResponse:', result.toolResponse);
			// console.log('Case-sensitive search - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 2 resources matching the search criteria: content pattern "Test", case-sensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['regex_test2.txt', 'regex_test3.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);

			assert(!toolResults.includes('regex_test1.txt'), `This resource contains 'test' but not 'Test'`);
			assert(!toolResults.includes('regex_test4.txt'), `This resource contains 'test' but not 'Test'`);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - Case-insensitive search',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResources(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					contentPattern: 'Test',
					caseSensitive: false,
					resourcePattern: 'regex_test*.txt',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Case-insensitive search - bbResponse:', result.bbResponse);
			// console.log('Case-insensitive search - toolResponse:', result.toolResponse);
			// console.log('Case-insensitive search - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 4 resources matching the search criteria: content pattern "Test", case-insensitive, resource pattern "regex_test*.txt"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['regex_test1.txt', 'regex_test2.txt', 'regex_test3.txt', 'regex_test4.txt'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - complex pattern with multiple extensions',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResourcesSimple(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					resourcePattern: '*.js|*.ts|*.json',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('complex pattern with multiple extensions - bbResponse:', result.bbResponse);
			// console.log('complex pattern with multiple extensions - toolResponse:', result.toolResponse);
			// console.log('complex pattern with multiple extensions - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 3 resources matching the search criteria: resource pattern "*.js|*.ts|*.json"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['file1.js', 'file2.ts', 'data.json'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - complex pattern with different directories',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResourcesSimpleDir(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					resourcePattern: 'src/*.js|test/*.ts',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('complex pattern with different directories - bbResponse:', result.bbResponse);
			// console.log('complex pattern with different directories - toolResponse:', result.toolResponse);
			// console.log('complex pattern with different directories - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 2 resources matching the search criteria: resource pattern "src/*.js|test/*.ts"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = ['src/main.js', 'test/util.test.ts'];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - deep directory traversal with Kubernetes resources',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResourcesKubernetes(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					resourcePattern: 'deploy/Kubernetes/**/*',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('deep directory traversal with Kubernetes resources - bbResponse:', result.bbResponse);
			// console.log('deep directory traversal with Kubernetes resources - toolResponse:', result.toolResponse);
			// console.log('deep directory traversal with Kubernetes resources - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 5 resources matching the search criteria: resource pattern "deploy/Kubernetes/**/*"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = [
				'deploy/Kubernetes/kustomization.yaml',
				'deploy/Kubernetes/base/deployment.yaml',
				'deploy/Kubernetes/base/service.yaml',
				'deploy/Kubernetes/overlays/dev/kustomization.yaml',
				'deploy/Kubernetes/overlays/prod/kustomization.yaml',
			];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);

			// Test that all resources are found regardless of depth
			const depths = foundResources.map((r) => (r.match(/\//g) || []).length);
			assert(Math.min(...depths) === 2, 'Should find resources at minimum depth (deploy/Kubernetes/)');
			assert(
				Math.max(...depths) === 4,
				'Should find resources at maximum depth (deploy/Kubernetes/overlays/env/)',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'SearchProjectTool - deep directory traversal with double-star pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResourcesSearchProjectTest(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					resourcePattern: '**/searchProject*test.ts',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('deep directory traversal with double-star pattern - bbResponse:', result.bbResponse);
			console.log('deep directory traversal with double-star pattern - toolResponse:', result.toolResponse);
			console.log('deep directory traversal with double-star pattern - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 3 resources matching the search criteria: resource pattern "**/searchProject*test.ts"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = [
				'src/tools/searchProject.test.ts',
				'tests/deep/nested/searchProject.test.ts',
				'lib/searchProjectUtil.test.ts',
			];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);

			// Test that resources at different depths are found
			const depths = foundResources.map((r) => (r.match(/\//g) || []).length);
			assert(Math.min(...depths) === 1, 'Should find resources at minimum depth (lib/)');
			assert(Math.max(...depths) === 3, 'Should find resources at maximum depth (tests/deep/nested/)');

			// Verify non-matching resources are not included
			assert(!toolResults.includes('src/search.test.ts'), 'Should not include resources without searchProject');
			assert(
				!toolResults.includes('tests/project.test.ts'),
				'Should not include resources without searchProject',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
Deno.test({
	name: 'SearchProjectTool - deep directory traversal with dual double-star pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createTestResourcesSearchProjectTest(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('search_project');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolName: 'search_project',
				toolUseId: 'test-id',
				toolInput: {
					resourcePattern: '**/searchProject*/**/*.test.ts',
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('deep directory traversal with dual double-star pattern - bbResponse:', result.bbResponse);
			// console.log('deep directory traversal with dual double-star pattern - toolResponse:', result.toolResponse);
			// console.log('deep directory traversal with dual double-star pattern - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					`BB found 1 resources matching the search criteria: resource pattern "**/searchProject*/**/*.test.ts"`,
				);
			} else {
				assert(false, 'bbResponse is not a string as expected');
			}

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			const expectedResources = [
				'src/tools/searchProject.tool/tests/tool.test.ts',
			];
			const resourceContent = toolResults.split('<resources>')[1].split('</resources>')[0].trim();
			const foundResources = resourceContent.split('\n');

			expectedResources.forEach((resource) => {
				assert(
					foundResources.some((r) => r.endsWith(resource)),
					`Resource ${resource} not found in the result`,
				);
			});
			assert(
				foundResources.length === expectedResources.length,
				'Number of found resources does not match expected',
			);

			// Test that resources at different depths are found
			const depths = foundResources.map((r) => (r.match(/\//g) || []).length);
			assert(
				Math.max(...depths) === 4,
				'Should find resources at maximum depth (src/tools/searchProject.tool/tests/)',
			);

			// Verify non-matching resources are not included
			assert(!toolResults.includes('src/search.test.ts'), 'Should not include resources without searchProject');
			assert(
				!toolResults.includes('tests/project.test.ts'),
				'Should not include resources without searchProject',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
