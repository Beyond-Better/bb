/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import { marked } from 'marked';
import { escape as escapeHtmlEntities } from '@std/html';
import type { CollaborationLogEntry } from 'shared/types.ts';
import type { LogEntryTitleData } from 'api/logEntries/types.ts';
import { getApiBaseUrl } from 'api/utils/apiBaseUrl.ts';

// Configure marked options
marked.setOptions({
	pedantic: false,
	gfm: true,
	breaks: true,
});

// File icon mapping based on file extension
function getFileIcon(fileExt: string): string {
	const iconMap: Record<string, string> = {
		// Documents
		pdf: '📄',
		doc: '📄',
		docx: '📄',
		txt: '📄',
		rtf: '📄',
		// Spreadsheets
		xls: '📊',
		xlsx: '📊',
		csv: '📊',
		// Presentations
		ppt: '📊',
		pptx: '📊',
		// Images
		jpg: '🖼️',
		jpeg: '🖼️',
		png: '🖼️',
		gif: '🖼️',
		webp: '🖼️',
		svg: '🖼️',
		bmp: '🖼️',
		// Video
		mp4: '🎥',
		avi: '🎥',
		mkv: '🎥',
		mov: '🎥',
		wmv: '🎥',
		// Audio
		mp3: '🎵',
		wav: '🎵',
		flac: '🎵',
		aac: '🎵',
		// Archives
		zip: '📦',
		rar: '📦',
		'7z': '📦',
		tar: '📦',
		gz: '📦',
		// Code
		js: '💻',
		ts: '💻',
		py: '💻',
		java: '💻',
		cpp: '💻',
		c: '💻',
		html: '💻',
		css: '💻',
		// Default
		default: '📄',
	};

	return iconMap[fileExt] || iconMap.default;
}

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

export const formatLogEntryContent = (logEntry: CollaborationLogEntry, projectId?: string): string => {
	let formattedThinking = '';

	// Format the thinking content if it exists in the logEntry
	if (logEntry.thinking) {
		const processedThinking = logEntry.thinking.split('\n')
			.map((line: string) => line.trim())
			.join('\n');
		const lines = processedThinking.split('\n');
		const processedLines = lines.map((line: string) => escapeHtmlEntities(line)).join('\n');

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

		formattedThinking = '\n<div class="bb-thinking-container">\n' +
			'<div class="bb-thinking-header" role="button" aria-expanded="false" tabindex="0" onclick="globalThis.bbToggleThinking(this)" onkeydown="globalThis.bbHandleThinkingKeyDown(event, this)">' +
			'<div class="flex items-center">' +
			'<svg class="bb-thinking-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
			'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>' +
			'</svg>' +
			'<div class="bb-thinking-label">💭 Thinking</div>' +
			'</div>' +
			`<div class="bb-thinking-metadata" title="${tooltipContent}">${sizeIndicator} \u00b7 ${readingTimeDisplay}</div>` +
			'</div>\n' +
			'<div class="bb-thinking-content hidden">\n' +
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
					return '\n<div class="border-l-4 border-green-300 dark:border-green-700 rounded-r pt-1 pb-2 px-4 my-1 prose dark:prose-invert max-w-none">\n' +
						marked.parse(processedLines) +
						'</div>\n';
				});
				processedContent = processedContent.replace(/<prompt>/g, '');

				// Handle file references: ![name](bb+filesystem+uploads+file:./resourceId) and [name](bb+filesystem+uploads+file:./resourceId)
				// Get API base URL for dynamic URL generation
				const apiBaseUrl = getApiBaseUrl();

				processedContent = processedContent.replace(
					/!\[([^\]]*)\]\(bb\+filesystem\+uploads\+file:\.\/(.*?)\)/g,
					(match, altText, resourceId) => {
						const encodedResourceUrl = btoa(`bb+filesystem+uploads+file:./${resourceId}`);
						const currentProjectId = projectId || 'current';
						const thumbnailUrl = `${apiBaseUrl}/api/v1/resources/serve/${
							encodeURIComponent(encodedResourceUrl)
						}?thumbnail=true&projectId=${currentProjectId}`;
						const fullUrl = `${apiBaseUrl}/api/v1/resources/serve/${
							encodeURIComponent(encodedResourceUrl)
						}?projectId=${currentProjectId}`;

						return `<div class="bb-file-attachment bb-image-attachment inline-block my-2">
							<img src="${thumbnailUrl}" alt="${escapeHtmlEntities(altText)}" 
								 class="bb-image-thumbnail cursor-pointer max-w-xs max-h-48 rounded border shadow-sm hover:shadow-md transition-shadow" 
								 onclick="globalThis.bbShowImageModal('${fullUrl}', '${escapeHtmlEntities(altText)}')" 
								 title="Click to view full size" />
							<div class="bb-file-info text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">${
							escapeHtmlEntities(altText)
						}</div>
						</div>`;
					},
				);

				processedContent = processedContent.replace(
					/\[([^\]]*)\]\(bb\+filesystem\+uploads\+file:\.\/(.*?)\)/g,
					(match, linkText, resourceId) => {
						const encodedResourceUrl = btoa(`bb+filesystem+uploads+file:./${resourceId}`);
						const currentProjectId = projectId || 'current';
						const downloadUrl = `${apiBaseUrl}/api/v1/resources/serve/${
							encodeURIComponent(encodedResourceUrl)
						}?projectId=${currentProjectId}`;

						// Get file extension for icon
						const fileExt = resourceId.split('.').pop()?.toLowerCase() || 'file';
						const fileIcon = getFileIcon(fileExt);

						return `<div class="bb-file-attachment bb-download-attachment inline-flex items-center gap-2 p-2 border rounded bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
							<span class="bb-file-icon text-lg">${fileIcon}</span>
							<a href="${downloadUrl}" download class="bb-file-link text-blue-600 dark:text-blue-400 hover:underline">${
							escapeHtmlEntities(linkText)
						}</a>
							<span class="bb-download-icon text-gray-500 hover:text-gray-700 cursor-pointer" title="Download">↓</span>
						</div>`;
					},
				);

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
