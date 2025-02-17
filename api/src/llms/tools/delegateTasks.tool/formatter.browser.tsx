/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContent } from 'shared/types.ts';
import type { LLMToolDelegateTasksInput, LLMToolDelegateTasksResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

const TOOL_SPECIFIC_STYLES = {
	container: `${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
	taskList: 'space-y-2',
	taskItem: 'flex justify-between items-center',
	taskStatus: {
		completed: 'bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-sm',
		failed: 'bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-sm',
	},
};

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { tasks } = toolInput as LLMToolDelegateTasksInput;

	const content = (
		<div className={TOOL_SPECIFIC_STYLES.container}>
			Task Input
		</div>
	);

	/*
	const content = (
		<div className={TOOL_SPECIFIC_STYLES.container}>
			<div className={TOOL_SPECIFIC_STYLES.taskList}>
				{tasks.map((task, index) => (
					<div key={index} className={TOOL_SPECIFIC_STYLES.taskItem}>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Task:')}{'  '}
						{LLMTool.TOOL_TAGS_BROWSER.content.toolName(task.type)}
						{' → '}
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(task.target)}
						{task.options && (
							<>
								{' '}
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Options:')}{'  '}
								{Object.entries(task.options).map(([key, value]) => (
									<span key={key}>
										{key}: {String(value)}
										{' '}
									</span>
								))}
							</>
						)}
					</div>
				))}
			</div>
		</div>
	);
 */

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Delegate Tasks'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${tasks.length} task${tasks.length === 1 ? '' : 's'}`),
		content,
		preview: `Delegating ${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContent,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as LLMToolDelegateTasksResult;
	const { completedTasks, errorMessages } = bbResponse.data;

	const content = (
		<div className={TOOL_SPECIFIC_STYLES.container}>
			Task Results
			{errorMessages && errorMessages.length > 0 && (
				<div className={LLMTool.TOOL_STYLES_BROWSER.status.error}>
					{errorMessages.map((error, index) => <div key={index}>{error}</div>)}
				</div>
			)}
		</div>
	);

	/*
	const content = (
		<div className={TOOL_SPECIFIC_STYLES.container}>
			<div className={TOOL_SPECIFIC_STYLES.taskList}>
				{completedTasks.map((task, index) => (
					<div key={index} className={TOOL_SPECIFIC_STYLES.taskItem}>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Task:')}{'  '}
						{LLMTool.TOOL_TAGS_BROWSER.content.toolName(task.type)}
						{' → '}
						{LLMTool.TOOL_TAGS_BROWSER.content.filename(task.target)}{' '}
						<span className={TOOL_SPECIFIC_STYLES.taskStatus[task.status]}>
							{task.status}
						</span>
						{task.error && (
							<div className={LLMTool.TOOL_STYLES_BROWSER.status.error}>
								Error: {task.error}
							</div>
						)}
						{task.result && (
							<div>
								{LLMTool.TOOL_TAGS_BROWSER.base.pre(task.result)}
							</div>
						)}
					</div>
				))}
				{errorMessages && errorMessages.length > 0 && (
					<div className={LLMTool.TOOL_STYLES_BROWSER.status.error}>
						{errorMessages.map((error, index) => <div key={index}>{error}</div>)}
					</div>
				)}
			</div>
		</div>
	);
 */

	const completedCount = completedTasks.filter((t) => t.status === 'completed').length;
	const failedCount = completedTasks.filter((t) => t.status === 'failed').length;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Delegate Tasks'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
			`${completedCount} completed, ${failedCount} failed`,
		),
		content,
		preview: `${completedCount} tasks completed, ${failedCount} failed`,
	};
}
