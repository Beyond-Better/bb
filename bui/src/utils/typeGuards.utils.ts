import type {
	ConversationContinue,
	ConversationLogDataEntry,
	ConversationResponse,
	ConversationStart,
	TokenUsage,
} from 'shared/types.ts';

/**
 * Type guard to check if an entry is a ConversationStart
 */
export function isConversationStart(entry: ConversationLogDataEntry): entry is ConversationStart {
	return !('logEntry' in entry) && 'conversationHistory' in entry;
}

/**
 * Type guard to check if an entry is a ConversationContinue
 */
export function isConversationContinue(entry: ConversationLogDataEntry): entry is ConversationContinue {
	return 'logEntry' in entry && 'tokenUsageStats' in entry;
}

/**
 * Type guard to check if an entry is a ConversationResponse
 */
export function isConversationResponse(entry: ConversationLogDataEntry): entry is ConversationResponse {
	return 'logEntry' in entry && !('tokenUsageStats' in entry);
}

/**
 * Type guard for entries that have logEntry (Continue or Response)
 */
export function logDataEntryHasLogEntry(entry: ConversationLogDataEntry): entry is ConversationContinue | ConversationResponse {
	return 'logEntry' in entry;
}
export function logDataEntryHasChildren(entry: ConversationLogDataEntry): entry is ConversationContinue | ConversationResponse {
	return 'children' in entry;
}

/**
 * Get default token usage for when it's missing
 */
export function getDefaultTokenUsage(): TokenUsage {
	return {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		totalAllTokens: 0,
	};
}
