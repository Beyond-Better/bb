import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContent } from 'shared/types.ts';
import type { LLMToolDelegateTasksInput, LLMToolDelegateTasksResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { tasks } = toolInput as LLMToolDelegateTasksInput;

	const content = stripIndents`
        ${
		tasks.map((task, _index) => {
			const options = task.options
				? ` ${
					Object.entries(task.options)
						.map(([key, value]) => `${key}: ${value}`)
						.join(', ')
				}`
				: '';

			return stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Task:')} 
                ${LLMTool.TOOL_STYLES_CONSOLE.content.toolName(task.type)} → 
                ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(task.target)}
                ${options ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Options:')}${options}` : ''}
            `;
		}).join('\n')
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Delegate Tasks'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${tasks.length} task${tasks.length === 1 ? '' : 's'}`),
		content,
		preview: `Delegating ${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContent,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as LLMToolDelegateTasksResult;
	const { completedTasks, errorMessages } = bbResponse.data;

	const content = stripIndents`
        ${
		completedTasks.map((task) => {
			const statusColor = task.status === 'completed'
				? LLMTool.TOOL_STYLES_CONSOLE.status.success
				: LLMTool.TOOL_STYLES_CONSOLE.status.error;

			return stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Task:')} 
                ${LLMTool.TOOL_STYLES_CONSOLE.content.toolName(task.type)} → 
                ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(task.target)}
                ${statusColor(task.status)}
                ${task.error ? `\n${LLMTool.TOOL_STYLES_CONSOLE.status.error(`Error: ${task.error}`)}` : ''}
                ${task.result ? `\n${task.result}` : ''}
            `;
		}).join('\n\n')
	}
        ${errorMessages?.length ? `\n${LLMTool.TOOL_STYLES_CONSOLE.status.error(errorMessages.join('\n'))}` : ''}
    `;

	const completedCount = completedTasks.filter((t) => t.status === 'completed').length;
	const failedCount = completedTasks.filter((t) => t.status === 'failed').length;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Delegate Tasks'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
			`${completedCount} completed, ${failedCount} failed`,
		),
		content,
		preview: `${completedCount} tasks completed, ${failedCount} failed`,
	};
}
