import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRunCommandInput, LLMToolRunCommandResult } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { command, args = [], cwd } = toolInput as LLMToolRunCommandInput;

	const formattedContent = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Command:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.code(command)}
        ${
		toolInput.outputTruncation?.keepLines
			? stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Output Truncation:')}${
				toolInput.outputTruncation.keepLines.stdout
					? stripIndents`
                stdout: ${
						[
							toolInput.outputTruncation.keepLines.stdout.head > 0 &&
							`head: ${toolInput.outputTruncation.keepLines.stdout.head}`,
							toolInput.outputTruncation.keepLines.stdout.tail > 0 &&
							`tail: ${toolInput.outputTruncation.keepLines.stdout.tail}`,
						].filter(Boolean).join(', ')
					}`
					: ''
			}${
				toolInput.outputTruncation.keepLines.stderr
					? stripIndents`
                stderr: ${
						[
							toolInput.outputTruncation.keepLines.stderr.head > 0 &&
							`head: ${toolInput.outputTruncation.keepLines.stderr.head}`,
							toolInput.outputTruncation.keepLines.stderr.tail > 0 &&
							`tail: ${toolInput.outputTruncation.keepLines.stderr.tail}`,
						].filter(Boolean).join(', ')
					}`
					: ''
			}
        `
			: ''
	}
        ${
		args.length > 0
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Arguments:')} ${
				LLMTool.TOOL_STYLES_CONSOLE.content.code(args.join(' '))
			}`
			: ''
	}
        ${
		cwd
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Working Directory:')} ${
				LLMTool.TOOL_STYLES_CONSOLE.content.directory(cwd)
			}`
			: ''
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Run Command'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Running: ${command}`),
		content: formattedContent,
		preview: `Running ${command}${args.length ? ' with args' : ''}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolRunCommandResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { code, command, stderrContainsError, stdout, stderr } = bbResponse.data;

		const formattedContent = stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Command:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.code(command)}
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Exit Code:')} ${
			code === 0
				? LLMTool.TOOL_STYLES_CONSOLE.status.success(code.toString())
				: LLMTool.TOOL_STYLES_CONSOLE.status.error(code.toString())
		}
            ${
			stderrContainsError
				? LLMTool.TOOL_STYLES_CONSOLE.status.warning('(Potential issues detected in stderr)')
				: ''
		}

            ${
			stdout
				? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Command Output:')}
                ${LLMTool.TOOL_STYLES_CONSOLE.content.code(stdout)}
            `
				: ''
		}

            ${
			stderr
				? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Error Output:')}
                ${LLMTool.TOOL_STYLES_CONSOLE.status.error(stderr)}
            `
				: ''
		}

            ${
			bbResponse.data.truncatedInfo
				? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Output Truncation Info:')}${
					bbResponse.data.truncatedInfo.stdout
						? stripIndents`
                    stdout: kept ${bbResponse.data.truncatedInfo.stdout.keptLines} of ${bbResponse.data.truncatedInfo.stdout.originalLines} lines`
						: ''
				}${
					bbResponse.data.truncatedInfo.stderr
						? stripIndents`
                    stderr: kept ${bbResponse.data.truncatedInfo.stderr.keptLines} of ${bbResponse.data.truncatedInfo.stderr.originalLines} lines`
						: ''
				}
            `
				: ''
		}
        `;

		const status = code === 0 ? 'completed' : 'failed';
		const statusText = stderrContainsError ? 'completed with warnings' : status;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Run Command'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Command ${statusText}`),
			content: formattedContent,
			preview: `Command ${statusText} with exit code ${code}`,
		};
	} else {
		logger.error('LLMToolRunCommand: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Run Command'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Command execution failed',
		};
	}
};
