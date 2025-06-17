import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolFindResourcesInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolFindResourcesInput;
	const { contentPattern, caseSensitive, resourcePattern, dateAfter, dateBefore, sizeMin, sizeMax } = input;

	const criteria = [];
	if (contentPattern) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content pattern:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.regex(contentPattern)}, 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(caseSensitive ?? false, 'case-sensitive/case-insensitive')}`);
	}
	if (resourcePattern) {
		criteria.push(stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource pattern:')} 
            ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePattern)}`);
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
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Find Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Searching project resources...'),
		content: stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Search Parameters')}
            ${criteria.map((c) => LLMTool.TOOL_STYLES_CONSOLE.base.listItem(c)).join('\n')}`,
		preview: 'Searching project resources with specified criteria',
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent;
	const content = getContentFromToolResult(toolResult);

	// Try to parse enhanced content format first
	const enhancedData = tryParseEnhancedContent(content);
	if (enhancedData) {
		return formatEnhancedSearchResults(enhancedData, bbResponse);
	}

	// Fall back to simple resource list format
	return formatSimpleSearchResults(content, bbResponse);
};

// Helper function to detect and parse enhanced content format
function tryParseEnhancedContent(content: string): any {
	// Look for enhanced data markers in the content
	// This will be updated when the tool starts outputting enhanced format
	const enhancedMatch = content.match(/<enhanced-results>([\s\S]*?)<\/enhanced-results>/);
	if (enhancedMatch) {
		try {
			return JSON.parse(enhancedMatch[1]);
		} catch (error) {
			console.warn('Failed to parse enhanced search results:', error);
			return null;
		}
	}
	return null;
}

// Format enhanced search results with content matches
function formatEnhancedSearchResults(enhancedData: any, bbResponse: any) {
	const { matches } = enhancedData;
	const totalMatches = matches.reduce((sum: number, match: any) => sum + (match.contentMatches?.length || 0), 0);

	const enhancedContent = matches.map((match: any) => {
		const fileHeader = `${LLMTool.TOOL_STYLES_CONSOLE.content.icon('📁')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.filename(match.resourcePath)
		}`;

		if (!match.contentMatches || match.contentMatches.length === 0) {
			return fileHeader;
		}

		const contentLines = match.contentMatches.map((contentMatch: any) => {
			const lines = [];

			// Add context before
			contentMatch.contextBefore.forEach((line: string, idx: number) => {
				const lineNum = contentMatch.lineNumber - contentMatch.contextBefore.length + idx;
				lines.push(
					`   ${String(lineNum).padStart(3, ' ')}│ ${LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(line)}`,
				);
			});

			// Add matching line with highlight
			const highlightedLine = highlightMatch(
				contentMatch.content,
				contentMatch.matchStart,
				contentMatch.matchEnd,
			);
			lines.push(` → ${String(contentMatch.lineNumber).padStart(3, ' ')}│ ${highlightedLine}`);

			// Add context after
			contentMatch.contextAfter.forEach((line: string, idx: number) => {
				const lineNum = contentMatch.lineNumber + 1 + idx;
				lines.push(
					`   ${String(lineNum).padStart(3, ' ')}│ ${LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(line)}`,
				);
			});

			return lines.join('\n');
		}).join('\n\n');

		return `${fileHeader}\n${contentLines}`;
	}).join('\n\n');

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Find Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(String(bbResponse)),
		content: enhancedContent,
		preview: `Found ${matches.length} files with ${totalMatches} matches`,
	};
}

// Format simple search results (backward compatibility)
function formatSimpleSearchResults(content: string, bbResponse: any) {
	const lines = content.split('\n');
	const resourceList = (() => {
		const startIndex = lines.findIndex((line) => line.includes('<resources>'));
		const endIndex = lines.findIndex((line) => line.includes('</resources>'));
		if (startIndex === -1 || endIndex === -1) {
			return [];
		}
		return lines.slice(startIndex + 1, endIndex);
	})();

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Find Resources'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(String(bbResponse)),
		content: stripIndents`
            ${
			resourceList.map((resource) =>
				LLMTool.TOOL_STYLES_CONSOLE.base.listItem(
					LLMTool.TOOL_STYLES_CONSOLE.content.filename(resource),
				)
			).join('\n')
		}`,
		preview: `Found ${resourceList.length} resources`,
	};
}

// Helper function to highlight matches within content for console
function highlightMatch(content: string, matchStart: number, matchEnd: number): string {
	const before = content.substring(0, matchStart);
	const match = content.substring(matchStart, matchEnd);
	const after = content.substring(matchEnd);

	return `${before}${LLMTool.TOOL_STYLES_CONSOLE.content.badge.warning(match)}${after}`;
}
