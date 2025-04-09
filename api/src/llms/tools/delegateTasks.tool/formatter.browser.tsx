/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContent } from 'shared/types.ts';
import type { LLMToolDelegateTasksInput, LLMToolDelegateTasksResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

const TOOL_SPECIFIC_STYLES = {
	container: `${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
	taskList: 'space-y-4',
	taskItem: 'flex justify-between items-center',
	taskStatus: {
		completed: 'bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-sm',
		failed: 'bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-sm',
	},
};

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult {
	const { tasks, sync } = toolInput as LLMToolDelegateTasksInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.box(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Execution Mode:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.text(sync ? 'Synchronous' : 'Asynchronous')}
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Tasks:')}
					<div className={TOOL_SPECIFIC_STYLES.taskList}>
						{tasks.map((task, index) => (
							<div key={index} className={`${LLMTool.TOOL_STYLES_BROWSER.base.box} mb-2`}>
								<div className='mt-1'>
									{LLMTool.TOOL_TAGS_BROWSER.base.label('Title:')}{' '}
									{LLMTool.TOOL_TAGS_BROWSER.base.text(task.title)}
								</div>

								<div className='mt-2'>
									{LLMTool.TOOL_TAGS_BROWSER.base.label('Background:')}
									<pre
										className={`${LLMTool.TOOL_STYLES_BROWSER.base.pre} mt-2 text-xs whitespace-pre-wrap`}
									>
										{task.background}
									</pre>
								</div>

								<div className='mt-2'>
									{LLMTool.TOOL_TAGS_BROWSER.base.label('Instructions:')}
									<pre
										className={`${LLMTool.TOOL_STYLES_BROWSER.base.pre} mt-2 text-xs whitespace-pre-wrap`}
									>
										{task.instructions}
									</pre>
								</div>

								{task.capabilities && task.capabilities.length > 0 && (
									<div className='mt-2'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Capabilities:')}{' '}
										<div className='mt-2'>
											{LLMTool.TOOL_TAGS_BROWSER.base.text(task.capabilities.join(', '))}
										</div>
									</div>
								)}

								{task.resources && task.resources.length > 0 && (
									<div className='mt-2'>
										{LLMTool.TOOL_TAGS_BROWSER.base.label('Resources:')}
										<div className='mt-2'>
											{LLMTool.TOOL_TAGS_BROWSER.base.list(
												task.resources.map((resource, _idx) => (
													<>
														{LLMTool.TOOL_TAGS_BROWSER.base.label(resource.type)}:{' '}
														{LLMTool.TOOL_TAGS_BROWSER.base.text(resource.uri)}
													</>
												)),
											)}
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				</>,
			)}
		</>,
		`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Delegate Tasks'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
			`${tasks.length} task${tasks.length === 1 ? '' : 's'} (${sync ? 'Sync' : 'Async'})`,
		),
		content,
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

		const content = LLMTool.TOOL_TAGS_BROWSER.base.box(
			<>
				{completedTasks.map((task, index) => (
					LLMTool.TOOL_TAGS_BROWSER.base.box(
						<>
							<div className='flex justify-between items-center'>
								<div className='font-semibold'>
									{LLMTool.TOOL_TAGS_BROWSER.base.label('Task:')}{' '}
									{LLMTool.TOOL_TAGS_BROWSER.base.text(task.title)}
								</div>
								<span className={TOOL_SPECIFIC_STYLES.taskStatus[task.status]}>
									{task.status}
								</span>
							</div>

							{task.result && (
								<div>
									{LLMTool.TOOL_TAGS_BROWSER.base.label('Result:')}
									<pre
										className={`${LLMTool.TOOL_STYLES_BROWSER.base.pre} mt-2 text-xs whitespace-pre-wrap`}
									>
										{task.result}
									</pre>
								</div>
							)}

							{task.error && (
								<div className={LLMTool.TOOL_STYLES_BROWSER.status.error}>
									{LLMTool.TOOL_TAGS_BROWSER.base.label('Error:')}
									<pre className='mt-2 whitespace-pre-wrap text-xs'>
										{task.error}
									</pre>
								</div>
							)}
						</>,
						index % 2 === 0
							? `${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`
							: LLMTool.TOOL_STYLES_BROWSER.base.box,
					)
				))}

				{errorMessages && errorMessages.length > 0 && (
					LLMTool.TOOL_TAGS_BROWSER.base.box(
						<>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Error Messages:')}
							{errorMessages.map((error, index) => (
								<div key={index} className={LLMTool.TOOL_STYLES_BROWSER.status.error}>
									{error}
								</div>
							))}
						</>,
						`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
					)
				)}
			</>,
			LLMTool.TOOL_STYLES_BROWSER.base.box,
		);

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
	} else {
		// Handle error case similar to runCommand formatter
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse)),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Delegate Tasks'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content,
			preview: 'Tasks execution failed',
		};
	}
}
