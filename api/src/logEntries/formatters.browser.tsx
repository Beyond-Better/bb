/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import { marked } from 'marked';
import { escape as escapeHtmlEntities } from '@std/html';
import type { ConversationLogEntry } from 'shared/types.ts';
import type { LogEntryTitleData } from './types.ts';

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
	const contentArray = formatContentParts(logEntry.content);
	const formattedContent = contentArray
		.map((item) => {
			if (item.type === 'text') {
				// Process thinking and prompt tags for browser
				let processedContent = item.content;

				// Handle thinking blocks
				processedContent = processedContent.replace(/<thinking>([\s\S]*?)<\/thinking>/g, (_, p1) => {
					const processedInnerContent = p1.split('\n')
						.map((line: string) => line.trim())
						.join('\n');
					const lines = processedInnerContent.split('\n');
					const processedLines = lines.map((line: string, index: number) =>
						index === 0
							? '💭  <small>*thinking...*</small>' + escapeHtmlEntities(line)
							: escapeHtmlEntities(line)
					).join('\n');
					return '\n<div class="border-l-4 border-blue-300 dark:border-blue-700 rounded-r pt-1 pb-2 px-4 my-1 prose dark:prose-invert max-w-none">\n' +
						marked.parse(processedLines) +
						'</div>\n';
				});
				processedContent = processedContent.replace(/<thinking>/g, '');

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

	return formattedContent;
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
