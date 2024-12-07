import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart } from 'api/llms/llmMessage.ts';

export const getContentArrayFromToolResult = (toolRunResultContent: LLMToolRunResultContent): string[] => {
	if (Array.isArray(toolRunResultContent)) {
		return toolRunResultContent.map((part) => getTextContent(part));
	} else if (typeof toolRunResultContent !== 'string') {
		return [getTextContent(toolRunResultContent)];
	} else {
		return [toolRunResultContent];
	}
};

export const getContentFromToolResult = (toolRunResultContent: LLMToolRunResultContent): string => {
	return getContentArrayFromToolResult(toolRunResultContent).join('\n');
};

export const getTextContent = (content: LLMMessageContentPart): string => {
	if ('text' in content) {
		return content.text;
	} else if ('image' in content) {
		return '[Image content]';
	} else if ('tool_use_id' in content) {
		return `[Tool result: ${content.tool_use_id}]`;
	}
	return '[Unknown content]';
};

/**
 * Extract text content from an LLM response's answerContent array.
 * Combines all text parts and handles non-text content appropriately.
 * @param answerContent Array of message content parts from LLM response
 * @returns Combined text content from all parts
 */
export const extractTextFromContent = (answerContent: LLMMessageContentPart[]): string => {
	if (!Array.isArray(answerContent)) {
		throw new Error('answerContent must be an array');
	}

	let combinedText = '';
	for (const part of answerContent) {
		if (part && typeof part === 'object') {
			if ('text' in part) {
				combinedText += part.text;
			} else {
				// Handle non-text content
				const contentType = part.type || 'unknown';
				let contentStr = contentType === 'tool_use' ? '' : `[${contentType} content]`;

				// Try to coerce content to string if possible
				try {
					if ('content' in part) {
						contentStr = `[${contentType} content: ${JSON.stringify(part.content)}]`;
					}
				} catch {
					// Keep default contentStr if JSON.stringify fails
				}
				combinedText += contentStr;
			}
		}
	}
	return combinedText.trim();
};
