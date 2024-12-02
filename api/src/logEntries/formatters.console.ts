import type { ConversationLogEntry } from 'shared/types.ts';
import type { LogEntryTitleData } from './types.ts';

export const formatLogEntryTitle = (titleData: LogEntryTitleData): string => {
	return `${titleData.title}${titleData.subtitle ? ` (${titleData.subtitle})` : ''}`;
};

export const formatLogEntryPreview = (preview: string): string => {
	return preview;
};

export const formatLogEntryContent = (logEntry: ConversationLogEntry): string => {
	const contentArray: Array<{ type: string; content: string }> = formatContentParts(logEntry.content);
	return contentArray
		.map((item) => {
			if (item.type === 'text') {
				// Process thinking and prompt tags for console
				let processedContent = item.content;

				// Handle thinking blocks
				processedContent = processedContent.replace(/<thinking>([\s\S]*?)<\/thinking>/g, (_, p1) => {
					const lines = p1.split('\n').map((line: string) => line.trim());
					const firstLine = '💭 *thinking...* ' + lines[0];
					return [firstLine, ...lines.slice(1)].join('\n');
				});
				processedContent = processedContent.replace(/<thinking>/g, '');

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
