import type {
	ConversationContinue,
	ConversationEntry,
	ConversationResponse,
	ConversationStart,
	TokenUsage,
} from 'shared/types.ts';

/**
 * Type guard to check if an entry is a ConversationStart
 */
export function isConversationStart(entry: ConversationEntry): entry is ConversationStart {
	return !('logEntry' in entry) && 'conversationHistory' in entry;
}

/**
 * Type guard to check if an entry is a ConversationContinue
 */
export function isConversationContinue(entry: ConversationEntry): entry is ConversationContinue {
	return 'logEntry' in entry && 'tokenUsageTurn' in entry;
}

/**
 * Type guard to check if an entry is a ConversationResponse
 */
export function isConversationResponse(entry: ConversationEntry): entry is ConversationResponse {
	return 'logEntry' in entry && !('tokenUsageTurn' in entry);
}

/**
 * Type guard for entries that have logEntry (Continue or Response)
 */
export function hasLogEntry(entry: ConversationEntry): entry is ConversationContinue | ConversationResponse {
	return 'logEntry' in entry;
}

/**
 * Get default token usage for when it's missing
 */
export function getDefaultTokenUsage(): TokenUsage {
	return {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	};
}
