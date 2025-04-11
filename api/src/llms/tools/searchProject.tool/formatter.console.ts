import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolSearchProjectInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolSearchProjectInput;
	const { contentPattern, caseSensitive, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } = input;

	const criteria = [];
	if (contentPattern) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content pattern:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.regex(contentPattern)}, 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(caseSensitive ?? false, 'case-sensitive/case-insensitive')}`);
	}
	if (filePattern) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('File pattern:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePattern)}`);
	}
	if (dateAfter) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Modified after:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.date(dateAfter)}`);
	}
	if (dateBefore) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Modified before:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.date(dateBefore)}`);
	}
	if (sizeMin !== undefined) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Minimum size:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.size(sizeMin)}`);
	}
	if (sizeMax !== undefined) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Maximum size:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.size(sizeMax)}`);
	}

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Search Project'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Searching project files...'),
		content: stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Search Parameters')}
            ${criteria.map((c) => LLMTool.TOOL_STYLES_CONSOLE.base.listItem(c)).join('\n')}`,
		preview: 'Searching project files with specified criteria',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent;
	const lines = getContentFromToolResult(toolResult).split('\n');
	const fileList = (() => {
		const startIndex = lines.findIndex((line) => line.includes('<files>'));
		const endIndex = lines.findIndex((line) => line.includes('</files>'));
		if (startIndex === -1 || endIndex === -1) {
			return [];
		}
		return lines.slice(startIndex + 1, endIndex);
	})();

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search Project'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(String(bbResponse)),
		content: stripIndents`
            ${
			fileList.map((file) =>
				LLMTool.TOOL_STYLES_CONSOLE.base.listItem(
					LLMTool.TOOL_STYLES_CONSOLE.content.filename(file),
				)
			).join('\n')
		}`,
		preview: `Found ${fileList.length} files`,
	};
};
