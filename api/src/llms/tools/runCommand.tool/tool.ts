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
import type { LLMToolRunCommandInput, OutputTruncationLines } from './types.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { join } from '@std/path';

interface LLMToolRunCommandConfig extends LLMToolConfig {
	allowedCommands?: string[];
}

export default class LLMToolRunCommand extends LLMTool {
	private allowedCommands: Array<string>;

	constructor(name: string, description: string, toolConfig: LLMToolRunCommandConfig) {
		super(name, description, toolConfig);
		this.allowedCommands = toolConfig.allowedCommands || [];
		// add at least one allowedCommand to avoid schema validation error: data/properties/command/enum must NOT have fewer than 1 items
		if (!Array.isArray(this.allowedCommands) || this.allowedCommands.length === 0) this.allowedCommands = ['ls'];
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
				dataSourceId: {
					type: 'string',
					description:
						"Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
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
						`The working directory for command execution, relative to data source root. Important considerations:\n\n` +
						`1. Path Requirements:\n` +
						`   * Must be relative to data source root\n` +
						`   * Cannot navigate outside data source directory\n` +
						`   * Parent directory references (..) not allowed\n` +
						`   Examples:\n` +
						`   * "src" - Run in data source's src directory\n` +
						`   * "tests/fixtures" - Run in test fixtures directory\n\n` +
						`2. Default Behavior:\n` +
						`   * If not provided, commands run from data source root\n` +
						`   * Useful for commands that need specific context\n` +
						`   * Affects how relative paths in args are resolved\n\n` +
						`3. Common Use Cases:\n` +
						`   * Running tests from test directory\n` +
						`   * Building from specific source directory\n` +
						`   * Managing dependencies in package directory`,
				},
				outputTruncation: {
					type: 'object',
					properties: {
						keepLines: {
							type: 'object',
							properties: {
								stdout: {
									type: 'object',
									properties: {
										head: {
											type: 'number',
											description: 'Number of lines to keep from the beginning of stdout',
											minimum: 0,
										},
										tail: {
											type: 'number',
											description: 'Number of lines to keep from the end of stdout',
											minimum: 0,
										},
									},
								},
								stderr: {
									type: 'object',
									properties: {
										head: {
											type: 'number',
											description: 'Number of lines to keep from the beginning of stderr',
											minimum: 0,
										},
										tail: {
											type: 'number',
											description: 'Number of lines to keep from the end of stderr',
											minimum: 0,
										},
									},
								},
							},
							description:
								'Configuration for truncating command output. Allows keeping specified numbers of lines from the beginning (head) and/or end (tail) of stdout and stderr outputs.',
						},
					},
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
		resultContent: CollaborationLogEntryContentToolResult,
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
		const { command, args = [], cwd, outputTruncation, dataSourceId = undefined } =
			toolInput as LLMToolRunCommandInput;

		const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		if (!primaryDsConnection) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
		const dsConnectionToUseId = dsConnectionToUse.id;
		if (!dsConnectionToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dataSourceRoot = dsConnectionToUse.getDataSourceRoot();
		if (!dataSourceRoot) {
			throw createError(ErrorType.DataSourceHandling, `No data source root`, {
				name: 'datasource',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

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
		let workingDir = dataSourceRoot;
		if (cwd) {
			const resourceUri = dsConnectionToUse.getUriForResource(`file:./${cwd}`);
			if (!await dsConnectionToUse.isResourceWithinDataSource(resourceUri)) {
				throw createError(
					ErrorType.CommandExecution,
					`Invalid working directory: ${cwd} is outside the data source`,
					{
						name: 'command-execution-error',
						command,
						args,
						cwd,
					},
				);
			}
			workingDir = join(dataSourceRoot, cwd);
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

			const fullStdout = new TextDecoder().decode(stdout);
			const fullStderr = new TextDecoder().decode(stderr);

			const { result: truncatedStdout, truncatedInfo: stdoutTruncatedInfo } = this.truncateOutput(
				fullStdout,
				outputTruncation?.keepLines?.stdout,
			);
			const { result: truncatedStderr, truncatedInfo: stderrTruncatedInfo } = this.truncateOutput(
				fullStderr,
				outputTruncation?.keepLines?.stderr,
			);

			const isError = code !== 0;
			const stderrContainsError = this.checkStderrForErrors(fullStdout, command);

			const truncatedInfo = (stdoutTruncatedInfo || stderrTruncatedInfo)
				? {
					stdout: stdoutTruncatedInfo,
					stderr: stderrTruncatedInfo,
				}
				: undefined;

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.id}]`;

			const toolResults =
				`Used data source: ${dsConnectionToUse.name}\nCommand executed with exit code: ${code}\n\nOutput:\n${truncatedStdout}${
					stdoutTruncatedInfo
						? `\n[stdout truncated: kept ${stdoutTruncatedInfo.keptLines} of ${stdoutTruncatedInfo.originalLines} lines]`
						: ''
				}${
					truncatedStderr
						? `\n\nError output:\n${truncatedStderr}${
							stderrTruncatedInfo
								? `\n[stderr truncated: kept ${stderrTruncatedInfo.keptLines} of ${stderrTruncatedInfo.originalLines} lines]`
								: ''
						}`
						: ''
				}`;
			const toolResponse = dsConnectionStatus + '\n\n' +
				(isError ? 'Command exited with non-zero status' : 'Command completed successfully');
			const bbResponse = {
				data: {
					code,
					command,
					stderrContainsError,
					stdout: truncatedStdout,
					stderr: truncatedStderr,
					truncatedInfo,
					dataSource: {
						dsConnectionId: dsConnectionToUse.id,
						dsConnectionName: dsConnectionToUse.name,
						dsProviderType: dsConnectionToUse.providerType,
					},
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

	private truncateOutput(output: string, config?: OutputTruncationLines): {
		result: string;
		truncatedInfo?: { originalLines: number; keptLines: number };
	} {
		if (!config) {
			return { result: output };
		}

		// Trim trailing newlines before splitting to get accurate line count
		const lines = output.trimEnd().split('\n');
		const originalLineCount = lines.length;
		const { head = 0, tail = 0 } = config;

		// If total lines to keep is greater than available lines, return everything
		if (head + tail >= lines.length) {
			return { result: output };
		}

		const headLines = head > 0 ? lines.slice(0, head) : [];
		const tailLines = tail > 0 ? lines.slice(-tail) : [];

		const truncatedLines = [];
		// Add head lines if any
		if (headLines.length > 0) {
			truncatedLines.push(...headLines);
		}

		// Add truncation message if we're truncating
		if (originalLineCount > head + tail) {
			truncatedLines.push(`[...truncated ${originalLineCount - head - tail} lines...]`);
		}

		// Add tail lines if any
		if (tailLines.length > 0) {
			truncatedLines.push(...tailLines);
		}

		return {
			result: truncatedLines.join('\n') + '\n', // Add single trailing newline for consistency
			truncatedInfo: {
				originalLines: originalLineCount,
				keptLines: headLines.length + tailLines.length,
			},
		};
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
