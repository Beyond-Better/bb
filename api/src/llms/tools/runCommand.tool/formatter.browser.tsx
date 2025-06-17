/** @jsxImportSource preact */
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolRunCommandInput, LLMToolRunCommandResult } from './types.ts';
import { logger } from 'shared/logger.ts';
import { AnsiUp } from 'ansi_up';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { command, args = [], cwd } = toolInput as LLMToolRunCommandInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.box(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Command:')} {LLMTool.TOOL_TAGS_BROWSER.base.code(command)}
				</>,
			)}
			{args.length > 0 && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Arguments:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.code(args.join(' '))}
				</>,
			)}
			{cwd && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Working Directory:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.directory(cwd)}
				</>,
			)}
			{toolInput.outputTruncation && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Output Truncation:')}
					{toolInput.outputTruncation.keepLines?.stdout && (
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('stdout:')} {[
								toolInput.outputTruncation.keepLines.stdout.head > 0 &&
								`head: ${toolInput.outputTruncation.keepLines.stdout.head}`,
								toolInput.outputTruncation.keepLines.stdout.tail > 0 &&
								`tail: ${toolInput.outputTruncation.keepLines.stdout.tail}`,
							].filter(Boolean).join(', ')}
						</div>
					)}
					{toolInput.outputTruncation.keepLines?.stderr && (
						<div>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('stderr:')} {[
								toolInput.outputTruncation.keepLines.stderr.head > 0 &&
								`head: ${toolInput.outputTruncation.keepLines.stderr.head}`,
								toolInput.outputTruncation.keepLines.stderr.tail > 0 &&
								`tail: ${toolInput.outputTruncation.keepLines.stderr.tail}`,
							].filter(Boolean).join(', ')}
						</div>
					)}
				</>,
			)}
		</>,
		`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Run Command'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Running: ${command}`),
		content,
		preview: `Running: ${command}${args.length ? ' with args' : ''}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolRunCommandResult;
	const ansi_up = new AnsiUp();
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { code, command, stderrContainsError, stdout, stderr } = bbResponse.data;

		const content = LLMTool.TOOL_TAGS_BROWSER.base.box(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Command:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.code(command)}
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Exit Code:')}{' '}
						<span className={code === 0 ? 'text-green-600' : 'text-red-600'}>
							{code}
						</span>
					</>,
				)}
				{stderrContainsError && LLMTool.TOOL_TAGS_BROWSER.base.box(
					LLMTool.TOOL_TAGS_BROWSER.base.label('⚠️ Potential issues detected in stderr'),
					`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.status.warning}`,
				)}
				{stdout && LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Command Output:')}
						<pre
							className={LLMTool.TOOL_STYLES_BROWSER.base.pre}
							dangerouslySetInnerHTML={{
								__html: ansi_up.ansi_to_html(stdout),
							}}
						/>
					</>,
					`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
				)}
				{stderr && LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Error Output:')}
						<pre
							className={LLMTool.TOOL_STYLES_BROWSER.base.pre}
							dangerouslySetInnerHTML={{
								__html: ansi_up.ansi_to_html(stderr),
							}}
						/>
					</>,
					`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
				)}
				{bbResponse.data.truncatedInfo && LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Output Truncation Info:')}
						{bbResponse.data.truncatedInfo.stdout && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('stdout:')} kept{' '}
								{bbResponse.data.truncatedInfo.stdout.keptLines} of{' '}
								{bbResponse.data.truncatedInfo.stdout.originalLines} lines
							</div>
						)}
						{bbResponse.data.truncatedInfo.stderr && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('stderr:')} kept{' '}
								{bbResponse.data.truncatedInfo.stderr.keptLines} of{' '}
								{bbResponse.data.truncatedInfo.stderr.originalLines} lines
							</div>
						)}
					</>,
				)}
			</>,
			LLMTool.TOOL_STYLES_BROWSER.base.box,
		);

		const status = code === 0 ? 'completed' : 'failed';
		const statusText = stderrContainsError ? 'completed with warnings' : status;

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Run Command'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Command ${statusText}`),
			content,
			preview: `Command ${statusText} with exit code ${code}`,
		};
	} else {
		logger.error('LLMToolRunCommand: Unexpected bbResponse format:', bbResponse);
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse)),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Run Command'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content,
			preview: 'Command execution failed',
		};
	}
};
