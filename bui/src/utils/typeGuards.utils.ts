import type {
	CollaborationContinue,
	CollaborationLogDataEntry,
	CollaborationResponse,
	CollaborationStart,
	TokenUsage,
} from 'shared/types.ts';
import { DEFAULT_TOKEN_USAGE } from 'shared/types.ts';

/**
 * Type guard to check if an entry is a CollaborationStart
 */
export function isInteractionStart(entry: CollaborationLogDataEntry): entry is CollaborationStart {
	return !('logEntry' in entry) && 'collaborationHistory' in entry;
}

/**
 * Type guard to check if an entry is a CollaborationContinue
 */
export function isInteractionContinue(entry: CollaborationLogDataEntry): entry is CollaborationContinue {
	return 'logEntry' in entry && 'tokenUsageStats' in entry;
}

/**
 * Type guard to check if an entry is a CollaborationResponse
 */
export function isInteractionResponse(entry: CollaborationLogDataEntry): entry is CollaborationResponse {
	return 'logEntry' in entry && !('tokenUsageStats' in entry);
}

/**
 * Type guard for entries that have logEntry (Continue or Response)
 */
export function logDataEntryHasLogEntry(
	entry: CollaborationLogDataEntry,
): entry is CollaborationContinue | CollaborationResponse {
	return 'logEntry' in entry;
}
export function logDataEntryHasChildren(
	entry: CollaborationLogDataEntry,
): entry is CollaborationContinue | CollaborationResponse {
	return 'children' in entry;
}

/**
 * Get default token usage for when it's missing
 */
export function getDefaultTokenUsage(): TokenUsage {
	return DEFAULT_TOKEN_USAGE();
}
