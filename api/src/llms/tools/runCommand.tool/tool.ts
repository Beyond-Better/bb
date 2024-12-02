//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type {
	LLMToolConfig,
	LLMToolInputSchema,
	LLMToolLogEntryFormattedResult,
	LLMToolRunResult,
} from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type { LLMToolRunCommandInput } from './types.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { join } from '@std/path';

interface LLMToolRunCommandConfig extends LLMToolConfig {
	allowedCommands?: string[];
}

export default class LLMToolRunCommand extends LLMTool {
	private allowedCommands: Array<string>;

	constructor(name: string, description: string, toolConfig: LLMToolRunCommandConfig) {
		super(name, description, toolConfig);
		this.allowedCommands = toolConfig.allowedCommands || [];
		logger.debug(
			`LLMToolRunCommand: Initialized with allowed commands:\n${
				this.allowedCommands.map((cmd) => `  - ${cmd}`).join('\n')
			}`,
		);
	}

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				command: {
					type: 'string',
					enum: this.allowedCommands,
					description:
						`The command to run. Only commands from the user-configured allow list can be executed. Currently allowed commands:\n\n` +
						`${this.allowedCommands.map((cmd) => `* ${cmd}`).join('\n')}\n\n` +
						`Important Notes:\n` +
						`* The allow list is configured by the user and can include any shell commands\n` +
						`* Current list shows commands the user has explicitly permitted\n` +
						`* If you need a command that isn't listed, suggest the user add it to their configuration\n` +
						`* Example suggestion: "I could help better if the 'git status' command was added to the allow list"\n\n` +
						`Command Output Handling:\n` +
						`* Commands may write to both stdout and stderr\n` +
						`* stderr output doesn't always indicate an error (many tools use it for status messages)\n` +
						`* Wait for command completion before proceeding\n` +
						`* Review command output carefully before suggesting next steps`,
				},
				args: {
					type: 'array',
					items: {
						type: 'string',
					},
					description:
						`Optional arguments for the command. Usage depends on the specific command in the allow list.\n\n` +
						`Examples of argument usage:\n` +
						`* File paths: ["path/to/file"]\n` +
						`* Options: ["--verbose", "--format=json"]\n` +
						`* Multiple args: ["src/", "--recursive"]\n\n` +
						`Note: Arguments must be appropriate for the command being run. Review the command's documentation or help output if unsure about valid arguments.`,
				},
				cwd: {
					type: 'string',
					description:
						`The working directory for command execution, relative to project root. Important considerations:\n\n` +
						`1. Path Requirements:\n` +
						`   * Must be relative to project root\n` +
						`   * Cannot navigate outside project directory\n` +
						`   * Parent directory references (..) not allowed\n` +
						`   Examples:\n` +
						`   * "src" - Run in project's src directory\n` +
						`   * "tests/fixtures" - Run in test fixtures directory\n\n` +
						`2. Default Behavior:\n` +
						`   * If not provided, commands run from project root\n` +
						`   * Useful for commands that need specific context\n` +
						`   * Affects how relative paths in args are resolved\n\n` +
						`3. Common Use Cases:\n` +
						`   * Running tests from test directory\n` +
						`   * Building from specific source directory\n` +
						`   * Managing dependencies in package directory`,
				},
			},
			required: ['command'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { command, args = [], cwd } = toolInput as LLMToolRunCommandInput;

		logger.info(
			`LLMToolRunCommand: Validating command '${command}' against allowed commands:\n${
				this.allowedCommands.map((cmd) => `  - ${cmd}`).join('\n')
			}`,
		);

		if (!this.allowedCommands.some((allowed) => command.startsWith(allowed))) {
			logger.info(`LLMToolRunCommand: Command '${command}' not in allowed list`);
			const toolResults =
				`Command not allowed: ${command}. For security reasons, only commands in the user's allow list can be run. Consider suggesting that the user adds this command to their configuration if it would be helpful.`;
			const toolResponse = `Command '${command}' not in allowed list`;
			// const bbResponse =
			// 	`BB won't run unapproved commands: ${command}. Suggest adding this command to the allow list if it's needed.`;
			const bbResponse = {
				data: {
					code: -1,
					command,
					stderrContainsError: true,
					stdout: '',
					stderr: 'Command not in allowed list',
				},
			};

			return { toolResults, toolResponse, bbResponse };
		}

		// Validate working directory if provided
		let workingDir = projectEditor.projectRoot;
		if (cwd) {
			if (!await isPathWithinProject(projectEditor.projectRoot, cwd)) {
				throw createError(
					ErrorType.CommandExecution,
					`Invalid working directory: ${cwd} is outside the project directory`,
					{
						name: 'command-execution-error',
						command,
						args,
						cwd,
					},
				);
			}
			workingDir = join(projectEditor.projectRoot, cwd);
			logger.info(`LLMToolRunCommand: Using working directory: ${workingDir}`);
		}

		try {
			logger.info(`LLMToolRunCommand: Running command: ${command} ${args.join(' ')}`);
			const [denoCommand, ...denoArgs] = command.split(' ');
			const process = new Deno.Command(denoCommand, {
				args: [...denoArgs, ...args],
				cwd: workingDir,
				stdout: 'piped',
				stderr: 'piped',
			});

			const { code, stdout, stderr } = await process.output();

			const output = new TextDecoder().decode(stdout);
			const errorOutput = new TextDecoder().decode(stderr);

			const isError = code !== 0;
			const stderrContainsError = this.checkStderrForErrors(errorOutput, command);

			const toolResults = `Command executed with exit code: ${code}\n\nOutput:\n${output}${
				errorOutput ? `\n\nError output:\n${errorOutput}` : ''
			}`;
			const toolResponse = isError ? 'Command exited with non-zero status' : 'Command completed successfully';
			const bbResponse = {
				data: {
					code,
					command,
					stderrContainsError,
					stdout: output,
					stderr: errorOutput,
				},
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			const errorMessage = `Failed to execute command: ${(error as Error).message}`;
			logger.error(`LLMToolRunCommand: ${errorMessage}`);

			throw createError(ErrorType.CommandExecution, errorMessage, {
				name: 'command-execution-error',
				command,
				args,
				cwd,
			});
		}
	}

	private stripAnsi(str: string): string {
		// deno-lint-ignore no-control-regex
		return str.replace(/\u001b\[\d+m/g, '');
	}

	// this stderr check is currently focused on Deno which uses stderr for "status output" which isn't necessarily errors
	// other CLI commands also use stderr similarly, so presence of output in stderr doesn't always indicate an error
	// this function searches for text that "looks like" errors
	private checkStderrForErrors(stderr: string, command: string): boolean {
		// List of strings that indicate an actual error in stderr
		const errorIndicators = ['error:', 'exception:', 'failed:'];

		/*
		// According to Claude:
		Yes, several other commands use stderr for status output or non-error information:
		- deno: Outputs warnings and progress to stderr
		- git: Often outputs progress information to stderr
		- npm: Outputs warnings and progress to stderr
		- docker: Outputs build progress and warnings to stderr
		- curl: Outputs progress meters to stderr
		- ffmpeg: Outputs encoding progress to stderr
		- rsync: Outputs progress information to stderr
		- wget: Outputs download progress to stderr
		 */
		// List of commands that use stderr for "status output" and not just errors - this list should become part of toolConfig.run_command
		const commandNames = ['deno', 'git', 'npm', 'docker', 'curl', 'ffmpeg', 'rsync', 'wget'];

		// Check if any error indicators are present in stderr
		stderr = this.stripAnsi(stderr);
		const containsError = errorIndicators.some((indicator) => stderr.toLowerCase().includes(indicator));

		// For known commands, presence of output in stderr doesn't always indicate an error
		if (commandNames.some((name) => command.startsWith(name)) && !containsError) {
			return false;
		}

		// For other commands, any output to stderr is considered an error
		return stderr.trim() !== '';
	}
}
