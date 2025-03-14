import type { ConversationLogEntry } from 'shared/types.ts';
import type { LogEntryTitleData } from './types.ts';

export const formatLogEntryTitle = (titleData: LogEntryTitleData): string => {
	return `${titleData.title}${titleData.subtitle ? ` (${titleData.subtitle})` : ''}`;
};

export const formatLogEntryPreview = (preview: string): string => {
	return preview;
};

export const formatLogEntryContent = (logEntry: ConversationLogEntry): string => {
	// Format the main content
	const contentArray: Array<{ type: string; content: string }> = formatContentParts(logEntry.content);
	const mainContent = contentArray
		.map((item) => {
			if (item.type === 'text') {
				// Process prompt tags for console
				let processedContent = item.content;

				// Handle prompt blocks
				processedContent = processedContent.replace(/<prompt>([\s\S]*?)<\/prompt>/g, (_, p1) => {
					const lines = p1.split('\n').map((line: string) => line.trim());
					const firstLine = '🤖 *prompt...* ' + lines[0];
					return [firstLine, ...lines.slice(1)].join('\n');
				});
				processedContent = processedContent.replace(/<prompt>/g, '');

				// Remove any remaining HTML tags
				return processedContent.replace(/<[^>]+>/g, '');
			} else if (item.type === 'image') {
				return '[Embedded Image]';
			}
			return '';
		})
		.join('\n');
	
	// Format the thinking content if it exists
	if (logEntry.thinking) {
		const lines = logEntry.thinking.split('\n').map((line: string) => line.trim());
		const firstLine = '💭 *thinking...* \n' + lines[0];
		const thinkingContent = [firstLine, ...lines.slice(1)].join('\n');
		return thinkingContent + '\n\n' + mainContent;
	}
	
	return mainContent;
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
