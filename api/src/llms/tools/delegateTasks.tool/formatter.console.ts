import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContent } from 'shared/types.ts';
import type { LLMToolDelegateTasksInput, LLMToolDelegateTasksResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';
import { logger } from 'shared/logger.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { tasks, sync } = toolInput as LLMToolDelegateTasksInput;

	const formattedContent = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Execution Mode:')} ${sync ? 'Synchronous' : 'Asynchronous'}
		
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Tasks:')}
		${
		tasks.map((task, index) => {
			return stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Task ' + (index + 1))}
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Title:')} ${task.title}
			
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Background:')}
			${task.background}
			
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('Instructions:')}
			${task.instructions}
			
			${
				task.capabilities && task.capabilities.length > 0
					? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Capabilities:')} ${task.capabilities.join(', ')}
`
					: ''
			}
			
			${
				task.resources && task.resources.length > 0
					? stripIndents`${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resources:')}
				${task.resources.map((resource) => `- ${resource.type}: ${resource.location}`).join('\n')}
`
					: ''
			}
			`;
		}).join('\n\n')
	}
	`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Delegate Tasks'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
			`${tasks.length} task${tasks.length === 1 ? '' : 's'} (${sync ? 'Sync' : 'Async'})`,
		),
		content: formattedContent,
		preview: `Delegating ${tasks.length} task${tasks.length === 1 ? '' : 's'} ${
			sync ? 'synchronously' : 'asynchronously'
		}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContent,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as LLMToolDelegateTasksResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { completedTasks, errorMessages } = bbResponse.data;

		const formattedContent = stripIndents`
			${
			completedTasks.map((task, index) => {
				const statusColor = task.status === 'completed'
					? LLMTool.TOOL_STYLES_CONSOLE.status.success
					: LLMTool.TOOL_STYLES_CONSOLE.status.error;

				return stripIndents`
				${LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Task Result ' + (index + 1))}
				${LLMTool.TOOL_STYLES_CONSOLE.base.label('Task:')} ${task.title}
				${LLMTool.TOOL_STYLES_CONSOLE.base.label('Status:')} ${statusColor(task.status)}
				
				${
					task.result
						? stripIndents`
				${LLMTool.TOOL_STYLES_CONSOLE.base.label('Result:')}
				${task.result}
				`
						: ''
				}
				
				${
					task.error
						? stripIndents`
				${LLMTool.TOOL_STYLES_CONSOLE.base.label('Error:')}
				${LLMTool.TOOL_STYLES_CONSOLE.status.error(task.error)}
				`
						: ''
				}
				`;
			}).join('\n\n')
		}
			
			${
			errorMessages?.length
				? stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error Messages')}
			${LLMTool.TOOL_STYLES_CONSOLE.status.error(errorMessages.join('\n'))}
			`
				: ''
		}
		`;

		const completedCount = completedTasks.filter((t) => t.status === 'completed').length;
		const failedCount = completedTasks.filter((t) => t.status === 'failed').length;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Delegate Tasks'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
				`${completedCount} completed, ${failedCount} failed`,
			),
			content: formattedContent,
			preview: `${completedCount} tasks completed, ${failedCount} failed`,
		};
	} else {
		// Handle error case similar to runCommand formatter
		logger.error('LLMToolDelegateTasks: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Delegate Tasks'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Tasks execution failed',
		};
	}
}
