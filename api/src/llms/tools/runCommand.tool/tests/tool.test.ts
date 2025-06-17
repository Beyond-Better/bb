import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { stripIndents } from 'common-tags';
import { stripAnsiCode } from '@std/fmt/colors';

//import type LLMToolRunCommand from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolRunCommandResponseData } from '../types.ts';

// Type guard function
function isRunCommandResponse(
	response: unknown,
): response is LLMToolRunCommandResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'code' in data &&
		typeof data.code === 'number' &&
		'command' in data &&
		typeof data.command === 'string' &&
		'stderrContainsError' in data &&
		typeof data.stderrContainsError === 'boolean' &&
		'stdout' in data &&
		typeof data.stdout === 'string' &&
		'stderr' in data &&
		typeof data.stderr === 'string'
	);
}

// // Type guard to check if bbResponse is a string
// function isString(value: unknown): value is string {
// 	return typeof value === 'string';
// }

function stripAnsi(str: string): string {
	// deno-lint-ignore no-control-regex
	return str.replace(/\u001b\[\d+m/g, '');
}

function createTestFiles(testProjectRoot: string) {
	// Create generate_output.ts
	const generateOutputContent = stripIndents`
		// Generate stdout lines without extra newlines
		const stdoutLines = [];
		for (let i = 1; i <= 10; i++) {
			stdoutLines.push(\`stdout line \${i}\`);
		}
		console.log(stdoutLines.join('\\n'));

		// Generate stderr lines without extra newlines
		const stderrLines = [];
		for (let i = 1; i <= 5; i++) {
			stderrLines.push(\`stderr line \${i}\`);
		}
		console.error(stderrLines.join('\\n'));
	`;
	//console.log('Creating generate_output.ts with content:\\n', generateOutputContent);
	Deno.writeTextFileSync(
		join(testProjectRoot, 'generate_output.ts'),
		generateOutputContent,
	);

	// Create a simple TypeScript file
	Deno.writeTextFileSync(join(testProjectRoot, 'test.ts'), `console.log("Hello, TypeScript!");`);

	// Create a test file
	Deno.writeTextFileSync(
		join(testProjectRoot, 'test_file.ts'),
		stripIndents`
			import { assertEquals } from "jsr:@std/assert";
			Deno.test("example test", () => {
				const x = 1 + 2;
				assertEquals(x, 3);
			});
		`,
	);

	// Create a deno.jsonc file with task definitions
	Deno.writeTextFileSync(
		join(testProjectRoot, 'deno.jsonc'),
		JSON.stringify(
			{
				tasks: {
					'tool:check-types-project': 'deno check test.ts',
					'tool:check-types-args': 'deno check test.ts',
					'tool:test': 'deno test test_file.ts',
					'tool:format': 'deno fmt test.ts',
				},
			},
			null,
			2,
		),
	);
}

// Update type guard for truncation info
function isRunCommandResponseWithTruncation(
	response: unknown,
): response is LLMToolRunCommandResponseData {
	if (!isRunCommandResponse(response)) return false;

	if (!('truncatedInfo' in response.data)) return true;

	const truncatedInfo = response.data.truncatedInfo;
	if (!truncatedInfo) return true;

	if ('stdout' in truncatedInfo) {
		const stdout = truncatedInfo.stdout;
		if (!stdout || typeof stdout !== 'object') return false;
		if (!('originalLines' in stdout) || typeof stdout.originalLines !== 'number') return false;
		if (!('keptLines' in stdout) || typeof stdout.keptLines !== 'number') return false;
	}

	if ('stderr' in truncatedInfo) {
		const stderr = truncatedInfo.stderr;
		if (!stderr || typeof stderr !== 'object') return false;
		if (!('originalLines' in stderr) || typeof stderr.originalLines !== 'number') return false;
		if (!('keptLines' in stderr) || typeof stderr.keptLines !== 'number') return false;
	}

	return true;
}

const toolConfig = {
	allowedCommands: [
		'deno task tool:check-types-project',
		'deno task tool:check-types-args',
		'deno task tool:test',
		'deno task tool:format',
		'deno', // Added for output truncation tests
	],
};

Deno.test({
	name: 'RunCommandTool - Output truncation with tail only',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'deno',
					args: ['run', 'generate_output.ts'],
					outputTruncation: {
						keepLines: {
							stdout: { tail: 3 },
							stderr: { tail: 2 },
						},
					},
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Output truncation with tail only - bbResponse:', result.bbResponse);
			// console.log('Output truncation with tail only - toolResponse:', result.toolResponse);
			// console.log('Output truncation with tail only - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isRunCommandResponseWithTruncation(result.bbResponse),
				'bbResponse should have the correct structure with truncation info',
			);

			if (isRunCommandResponseWithTruncation(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.truncatedInfo, 'truncatedInfo should exist');
				assert(data.truncatedInfo.stdout, 'stdout truncation info should exist');
				assert(data.truncatedInfo.stderr, 'stderr truncation info should exist');

				// Verify stdout truncation
				const stdout = stripAnsi(data.stdout);
				assertStringIncludes(stdout, 'stdout line 8');
				assertStringIncludes(stdout, 'stdout line 9');
				assertStringIncludes(stdout, 'stdout line 10');
				assert(!stdout.includes('stdout line 7'), 'Should not include line 7');
				assertStringIncludes(stdout, '[...truncated');
				assert(data.truncatedInfo.stdout.originalLines === 10, 'Should have 10 original stdout lines');
				// Verify exact output format including trailing newline
				assert(data.stdout.endsWith('\n'), 'Output should end with newline');
				assert(!data.stdout.endsWith('\n\n'), 'Output should not have multiple trailing newlines');
				assert(data.truncatedInfo.stdout.keptLines === 3, 'Should keep 3 stdout lines');

				// Verify stderr truncation
				const stderr = stripAnsi(data.stderr);
				assertStringIncludes(stderr, 'stderr line 4');
				assertStringIncludes(stderr, 'stderr line 5');
				assert(!stderr.includes('stderr line 3'), 'Should not include line 3');
				assertStringIncludes(stderr, '[...truncated');
				assert(data.truncatedInfo.stderr.originalLines === 5, 'Should have 5 original stderr lines');
				// Verify exact output format including trailing newline
				assert(data.stderr.endsWith('\n'), 'Error output should end with newline');
				assert(!data.stderr.endsWith('\n\n'), 'Error output should not have multiple trailing newlines');
				assert(data.truncatedInfo.stderr.keptLines === 2, 'Should keep 2 stderr lines');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Output truncation with head and tail',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'deno',
					args: ['run', 'generate_output.ts'],
					outputTruncation: {
						keepLines: {
							stdout: { head: 2, tail: 2 },
							stderr: { head: 1, tail: 1 },
						},
					},
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isRunCommandResponseWithTruncation(result.bbResponse),
				'bbResponse should have the correct structure with truncation info',
			);

			if (isRunCommandResponseWithTruncation(result.bbResponse)) {
				const { data } = result.bbResponse;
				assert(data.truncatedInfo, 'truncatedInfo should exist');
				assert(data.truncatedInfo.stdout, 'stdout truncation info should exist');
				assert(data.truncatedInfo.stderr, 'stderr truncation info should exist');

				// Verify stdout truncation
				const stdout = stripAnsi(data.stdout);
				assertStringIncludes(stdout, 'stdout line 1');
				assertStringIncludes(stdout, 'stdout line 2');
				assertStringIncludes(stdout, 'stdout line 9');
				assertStringIncludes(stdout, 'stdout line 10');
				assert(!stdout.includes('stdout line 3'), 'Should not include line 3');
				assert(!stdout.includes('stdout line 8'), 'Should not include line 8');
				assertStringIncludes(stdout, '[...truncated');
				assert(data.truncatedInfo.stdout.originalLines === 10, 'Should have 10 original stdout lines');
				assert(data.truncatedInfo.stdout.keptLines === 4, 'Should keep 4 stdout lines');

				// Verify stderr truncation
				const stderr = stripAnsi(data.stderr);
				assertStringIncludes(stderr, 'stderr line 1');
				assertStringIncludes(stderr, 'stderr line 5');
				assert(!stderr.includes('stderr line 2'), 'Should not include line 2');
				assert(!stderr.includes('stderr line 4'), 'Should not include line 4');
				assertStringIncludes(stderr, '[...truncated');
				assert(data.truncatedInfo.stderr.originalLines === 5, 'Should have 5 original stderr lines');
				assert(data.truncatedInfo.stderr.keptLines === 2, 'Should keep 2 stderr lines');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - No truncation when output is shorter than limits',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'deno run',
					args: ['generate_output.ts'],
					outputTruncation: {
						keepLines: {
							stdout: { head: 5, tail: 5 }, // Total 10 lines requested, output has 10 lines
							stderr: { head: 3, tail: 3 }, // Total 6 lines requested, output has 5 lines
						},
					},
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isRunCommandResponseWithTruncation(result.bbResponse),
				'bbResponse should have the correct structure with truncation info',
			);

			if (isRunCommandResponseWithTruncation(result.bbResponse)) {
				const { data } = result.bbResponse;

				// Verify no truncation occurred
				const stdout = stripAnsi(data.stdout);
				for (let i = 1; i <= 10; i++) {
					assertStringIncludes(stdout, `stdout line ${i}`);
				}
				assert(!stdout.includes('[...truncated'), 'Should not include truncation message');

				const stderr = stripAnsi(data.stderr);
				for (let i = 1; i <= 5; i++) {
					assertStringIncludes(stderr, `stderr line ${i}`);
				}
				assert(!stderr.includes('[...truncated'), 'Should not include truncation message');

				// Verify truncation info is not present
				assert(!data.truncatedInfo, 'truncatedInfo should not exist when no truncation occurs');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:check-types',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'deno task tool:check-types-args',
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Execute allowed command: deno task tool:check-types - bbResponse:', result.bbResponse);
			// console.log('Execute allowed command: deno task tool:check-types - toolResponse:', result.toolResponse);
			// console.log('Execute allowed command: deno task tool:check-types - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isRunCommandResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isRunCommandResponse(result.bbResponse)) {
				assertEquals(result.bbResponse.data.code, 0, 'Test response code should be 0');
				assertEquals(
					result.bbResponse.data.command,
					'deno task tool:check-types-args',
					'Test response command should be "deno task tool:check-types-args"',
				);
				assertEquals(
					result.bbResponse.data.stderrContainsError,
					false,
					'Test response stderrContainsError should be false',
				);

				const stdout = stripAnsi(result.bbResponse.data.stdout);
				assertEquals(stdout, '', 'Test response stdout should be blank');
				const stderr = stripAnsi(result.bbResponse.data.stderr);
				assertStringIncludes(
					stderr,
					'Task tool:check-types-args deno check test.ts',
					'Test response stderr should include task command',
				);
				assertStringIncludes(stderr, 'Check file:', 'Test response stderr should include "Check file"');
				assertStringIncludes(stderr, 'test.ts', 'Test response stderr should include "test.ts"');
			} else {
				assert(false, 'bbResponse does not have the expected structure for Tool');
			}

			//assertStringIncludes(result.bbResponse, 'BB ran command: deno task tool:check-types-args');
			assertStringIncludes(result.toolResponse, 'Command completed successfully');
			assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Error output:\nTask tool:check-types-args deno check test.ts',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:test',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'deno task tool:test',
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Execute allowed command: deno task tool:test - bbResponse:', result.bbResponse);
			// console.log('Execute allowed command: deno task tool:test - toolResponse:', result.toolResponse);
			// console.log('Execute allowed command: deno task tool:test - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isRunCommandResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isRunCommandResponse(result.bbResponse)) {
				assertEquals(result.bbResponse.data.code, 0, 'Test response code should be 0');
				assertEquals(
					result.bbResponse.data.command,
					'deno task tool:test',
					'Test response command should be "deno task tool:test"',
				);
				assertEquals(
					result.bbResponse.data.stderrContainsError,
					false,
					'Test response stderrContainsError should be false',
				);

				const stdout = stripAnsi(result.bbResponse.data.stdout);
				assertStringIncludes(
					stdout,
					'running 1 test from ./test_file.ts',
					'Test response stdout should include "running test"',
				);
				assertStringIncludes(
					stdout,
					'example test ... ok',
					'Test response stdout should include "example test"',
				);
				assertStringIncludes(
					stdout,
					'ok | 1 passed | 0 failed',
					'Test response stdout should include test results',
				);

				const stderr = stripAnsi(result.bbResponse.data.stderr);
				assertStringIncludes(
					stderr,
					'Task tool:test deno test test_file.ts',
					'Test response stderr should include task command',
				);
				assertStringIncludes(stderr, 'Check file:', 'Test response stderr should include "Check file"');
				assertStringIncludes(stderr, 'test_file.ts', 'Test response stderr should include "test_file.ts"');
			} else {
				assert(false, 'bbResponse does not have the expected structure for Tool');
			}

			assertStringIncludes(result.toolResponse, 'Command completed successfully');
			assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Output:\nrunning 1 test from ./test_file.ts\nexample test ... ok',
			);
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Error output:\nTask tool:test deno test test_file.ts',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:format',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'deno task tool:format',
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Execute allowed command: deno task tool:format - bbResponse:', result.bbResponse);
			// console.log('Execute allowed command: deno task tool:format - toolResponse:', result.toolResponse);
			// console.log('Execute allowed command: deno task tool:format - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isRunCommandResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isRunCommandResponse(result.bbResponse)) {
				assertEquals(result.bbResponse.data.code, 0, 'Test response code should be 0');
				assertEquals(
					result.bbResponse.data.command,
					'deno task tool:format',
					'Test response command should be "deno task tool:format"',
				);
				assertEquals(
					result.bbResponse.data.stderrContainsError,
					false,
					'Test response stderrContainsError should be false',
				);

				const stdout = stripAnsi(result.bbResponse.data.stdout);
				assertEquals(stdout, '', 'Test response stdout should be blank');

				const stderr = stripAnsi(result.bbResponse.data.stderr);
				assertStringIncludes(
					stderr,
					'Task tool:format deno fmt test.ts',
					'Test response stderr should include task command',
				);
				assertStringIncludes(stderr, 'test.ts', 'Test response stderr should include "test.ts"');
				assertStringIncludes(stderr, 'Checked 1 file', 'Test response stderr should include "Checked 1 file"');
			} else {
				assert(false, 'bbResponse does not have the expected structure for Tool');
			}

			assertStringIncludes(result.toolResponse, 'Command completed successfully');
			assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command executed with exit code: 0');
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Output:\n\n',
			);
			assertStringIncludes(
				stripAnsiCode(result.toolResults as string),
				'Error output:\nTask tool:format deno fmt test.ts',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'RunCommandTool - Execute not allowed command',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			createTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor, 'run_command', toolConfig);
			const tool = await toolManager.getTool('run_command');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'run_command',
				toolInput: {
					command: 'echo',
					args: ['This command is not allowed'],
				},
			};
			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Execute allowed command: deno task tool:format - bbResponse:', result.bbResponse);
			// console.log('Execute allowed command: deno task tool:format - toolResponse:', result.toolResponse);
			// console.log('Execute allowed command: deno task tool:format - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assert(
				isRunCommandResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			if (isRunCommandResponse(result.bbResponse)) {
				assertEquals(result.bbResponse.data.code, -1, 'Test response code should be -1');
				assertEquals(
					result.bbResponse.data.command,
					'echo',
					'Test response command should be "echo"',
				);
				assertEquals(
					result.bbResponse.data.stderrContainsError,
					true,
					'Test response stderrContainsError should be true',
				);

				const stdout = stripAnsi(result.bbResponse.data.stdout);
				assertEquals(stdout, '', 'Test response stdout should be blank');

				const stderr = stripAnsi(result.bbResponse.data.stderr);
				assertStringIncludes(
					stderr,
					'Command not in allowed list',
					'Test response stderr should include BB error',
				);
			} else {
				assert(false, 'bbResponse does not have the expected structure for Tool');
			}

			assertStringIncludes(result.toolResponse, "Command 'echo' not in allowed list");
			assertStringIncludes(stripAnsiCode(result.toolResults as string), 'Command not allowed: echo');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
