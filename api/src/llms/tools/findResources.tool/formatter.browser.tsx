/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolFindResourcesInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolFindResourcesInput;
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
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Find Resources'),
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
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResults, bbResponse } = resultContent;
	const content = getContentFromToolResult(toolResults);

	// Check if bbResponse is structured (new format)
	if (typeof bbResponse === 'object' && bbResponse && 'data' in bbResponse) {
		return formatStructuredSearchResults(bbResponse as any, content);
	}

	// Try to parse enhanced content format first (legacy)
	const enhancedData = tryParseEnhancedContent(content);
	if (enhancedData) {
		return formatEnhancedSearchResults(enhancedData, bbResponse);
	}

	// Fall back to simple resource list format (legacy)
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

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Find Resources'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(String(bbResponse)),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Enhanced Search Results')}
				<div className='space-y-4 mt-4'>
					{matches.map((match: any, index: number) => (
						<div key={index} className='border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
							<div className='flex items-center gap-2 mb-3'>
								{LLMTool.TOOL_TAGS_BROWSER.content.icon('📁')}
								{LLMTool.TOOL_TAGS_BROWSER.content.filename(match.resourcePath)}
								{match.contentMatches && (
									<span className='ml-auto px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs rounded-full'>
										{match.contentMatches.length}{' '}
										match{match.contentMatches.length !== 1 ? 'es' : ''}
									</span>
								)}
							</div>
							{match.contentMatches && (
								<div className='space-y-3'>
									{match.contentMatches.map((contentMatch: any, contentIndex: number) => (
										<div
											key={contentIndex}
											className='bg-gray-50 dark:bg-gray-800/50 rounded-md p-3'
										>
											<div className='flex items-center gap-2 mb-2'>
												<span className='font-mono text-sm text-gray-500 dark:text-gray-400 min-w-[3rem] text-right'>
													{contentMatch.lineNumber}
												</span>
												<span className='text-blue-600 dark:text-blue-400'>→</span>
											</div>
											<div className='font-mono text-sm space-y-1'>
												{/* Context before */}
												{contentMatch.contextBefore.map((line: string, idx: number) => (
													<div
														key={`before-${idx}`}
														className='text-gray-500 dark:text-gray-400 pl-16'
													>
														{line}
													</div>
												))}
												{/* Matching line */}
												<div className='bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-gray-100 px-2 py-1 rounded pl-16'>
													{highlightMatch(
														contentMatch.content,
														contentMatch.matchStart,
														contentMatch.matchEnd,
													)}
												</div>
												{/* Context after */}
												{contentMatch.contextAfter.map((line: string, idx: number) => (
													<div
														key={`after-${idx}`}
														className='text-gray-500 dark:text-gray-400 pl-16'
													>
														{line}
													</div>
												))}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			</>,
		),
		preview: `Found ${matches.length} files with ${totalMatches} matches`,
	};
}

// Format simple search results (backward compatibility)
function formatSimpleSearchResults(content: string, bbResponse: any) {
	// Check for error messages in the content
	const errorMatch = content.match(/Invalid regular expression: ([^\n]+)/);
	if (errorMatch) {
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Find Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(String(bbResponse)),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				<div className='flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
					<span className='text-red-600 dark:text-red-400 text-xl'>⚠️</span>
					<div>
						<span className='font-medium text-red-800 dark:text-red-300'>Error:</span>
						<span className='ml-2 text-red-700 dark:text-red-400 font-mono'>{errorMatch[1]}</span>
					</div>
				</div>,
			),
			preview: 'Search failed due to invalid pattern',
		};
	}

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
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Find Resources'),
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
}

// Format structured search results (new format)
function formatStructuredSearchResults(bbResponse: any, toolContent: string) {
	const { data } = bbResponse;
	const { resources, matches, errorMessage, searchCriteria, dataSources, pagination } = data;

	if (errorMessage) {
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Find Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Search failed'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				<div className='flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
					<span className='text-red-600 dark:text-red-400 text-xl'>⚠️</span>
					<div>
						<span className='font-medium text-red-800 dark:text-red-300'>Error:</span>
						<span className='ml-2 text-red-700 dark:text-red-400'>{errorMessage}</span>
					</div>
				</div>,
			),
			preview: 'Search failed due to error',
		};
	}

	const totalMatches = matches.reduce((sum: number, match: any) => sum + (match.contentMatches?.length || 0), 0);
	const hasContentMatches = matches.length > 0 && matches.some((m: any) => m.contentMatches);

	if (hasContentMatches) {
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Find Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
				`Found ${resources.length} resources with ${totalMatches} matches`,
			),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Enhanced Search Results')}
					<div className='space-y-4 mt-4'>
						{matches.map((match: any, index: number) => (
							<div key={index} className='border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
								<div className='flex items-center gap-2 mb-3'>
									{LLMTool.TOOL_TAGS_BROWSER.content.icon('📁')}
									{LLMTool.TOOL_TAGS_BROWSER.content.filename(match.resourcePath)}
									{match.contentMatches && (
										<span className='ml-auto px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs rounded-full'>
											{match.contentMatches.length}{' '}
											match{match.contentMatches.length !== 1 ? 'es' : ''}
										</span>
									)}
								</div>
								{match.contentMatches && (
									<div className='space-y-3'>
										{match.contentMatches.map((contentMatch: any, contentIndex: number) => (
											<div
												key={contentIndex}
												className='bg-gray-50 dark:bg-gray-800/50 rounded-md p-3'
											>
												<div className='flex items-center gap-2 mb-2'>
													<span className='font-mono text-sm text-gray-500 dark:text-gray-400 min-w-[3rem] text-right'>
														{contentMatch.lineNumber}
													</span>
													<span className='text-blue-600 dark:text-blue-400'>→</span>
												</div>
												<div className='font-mono text-sm space-y-1'>
													{/* Context before */}
													{contentMatch.contextBefore.map((line: string, idx: number) => (
														<div
															key={`before-${idx}`}
															className='text-gray-500 dark:text-gray-400 pl-16'
														>
															{line}
														</div>
													))}
													{/* Matching line */}
													<div className='bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-gray-100 px-2 py-1 rounded pl-16'>
														{highlightMatch(
															contentMatch.content,
															contentMatch.matchStart,
															contentMatch.matchEnd,
														)}
													</div>
													{/* Context after */}
													{contentMatch.contextAfter.map((line: string, idx: number) => (
														<div
															key={`after-${idx}`}
															className='text-gray-500 dark:text-gray-400 pl-16'
														>
															{line}
														</div>
													))}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						))}
						{pagination?.hasMore && (
							<div className='mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
								<span className='text-blue-700 dark:text-blue-300 text-sm'>
									More results available (page size: {pagination.pageSize})
								</span>
							</div>
						)}
					</div>
				</>,
			),
			preview: `Found ${resources.length} files with ${totalMatches} matches`,
		};
	} else {
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Find Resources'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`Found ${resources.length} resources`),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(
				<>
					{LLMTool.TOOL_TAGS_BROWSER.content.status('completed', 'Resources Found')}
					{resources.length > 0 && (
						LLMTool.TOOL_TAGS_BROWSER.base.list(
							resources.map((resource: string) => LLMTool.TOOL_TAGS_BROWSER.content.filename(resource)),
						)
					)}
					{dataSources.length > 0 && (
						<div className='mt-4 text-sm text-gray-600 dark:text-gray-400'>
							Searched: {dataSources.map((ds: any) => ds.dsConnectionName).join(', ')}
						</div>
					)}
					{pagination?.hasMore && (
						<div className='mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
							<span className='text-blue-700 dark:text-blue-300 text-sm'>
								More results available (page size: {pagination.pageSize})
							</span>
						</div>
					)}
				</>,
			),
			preview: `Found ${resources.length} resources`,
		};
	}
}

// Helper function to highlight matches within content
function highlightMatch(content: string, matchStart: number, matchEnd: number) {
	const before = content.substring(0, matchStart);
	const match = content.substring(matchStart, matchEnd);
	const after = content.substring(matchEnd);

	return (
		<>
			{before}
			<mark className='bg-yellow-300 dark:bg-yellow-600/50 px-1 rounded'>{match}</mark>
			{after}
		</>
	);
}
