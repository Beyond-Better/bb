import type { CollaborationLogEntry } from 'shared/types.ts';

/**
 * Log entry types that can be filtered
 */
export type LogEntryType =
	| 'user'
	| 'orchestrator'
	| 'assistant'
	| 'answer'
	| 'tool_use'
	| 'tool_result'
	| 'auxiliary'
	| 'agent'
	| 'error';

/**
 * Filter preset options
 */
export type FilterPreset = 'all' | 'conversation' | 'mainFlow' | 'tools' | 'custom';

/**
 * Filter state containing preset and custom selections
 */
export interface LogEntryFilterState {
	preset: FilterPreset;
	customTypes: Set<LogEntryType>;
}

/**
 * Entry counts for display in filter UI
 */
export interface LogEntryTypeCounts {
	user: number;
	orchestrator: number;
	assistant: number;
	answer: number;
	tool_use: number;
	tool_result: number;
	auxiliary: number;
	agent: number;
	error: number;
	total: number;
}

/**
 * Filter preset definitions
 */
export const FILTER_PRESETS: Record<FilterPreset, LogEntryType[] | null> = {
	all: ['user', 'orchestrator', 'assistant', 'answer', 'tool_use', 'tool_result', 'auxiliary', 'agent', 'error'],
	conversation: ['user', 'assistant', 'answer', 'error'],
	mainFlow: ['user', 'orchestrator', 'assistant', 'answer', 'error'],
	tools: ['tool_use', 'tool_result', 'agent', 'error'],
	custom: null, // User-defined
};

/**
 * Default filter state
 */
export const DEFAULT_FILTER_STATE: LogEntryFilterState = {
	preset: 'conversation',
	customTypes: new Set(['user', 'assistant', 'answer']),
};

/**
 * Preset labels for UI display
 */
export const FILTER_PRESET_LABELS: Record<FilterPreset, string> = {
	all: 'All',
	conversation: 'Conversation',
	mainFlow: 'Main Flow',
	tools: 'Tools',
	custom: 'Custom',
};

/**
 * Type labels for UI display
 */
export const LOG_ENTRY_TYPE_LABELS: Record<LogEntryType, string> = {
	user: 'User Messages',
	orchestrator: 'Orchestrator',
	assistant: 'Assistant',
	answer: 'Answers',
	tool_use: 'Tool Inputs',
	tool_result: 'Tool Results',
	auxiliary: 'Auxiliary',
	agent: 'Agent Tasks',
	error: 'Errors',
};
