import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolSearchWebInput, LLMToolSearchWebResultData } from './types.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolSearchWebInput;

	const formattedContent = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Query:')} ${LLMTool.TOOL_STYLES_CONSOLE.base.code(`"${input.query}"`)}
        ${input.count ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Results:')} ${input.count}` : ''}
        ${input.country ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Country:')} ${input.country}` : ''}
        ${
		input.safesearch && input.safesearch !== 'moderate'
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Safe Search:')} ${input.safesearch}`
			: ''
	}
        ${input.result_filter ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Filter:')} ${input.result_filter}` : ''}
        ${input.freshness ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Freshness:')} ${input.freshness}` : ''}
        ${
		input.search_lang && input.search_lang !== 'en'
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Language:')} ${input.search_lang}`
			: ''
	}
        ${input.extra_snippets ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Extra Snippets:')} enabled` : ''}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Search Web'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Searching: "${input.query}"`),
		content: formattedContent,
		preview: `Searching web for "${input.query}"${input.count ? ` (${input.count} results)` : ''}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	if (typeof bbResponse === 'string') {
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search Web'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(bbResponse),
			preview: 'Web search failed',
		};
	}

	if (!bbResponse?.data) {
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search Web'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('no data'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.warning('No search results data available'),
			preview: 'No search results data',
		};
	}

	const data = bbResponse.data as LLMToolSearchWebResultData;
	const { results, summary, provider } = data;

	if (results.length === 0) {
		const formattedContent = stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Query:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.base.code(`"${summary.query.original}"`)
		}
            ${
			summary.query.corrected
				? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Corrected:')} ${
					LLMTool.TOOL_STYLES_CONSOLE.base.code(`"${summary.query.corrected}"`)
				}`
				: ''
		}
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Provider:')} ${provider.name} (${provider.source})
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Time:')} ${
			LLMTool.TOOL_STYLES_CONSOLE.status.success(summary.searchTime + 'ms')
		}
        `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search Web'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('no results'),
			content: formattedContent,
			preview: `No results for "${summary.query.original}"`,
		};
	}

	const topResults = results.slice(0, 3);
	const formattedContent = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Query:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.base.code(`"${summary.query.original}"`)
	}
        ${
		summary.query.corrected && summary.query.corrected !== summary.query.original
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Corrected:')} ${
				LLMTool.TOOL_STYLES_CONSOLE.base.code(`"${summary.query.corrected}"`)
			}`
			: ''
	}
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Results:')} ${results.length} (${summary.resultTypes.join(', ')})
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Provider:')} ${provider.name} (${provider.source})
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Time:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.status.success(summary.searchTime + 'ms')
	}
        ${
		summary.costMicroUsd
			? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Cost:')} $${(summary.costMicroUsd / 1000000).toFixed(6)}`
			: ''
	}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Top Results:')}
        ${
		topResults.map((result, index) => {
			const metaParts = [];
			if (result.metadata?.source) metaParts.push(`Source: ${result.metadata.source}`);
			if (result.metadata?.age) metaParts.push(`Age: ${result.metadata.age}`);
			if (result.metadata?.rating) metaParts.push(`Rating: ${result.metadata.rating}`);
			if (result.metadata?.breaking) metaParts.push('Breaking');

			return stripIndents`
                ${index + 1}. ${LLMTool.TOOL_STYLES_CONSOLE.content.title('', result.title)}
                   ${LLMTool.TOOL_STYLES_CONSOLE.content.url(result.url)}
                   ${LLMTool.TOOL_STYLES_CONSOLE.status.info(`[${result.type}]`)}${
				result.description
					? ` ${result.description.slice(0, 100)}${result.description.length > 100 ? '...' : ''}`
					: ''
			}
                   ${metaParts.length > 0 ? LLMTool.TOOL_STYLES_CONSOLE.base.value(metaParts.join(' | ')) : ''}
            `;
		}).join('\n')
	}
        ${
		results.length > 3
			? `\n   ${LLMTool.TOOL_STYLES_CONSOLE.base.value(`... and ${results.length - 3} more results`)}`
			: ''
	}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search Web'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${results.length} results found`),
		content: formattedContent,
		preview: `Found ${results.length} results for "${summary.query.original}"`,
	};
};
