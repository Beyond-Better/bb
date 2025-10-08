import type { CollaborationLogDataEntry } from 'shared/types.ts';
import {
	DEFAULT_FILTER_STATE,
	FILTER_PRESETS,
	type FilterPreset,
	type LogEntryFilterState,
	type LogEntryType,
	type LogEntryTypeCounts,
} from '../types/logEntryFilter.types.ts';
import { logDataEntryHasLogEntry } from './typeGuards.utils.ts';

/**
 * Storage keys for filter state persistence
 */
const STORAGE_KEY_GLOBAL = 'bb_filter_global_default';
const STORAGE_KEY_COLLAB_PREFIX = 'bb_filter_collab';

/**
 * Get storage key for collaboration-specific filter state
 */
function getCollaborationStorageKey(collaborationId: string): string {
	return `${STORAGE_KEY_COLLAB_PREFIX}:${collaborationId}`;
}

/**
 * Serialize filter state for storage
 */
function serializeFilterState(state: LogEntryFilterState): string {
	return JSON.stringify({
		preset: state.preset,
		customTypes: Array.from(state.customTypes),
	});
}

/**
 * Deserialize filter state from storage
 */
function deserializeFilterState(json: string): LogEntryFilterState | null {
	try {
		const parsed = JSON.parse(json);
		return {
			preset: parsed.preset as FilterPreset,
			customTypes: new Set(parsed.customTypes as LogEntryType[]),
		};
	} catch {
		return null;
	}
}

/**
 * Load global default filter state from localStorage
 */
export function loadGlobalFilterState(): LogEntryFilterState {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_FILTER_STATE };

	const stored = localStorage.getItem(STORAGE_KEY_GLOBAL);
	if (!stored) return { ...DEFAULT_FILTER_STATE };

	const state = deserializeFilterState(stored);
	return state || { ...DEFAULT_FILTER_STATE };
}

/**
 * Save global default filter state to localStorage
 */
export function saveGlobalFilterState(state: LogEntryFilterState): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY_GLOBAL, serializeFilterState(state));
}

/**
 * Load collaboration-specific filter state from localStorage
 * Falls back to global default if no collaboration-specific state exists
 */
export function loadCollaborationFilterState(collaborationId: string): LogEntryFilterState {
	if (typeof localStorage === 'undefined') return loadGlobalFilterState();

	const stored = localStorage.getItem(getCollaborationStorageKey(collaborationId));
	if (!stored) return loadGlobalFilterState();

	const state = deserializeFilterState(stored);
	return state || loadGlobalFilterState();
}

/**
 * Save collaboration-specific filter state to localStorage
 * Also updates global default and resets collapse states to defaults
 */
export function saveCollaborationFilterState(collaborationId: string, state: LogEntryFilterState): void {
	if (typeof localStorage === 'undefined') return;

	// Save collaboration-specific state
	localStorage.setItem(getCollaborationStorageKey(collaborationId), serializeFilterState(state));

	// Update global default
	saveGlobalFilterState(state);

	// Reset collapse states to defaults for this collaboration
	// This ensures entries appear in their default expanded/collapsed state
	resetCollapseStatesToDefaults(collaborationId);
}

/**
 * Reset all collapse states to their default values for a collaboration
 * This sets each entry to its type's default expanded/collapsed state
 */
export function resetCollapseStatesToDefaults(collaborationId: string): void {
	if (typeof localStorage === 'undefined') return;

	// Import default states from messageUtils
	const defaultExpanded: Record<string, boolean> = {
		user: true,
		orchestrator: true,
		agent_group: true,
		assistant: true,
		answer: true,
		tool_use: false,
		tool_result: false,
		auxiliary: false,
		error: false,
	};

	const prefix = `bb_collapse_state:${collaborationId}:`;

	// Find all collapse state keys for this collaboration
	const keysToUpdate: Array<{ key: string; entryType: string }> = [];

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && key.startsWith(prefix)) {
			// Extract entry type from the key or default to 'auxiliary'
			// Keys are in format: bb_collapse_state:{collaborationId}:{agentId}:{index}
			// We'll just set all to a generic default and let them re-initialize properly
			keysToUpdate.push({ key, entryType: 'auxiliary' });
		}
	}

	// Instead of setting specific values, just clear them
	// This will cause components to re-read defaults from messageUtils
	for (const { key } of keysToUpdate) {
		localStorage.removeItem(key);
	}
}

/**
 * Get the entry type from a log data entry
 */
export function getEntryType(logDataEntry: CollaborationLogDataEntry): LogEntryType | null {
	// Check if this is an agent entry
	if (logDataEntry.agentInteractionId) {
		return 'agent';
	}

	// Check if entry has logEntry property
	if (!logDataEntryHasLogEntry(logDataEntry)) {
		return null; // Collaboration start entries
	}

	const entryType = logDataEntry.logEntry.entryType;

	// Map entry types to filter types
	switch (entryType) {
		case 'user':
			return 'user';
		case 'orchestrator':
			return 'orchestrator';
		case 'assistant':
			return 'assistant';
		case 'answer':
			return 'answer';
		case 'tool_use':
			return 'tool_use';
		case 'tool_result':
			return 'tool_result';
		case 'auxiliary':
			return 'auxiliary';
		case 'error':
			return 'error';
		default:
			return null;
	}
}

