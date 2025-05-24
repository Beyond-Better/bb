/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolSearchProjectInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolSearchProjectInput;
	const { contentPattern, caseSensitive, resourcePattern, dateAfter, dateBefore, sizeMin, sizeMax } = input;

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
	if (resourcePattern) {
		criteria.push(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Resource pattern:')}{' '}
				{LLMTool.TOOL_TAGS_BROWSER.content.filename(resourcePattern)}
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
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Searching project resources...'),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Search Parameters')}
				{LLMTool.TOOL_TAGS_BROWSER.base.list(criteria)}
			</>,
		),
		preview: 'Searching project resources with specified criteria',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent;
	const lines = getContentFromToolResult(toolResult).split('\n');
	const resourceList = (() => {
		const startIndex = lines.findIndex((line) => line.includes('<resources>'));
		const endIndex = lines.findIndex((line) => line.includes('</resources>'));
		if (startIndex === -1 || endIndex === -1) {
			return [];
		}
		return lines.slice(startIndex + 1, endIndex);
	})();

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search Project'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(String(bbResponse)),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Resources Found')}
				{resourceList.length > 0 && (
					LLMTool.TOOL_TAGS_BROWSER.base.list(
						resourceList.map((resource) => LLMTool.TOOL_TAGS_BROWSER.content.filename(resource)),
					)
				)}
			</>,
		),
		preview: `Found ${resourceList.length} resources`,
	};
};
