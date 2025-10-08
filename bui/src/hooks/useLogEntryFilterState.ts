import { signal } from '@preact/signals';
import type { FilterPreset, LogEntryFilterState, LogEntryType } from '../types/logEntryFilter.types.ts';
import {
	applyPreset,
	clearAllTypes,
	loadCollaborationFilterState,
	saveCollaborationFilterState,
	selectAllTypes,
	toggleFilterType,
} from '../utils/logEntryFilterState.utils.ts';
import { DEFAULT_FILTER_STATE } from '../types/logEntryFilter.types.ts';

/**
 * Global filter state signal
 */
const filterState = signal<LogEntryFilterState>({ ...DEFAULT_FILTER_STATE });

/**
 * Current collaboration ID for persistence
 */
let currentCollaborationId: string | null = null;

/**
 * Hook for managing log entry filter state
 */
export function useLogEntryFilterState() {
	/**
	 * Initialize filter state for a collaboration
	 */
	const initializeFilterState = (collaborationId: string) => {
		currentCollaborationId = collaborationId;
		const state = loadCollaborationFilterState(collaborationId);
		filterState.value = state;
	};

	/**
	 * Save current filter state
	 */
	const saveFilterState = () => {
		if (!currentCollaborationId) return;
		saveCollaborationFilterState(currentCollaborationId, filterState.value);
	};

	/**
	 * Set filter preset
	 */
	const setPreset = (preset: FilterPreset) => {
		filterState.value = applyPreset(preset);
		saveFilterState();
	};

	/**
	 * Toggle a specific entry type
	 */
	const toggleType = (type: LogEntryType) => {
		filterState.value = toggleFilterType(filterState.value, type);
		saveFilterState();
	};

	/**
	 * Select all entry types
	 */
	const selectAll = () => {
		filterState.value = selectAllTypes();
		saveFilterState();
	};

	/**
	 * Clear all entry types
	 */
	const clearAll = () => {
		filterState.value = clearAllTypes();
		saveFilterState();
	};

	/**
	 * Check if a type is currently selected
	 */
	const isTypeSelected = (type: LogEntryType): boolean => {
		return filterState.value.customTypes.has(type);
	};

	return {
		filterState,
		initializeFilterState,
		setPreset,
		toggleType,
		selectAll,
		clearAll,
		isTypeSelected,
	};
}