/**
 * Check if an entry should be shown based on filter state
 */
export function shouldShowEntry(logDataEntry: CollaborationLogDataEntry, filterState: LogEntryFilterState): boolean {
	const entryType = getEntryType(logDataEntry);

	// Always show entries without a type (e.g., collaboration start)
	if (!entryType) return true;

	// Check if this type is in the active filter
	return filterState.customTypes.has(entryType);
}

/**
 * Count visible agent children for a parent entry
 */
function countVisibleAgentChildren(
	logDataEntry: CollaborationLogDataEntry,
	filterState: LogEntryFilterState,
): number {
	if (!logDataEntry.children) return 0;

	// If agent type is not in filter, return 0
	if (!filterState.customTypes.has('agent')) return 0;

	// Count agent interaction groups
	return Object.keys(logDataEntry.children).length;
}

/**
 * Check if a parent entry with agent children should be shown
 * Returns true if the parent type is visible OR if it has visible agent children
 */
export function shouldShowParentEntry(
	logDataEntry: CollaborationLogDataEntry,
	filterState: LogEntryFilterState,
): boolean {
	const entryType = getEntryType(logDataEntry);

	// Always show entries without a type
	if (!entryType) return true;

	// Check if entry has agent children
	const hasAgentChildren = logDataEntry.children && Object.keys(logDataEntry.children).length > 0;

	if (hasAgentChildren) {
		// Show parent if:
		// 1. The parent type is in filter, OR
		// 2. There are visible agent children
		const parentVisible = filterState.customTypes.has(entryType);
		const hasVisibleChildren = countVisibleAgentChildren(logDataEntry, filterState) > 0;
		return parentVisible || hasVisibleChildren;
	}

	// No agent children, use standard filtering
	return filterState.customTypes.has(entryType);
}

/**
 * Get the count of visible agent children for display
 */
export function getVisibleAgentChildCount(
	logDataEntry: CollaborationLogDataEntry,
	filterState: LogEntryFilterState,
): number {
	return countVisibleAgentChildren(logDataEntry, filterState);
}

/**
 * Count entries by type for display in filter UI
 */
export function countEntriesByType(logDataEntries: CollaborationLogDataEntry[]): LogEntryTypeCounts {
	const counts: LogEntryTypeCounts = {
		user: 0,
		orchestrator: 0,
		assistant: 0,
		answer: 0,
		tool_use: 0,
		tool_result: 0,
		auxiliary: 0,
		agent: 0,
		error: 0,
		total: 0,
	};

	function countEntry(entry: CollaborationLogDataEntry) {
		const entryType = getEntryType(entry);
		if (entryType) {
			counts[entryType]++;
			counts.total++;
		}

		// Count agent children
		if (entry.children) {
			for (const agentEntries of Object.values(entry.children)) {
				for (const agentEntry of agentEntries) {
					countEntry(agentEntry);
				}
			}
		}
	}

	for (const entry of logDataEntries) {
		countEntry(entry);
	}

	return counts;
}

/**
 * Apply a preset to the filter state
 */
export function applyPreset(preset: FilterPreset): LogEntryFilterState {
	const types = FILTER_PRESETS[preset];

	if (!types) {
		// Custom preset - return current state
		return {
			preset: 'custom',
			customTypes: new Set(),
		};
	}

	return {
		preset,
		customTypes: new Set(types),
	};
}

/**
 * Toggle a specific type in the filter
 * Automatically switches to custom preset if modifying a preset
 */
export function toggleFilterType(
	currentState: LogEntryFilterState,
	type: LogEntryType,
): LogEntryFilterState {
	const newTypes = new Set(currentState.customTypes);

	if (newTypes.has(type)) {
		newTypes.delete(type);
	} else {
		newTypes.add(type);
	}

	// Check if new state matches any preset
	for (const [presetName, presetTypes] of Object.entries(FILTER_PRESETS)) {
		if (!presetTypes) continue; // Skip custom

		const presetSet = new Set(presetTypes);
		if (
			presetSet.size === newTypes.size &&
			[...presetSet].every((t) => newTypes.has(t))
		) {
			return {
				preset: presetName as FilterPreset,
				customTypes: newTypes,
			};
		}
	}

	// No matching preset, use custom
	return {
		preset: 'custom',
		customTypes: newTypes,
	};
}

/**
 * Select all types
 */
export function selectAllTypes(): LogEntryFilterState {
	return applyPreset('all');
}

/**
 * Clear all types
 */
export function clearAllTypes(): LogEntryFilterState {
	return {
		preset: 'custom',
		customTypes: new Set(),
	};
}
