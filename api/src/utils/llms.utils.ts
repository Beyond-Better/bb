import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { LLMMessageContentPart, LLMMessageContentPartThinkingBlock } from 'api/llms/llmMessage.ts';
import { ThinkingExtractor } from './thinkingExtractor.ts';

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
/**
 * Extract text content from an LLM response's answerContent array.
 * Combines all text parts and handles non-text content appropriately.
 * Excludes thinking content and removes <thinking> tags from text parts.
 * @param answerContent Array of message content parts from LLM response
 * @returns Combined text content from all parts, excluding thinking content
 */
export const extractTextFromContent = (answerContent: LLMMessageContentPart[]): string => {
	if (!Array.isArray(answerContent)) {
		throw new Error('answerContent must be an array');
	}

	let combinedText = '';
	for (const part of answerContent) {
		if (part && typeof part === 'object') {
			// Skip thinking blocks completely
			if (part.type === 'thinking') {
				continue;
			}
			
			if ('text' in part) {
				// Remove any <thinking> tags from text parts
				const cleanText = part.text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
				combinedText += cleanText;
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
	
	// Remove any remaining <thinking> tags that might be in the combined text
	combinedText = combinedText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
	
	return combinedText.trim();
};

/**
 * Extract thinking content from an LLM response's answerContent array.
 * Uses ThinkingExtractor to handle all supported thinking formats.
 * @param answerContent Array of message content parts from LLM response
 * @returns Extracted thinking content as a string
 */
export const extractThinkingFromContent = (answerContent: LLMMessageContentPart[]): string => {
	if (!Array.isArray(answerContent)) {
		throw new Error('answerContent must be an array');
	}

	// Use the ThinkingExtractor to handle all thinking formats consistently
	return ThinkingExtractor.extractFromContentParts(answerContent).thinking;
};

/**
 * Extract tool use content from an LLM response's answerContent array.
 * @param answerContent Array of message content parts from LLM response
 * @returns Tool use content as a string
 */
export const extractToolUseFromContent = (answerContent: LLMMessageContentPart[]): string => {
	if (!Array.isArray(answerContent)) {
		throw new Error('answerContent must be an array');
	}

	let combinedText = '';
	for (const part of answerContent) {
		if (part && typeof part === 'object') {
			// Handle tool_use content
			if (part.type === 'tool_use') {
				let toolUseStr = '';
				// id: toolCall.id,
				// name: toolCall.function.name,
				// input: JSON.parse(toolCall.function.arguments),
				toolUseStr = ``;
				try {
					if ('input' in part) {
						toolUseStr = `[${part.name} - ${part.id}] input: \n${JSON.stringify(part.input)}`;
					} else {
						toolUseStr = part;
					}
				} catch {
					// Keep default contentStr if JSON.stringify fails
				}
				// Try to coerce content to string if possible
				combinedText += toolUseStr;
			}
		}
	}
	return combinedText.trim();
};
