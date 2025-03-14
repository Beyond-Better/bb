/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import { marked } from 'marked';
import { escape as escapeHtmlEntities } from '@std/html';
import type { ConversationLogEntry } from 'shared/types.ts';
import type { LogEntryTitleData } from 'api/logEntries/types.ts';

// Configure marked options
marked.setOptions({
	pedantic: false,
	gfm: true,
	breaks: true,
});

export const formatLogEntryTitle = (titleData: LogEntryTitleData): string => {
	const title = escapeHtmlEntities(titleData.title);
	const subtitle = titleData.subtitle ? escapeHtmlEntities(titleData.subtitle) : '';

	return `
    <div class="log-entry-left">
      <span class="log-entry-title">${title}</span>
      ${subtitle ? `<span class="log-entry-subtitle">${subtitle}</span>` : ''}
    </div>
  `.trim();
};

export const formatLogEntryPreview = (preview: string): string => {
	const escapedPreview = escapeHtmlEntities(preview);
	return `
    <div class="log-entry-right">
      <div class="log-entry-preview">${escapedPreview}</div>
    </div>
  `.trim();
};

export const formatLogEntryContent = (logEntry: ConversationLogEntry): string => {
	let formattedThinking = '';
	
	// Format the thinking content if it exists in the logEntry
	if (logEntry.thinking) {
		const processedThinking = logEntry.thinking.split('\n')
			.map((line: string) => line.trim())
			.join('\n');
		const lines = processedThinking.split('\n');
		const processedLines = lines.map((line: string) => 
			escapeHtmlEntities(line)
		).join('\n');
		
		// Calculate metrics for the thinking content
		const wordCount = processedThinking.split(/\s+/).filter(Boolean).length;
		
		// Calculate reading time (more granular for short content)
		let readingTimeDisplay = '';
		const readingTimeSeconds = (wordCount / 200) * 60; // 200 words per minute = 3.33 words per second
		
		if (readingTimeSeconds < 60) {
			// For content under 1 minute, display in 10-second intervals
			const secondsRounded = Math.max(10, Math.round(readingTimeSeconds / 10) * 10); // Round to nearest 10 seconds, minimum 10 seconds
			readingTimeDisplay = `~${secondsRounded} sec read`;
		} else {
			// For longer content, display in minutes
			const readingTimeMinutes = Math.round(readingTimeSeconds / 60);
			readingTimeDisplay = `~${readingTimeMinutes} min read`;
		}
		
		// Determine qualitative size indicator with descriptive context
		let sizeIndicator = '';
		if (wordCount < 50) sizeIndicator = 'Brief thought process';
		else if (wordCount < 200) sizeIndicator = 'Standard thought process';
		else sizeIndicator = 'Detailed thought process';
		
		// Create tooltip with detailed metrics
		const tooltipContent = `${wordCount} words \u00b7 ${readingTimeDisplay}`;
		
		formattedThinking = '\n<div class="bb-thinking-container mb-6">\n' +
			'<div class="bb-thinking-header flex items-center justify-between cursor-pointer p-2 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-300 dark:border-blue-700 rounded-tr" role="button" aria-expanded="false" tabindex="0" onclick="globalThis.bbToggleThinking(this)" onkeydown="globalThis.bbHandleThinkingKeyDown(event, this)">' +
			'<div class="flex items-center">' +
			'<svg class="bb-thinking-icon w-4 h-4 mr-2 transform transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
			'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>' +
			'</svg>' +
			'<div class="text-sm font-medium text-blue-700 dark:text-blue-300">💭 Thinking</div>' +
			'</div>' +
			`<div class="text-xs text-blue-600 dark:text-blue-400 hover:underline" title="${tooltipContent}">${sizeIndicator} \u00b7 ${readingTimeDisplay}</div>` +
			'</div>\n' +
			'<div class="bb-thinking-content hidden border-l-4 border-blue-300 dark:border-blue-700 rounded-br pt-1 pb-2 px-4 prose dark:prose-invert max-w-none">\n' +
			marked.parse(processedLines) +
			'</div>\n' +
			'</div>\n';
	}

	// Format the main content
	const contentArray = formatContentParts(logEntry.content);
	const formattedContent = contentArray
		.map((item) => {
			if (item.type === 'text') {
				let processedContent = item.content;

				// Handle prompt blocks
				processedContent = processedContent.replace(/<prompt>([\s\S]*?)<\/prompt>/g, (_, p1) => {
					const processedInnerContent = p1.split('\n')
						.map((line: string) => line.trim())
						.join('\n');
					const lines = processedInnerContent.split('\n');
					const processedLines = lines.map((line: string, index: number) =>
						index === 0
							? '🤖  <small>*prompt...*</small>\n' + escapeHtmlEntities(line)
							: escapeHtmlEntities(line)
					).join('\n');
					return '\n<div class="border-l-4 border-blue-300 dark:border-blue-700 rounded-r pt-1 pb-2 px-4 my-1 prose dark:prose-invert max-w-none">\n' +
						marked.parse(processedLines) +
						'</div>\n';
				});
				processedContent = processedContent.replace(/<prompt>/g, '');

				// Parse remaining content as markdown
				return marked.parse(processedContent);
			} else if (item.type === 'image') {
				const source = JSON.parse(item.content);
				return `<img src="data:${source.media_type};base64,${source.data}" alt="Embedded Image" />`;
			}
			return '';
		})
		.join('');

	// Combine the content and thinking
	return formattedThinking + formattedContent;
};

function formatContentParts(
	content: unknown,
): Array<{ type: string; content: string }> {
	if (typeof content === 'string') {
		return [{ type: 'text', content }];
	} else if (Array.isArray(content)) {
		const flatContent = content.flatMap((part) => {
			if (part.type === 'text' && part.text) {
				return formatContentString(part.text).map((line) => ({ type: 'text', content: line }));
			} else if (part.type === 'image' && part.source) {
				return [{ type: 'image', content: JSON.stringify(part.source) }];
			} else if (part.type === 'tool_result' && Array.isArray(part.content)) {
				return formatContentParts(part.content);
			}
			return [];
		});
		return flatContent;
	}
	return [];
}

function formatContentString(content: string): string[] {
	return content
		.replace(/<bb>.*?<\/bb>/gs, '')
		.split('\n')
		.map((line) => line.trim());
}
