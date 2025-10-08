/** @jsxImportSource preact */
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolSearchWebInput, LLMToolSearchWebResultData } from './types.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolSearchWebInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.box(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Query:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.code(`"${input.query}"`)}
				</>,
			)}
			{input.count && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Results:')} {input.count}
				</>,
			)}
			{input.country && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Country:')} {input.country}
				</>,
			)}
			{input.safesearch && input.safesearch !== 'moderate' && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Safe Search:')} {input.safesearch}
				</>,
			)}
			{input.result_filter && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Filter:')} {input.result_filter}
				</>,
			)}
			{input.freshness && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Freshness:')} {input.freshness}
				</>,
			)}
			{input.search_lang && input.search_lang !== 'en' && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Language:')} {input.search_lang}
				</>,
			)}
			{input.extra_snippets && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Extra Snippets:')} enabled
				</>,
			)}
		</>,
		`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.content.code}`,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Search Web'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Searching: "${input.query}"`),
		content,
		preview: `Searching web for "${input.query}"${input.count ? ` (${input.count} results)` : ''}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'string') {
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(bbResponse),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.error}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search Web'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content,
			preview: 'Web search failed',
		};
	}

	if (!bbResponse?.data) {
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label('No search results data available'),
			`${LLMTool.TOOL_STYLES_BROWSER.base.container} ${LLMTool.TOOL_STYLES_BROWSER.status.warning}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search Web'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('no data'),
			content,
			preview: 'No search results data',
		};
	}

	const data = bbResponse.data as LLMToolSearchWebResultData;
	const { results, summary, provider } = data;

	if (results.length === 0) {
		const content = LLMTool.TOOL_TAGS_BROWSER.base.box(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Query:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.code(`"${summary.query.original}"`)}
					</>,
				)}
				{summary.query.corrected && LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Corrected:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.code(`"${summary.query.corrected}"`)}
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Provider:')} {provider.name} ({provider.source})
					</>,
				)}
				{LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Time:')} {summary.searchTime}ms
					</>,
				)}
			</>,
			`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.status.warning}`,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search Web'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('no results'),
			content,
			preview: `No results for "${summary.query.original}"`,
		};
	}

	const content = LLMTool.TOOL_TAGS_BROWSER.base.box(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Query:')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.base.code(`"${summary.query.original}"`)}
				</>,
			)}
			{summary.query.corrected && summary.query.corrected !== summary.query.original &&
				LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Corrected:')}{' '}
						{LLMTool.TOOL_TAGS_BROWSER.base.code(`"${summary.query.corrected}"`)}
					</>,
				)}
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Results:')} {results.length}{' '}
					({summary.resultTypes.join(', ')})
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Provider:')} {provider.name} ({provider.source})
				</>,
			)}
			{LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Time:')} {summary.searchTime}ms
				</>,
			)}
			{summary.costMicroUsd && LLMTool.TOOL_TAGS_BROWSER.base.box(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('Cost:')} ${(summary.costMicroUsd / 1000000).toFixed(6)}
				</>,
			)}

			{/* Top results preview */}
			{results.slice(0, 3).map((result, index) => (
				LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>
						<div>
							<strong>{index + 1}. {result.title}</strong>
						</div>
						<div className='text-blue-600 dark:text-blue-400 text-sm'>
							{result.url}
						</div>
						<div className='text-sm'>
							<span className='px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700'>
								{result.type}
							</span>
							{result.description && (
								<span className='ml-2'>
									{result.description.slice(0, 100)}
									{result.description.length > 100 ? '...' : ''}
								</span>
							)}
						</div>
					</>,
				)
			))}

			{results.length > 3 && (
				LLMTool.TOOL_TAGS_BROWSER.base.box(
					<>... and {results.length - 3} more results</>,
				)
			)}
		</>,
		`${LLMTool.TOOL_STYLES_BROWSER.base.box} ${LLMTool.TOOL_STYLES_BROWSER.status.success}`,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search Web'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`${results.length} results found`),
		content,
		preview: `Found ${results.length} results for "${summary.query.original}"`,
	};
};
