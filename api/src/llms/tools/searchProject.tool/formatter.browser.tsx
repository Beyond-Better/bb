/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolSearchProjectInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolSearchProjectInput;
	const { contentPattern, caseSensitive, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } = input;

	const criteria = [];
	if (contentPattern) {
		criteria.push(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Content pattern:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.regex(contentPattern)}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.boolean(caseSensitive ?? false, 'case-sensitive/case-insensitive')}
			</>,
		);
	}
	if (filePattern) {
		criteria.push(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('File pattern:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.filename(filePattern)}
			</>,
		);
	}
	if (dateAfter) {
		criteria.push(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Modified after:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.date(dateAfter)}
			</>,
		);
	}
	if (dateBefore) {
		criteria.push(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Modified before:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.date(dateBefore)}
			</>,
		);
	}
	if (sizeMin !== undefined) {
		criteria.push(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Minimum size:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.size(sizeMin)}
			</>,
		);
	}
	if (sizeMax !== undefined) {
		criteria.push(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Maximum size:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.size(sizeMax)}
			</>,
		);
	}

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Search Project'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Searching project files...'),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Search Parameters')}
				{LLMTool.TOOL_TAGS_BROWSER.base.list(criteria)}
			</>,
		),
		preview: 'Searching project files with specified criteria',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent;
	const lines = getContentFromToolResult(toolResult).split('\n');
	const fileList = lines.slice(
		lines.findIndex((line) => line.includes('<files>')) + 1,
		lines.findIndex((line) => line.includes('</files>')),
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search Project'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(String(bbResponse)),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Files Found')}
				{fileList.length > 0 && (
					LLMTool.TOOL_TAGS_BROWSER.base.list(
						fileList.map((file) => LLMTool.TOOL_TAGS_BROWSER.content.filename(file)),
					)
				)}
			</>,
		),
		preview: `Found ${fileList.length} files`,
	};
};
