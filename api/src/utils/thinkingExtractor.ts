/**
 * ThinkingExtractor - Utility for extracting thinking content from various formats
 *
 * Supports extracting thinking from:
 * 1. Structured LLMMessageContentPartThinkingBlock - For models that natively return thinking blocks
 * 2. <thinking> Tags - For models that embed thinking in HTML-like tags
 * 3. "Thinking:" Prefix - Legacy format for backward compatibility
 * 4. Implicit Tool Thinking - Text content parts that serve as thinking for tool use
 */

import type { LLMMessageContentPart, LLMMessageContentPartThinkingBlock } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntry, ConversationLogEntryContent } from 'api/storage/conversationLogger.ts';
import type { LLMProviderMessageResponse } from 'api/types.ts';

/**
 * Utility class for extracting and normalizing thinking content from various formats.
 */
export class ThinkingExtractor {
	/**
	 * Extract thinking from any supported format.
	 *
	 * @param content - The content to extract thinking from
	 * @returns Object containing extracted thinking and content with thinking removed
	 */
	static extract(content: string | LLMMessageContentPart[] | ConversationLogEntryContent): {
		thinking: string;
		content: string | LLMMessageContentPart[] | ConversationLogEntryContent;
	} {
		// Handle string content
		if (typeof content === 'string') {
			return this.extractFromString(content);
		}

		// Handle array of LLMMessageContentPart
		if (Array.isArray(content)) {
			return this.extractFromContentParts(content);
		}

		// Handle other ConversationLogEntryContent types (like tool inputs, tool results)
		// For now, these don't typically contain thinking content
		return { thinking: '', content };
	}

	/**
	 * Extract thinking from an LLM provider message response
	 *
	 * @param response - The LLM provider response
	 * @returns The extracted thinking content
	 */
	static extractFromResponse(response: LLMProviderMessageResponse): string {
		if (!response.answerContent || !Array.isArray(response.answerContent)) {
			return '';
		}

		// Try to extract from the answer content parts
		const { thinking } = this.extractFromContentParts(response.answerContent);

		// If no thinking was found and there is tool thinking, use that
		if (!thinking && response.toolThinking) {
			return response.toolThinking;
		}

		// If no thinking was found, check if this was a tool response
		if (!thinking && response.toolsUsed && response.toolsUsed.length > 0) {
			// Combine thinking from all tool uses
			return response.toolsUsed
				.map((tool) => tool.toolThinking || '')
				.filter((thinking) => thinking.length > 0)
				.join('\n\n');
		}

		return thinking;
	}

	/**
	 * Extract thinking from a string using regex patterns
	 *
	 * @param content - The string content to extract thinking from
	 * @returns Object with extracted thinking and clean content
	 */
	private static extractFromString(content: string): {
		thinking: string;
		content: string;
	} {
		let thinking = '';
		let cleanContent = content;

		// Extract <thinking> tags
		const thinkingTagRegex = /<thinking>([\s\S]*?)<\/thinking>/gs;
		let thinkingMatch;
		let foundThinkingTags = false;

		while ((thinkingMatch = thinkingTagRegex.exec(content)) !== null) {
			foundThinkingTags = true;
			thinking += thinkingMatch[1].trim() + '\n';
			// Remove the thinking tag from content
			cleanContent = cleanContent.replace(thinkingMatch[0], '');
		}

		// If no <thinking> tags found, try "Thinking:" prefix
		if (!foundThinkingTags) {
			const thinkingPrefixRegex = /Thinking:([\s\S]*?)(?=(Human:|Assistant:|$))/s;
			thinkingMatch = thinkingPrefixRegex.exec(content);
			if (thinkingMatch) {
				thinking = thinkingMatch[1].trim();
				// For "Thinking:" format, we don't remove it from content as it may be part of a legacy format
			}
		}

		return {
			thinking: thinking.trim(),
			content: cleanContent.trim(),
		};
	}

	/**
	 * Extract thinking from LLMMessageContentPart array
	 *
	 * @param parts - Array of content parts to extract thinking from
	 * @returns Object with extracted thinking and clean content parts
	 */
	private static extractFromContentParts(parts: LLMMessageContentPart[]): {
		thinking: string;
		content: LLMMessageContentPart[];
	} {
		let thinking = '';
		const cleanParts: LLMMessageContentPart[] = [];
		const thinkingParts: LLMMessageContentPart[] = [];

		for (const part of parts) {
			// Check for dedicated thinking blocks
			if (part.type === 'thinking') {
				thinking += (part as LLMMessageContentPartThinkingBlock).thinking + '\n';
				thinkingParts.push(part);
			} // Extract thinking from text parts that might contain <thinking> tags
			else if (part.type === 'text' && 'text' in part) {
				const { thinking: extractedThinking, content: extractedContent } = this.extractFromString(part.text);

				if (extractedThinking) {
					thinking += extractedThinking + '\n';

					// If the text part had thinking tags, update the text to remove them
					if (extractedContent !== part.text) {
						cleanParts.push({
							...part,
							text: extractedContent,
						});
						continue;
					}
				}

				cleanParts.push(part);
			} // Copy other parts as-is
			else {
				cleanParts.push(part);
			}
		}

		return {
			thinking: thinking.trim(),
			content: cleanParts.filter((part) => !thinkingParts.includes(part)),
		};
	}

	/**
	 * Apply extracted thinking to a ConversationLogEntry
	 *
	 * @param logEntry - The log entry to process
	 * @returns Updated log entry with extracted thinking
	 */
	static applyToLogEntry(logEntry: ConversationLogEntry): ConversationLogEntry {
		// Skip if thinking is already present
		if (logEntry.thinking) {
			return logEntry;
		}

		const { thinking, content } = this.extract(logEntry.content);

		if (!thinking) {
			return logEntry;
		}

		return {
			...logEntry,
			thinking,
			content,
		};
	}

	/**
	 * Update controller extractor methods to use this utility
	 *
	 * This can be used to replace the extractThinkingContent method in baseController.ts
	 * and the regex patterns in agentController.ts and orchestratorController.ts
	 *
	 * @param response - The LLM provider response
	 * @returns The extracted thinking content
	 */
	static extractThinkingForController(response: LLMProviderMessageResponse): string {
		return this.extractFromResponse(response);
	}
}
