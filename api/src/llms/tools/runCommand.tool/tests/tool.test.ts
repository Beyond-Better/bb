import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { stripIndents } from 'common-tags';
import { stripAnsiCode } from '@std/fmt/colors';

import type LLMToolRunCommand from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

// Type guard function
function isRunCommandResponse(
	response: unknown,
): response is {
	data: {
		code: number;
		command: string;
		stderrContainsError: boolean;
		stdout: string;
		stderr: string;
	};
} {
	return (
		typeof response === 'object' &&
		response !== null &&
		'data' in response &&
		typeof (response as any).data === 'object' &&
		'code' in (response as any).data &&
		typeof (response as any).data.code === 'number' &&
		'command' in (response as any).data &&
		typeof (response as any).data.command === 'string' &&
		'stderrContainsError' in (response as any).data &&
		typeof (response as any).data.stderrContainsError === 'boolean' &&
		'stdout' in (response as any).data &&
		typeof (response as any).data.stdout === 'string' &&
		'stderr' in (response as any).data &&
		typeof (response as any).data.stderr === 'string'
	);
}

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function stripAnsi(str: string): string {
	return str.replace(/\u001b\[\d+m/g, '');
}

function createTestFiles(testProjectRoot: string) {
	// Create a simple TypeScript file
	Deno.writeTextFileSync(join(testProjectRoot, 'test.ts'), `console.log("Hello, TypeScript!");`);

	// Create a test file
	Deno.writeTextFileSync(
		join(testProjectRoot, 'test_file.ts'),
		stripIndents`
			import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
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

const toolConfig = {
	allowedCommands: [
		'deno task tool:check-types-project',
		'deno task tool:check-types-args',
		'deno task tool:test',
		'deno task tool:format',
	],
};

Deno.test({
	name: 'RunCommandTool - Execute allowed command: deno task tool:check-types',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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

			const conversation = await projectEditor.initConversation('test-conversation-id');
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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

			const conversation = await projectEditor.initConversation('test-conversation-id');
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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

			const conversation = await projectEditor.initConversation('test-conversation-id');
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
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
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
			const conversation = await projectEditor.initConversation('test-conversation-id');
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
