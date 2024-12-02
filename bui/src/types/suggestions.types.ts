/**
 * Processed suggestion for display in the UI
 */
export interface DisplaySuggestion {
	path: string; // Full relative path
	isDirectory: boolean; // Whether the entry is a directory
	display: string; // Filename or directory name for display
	parent: string; // Parent directory path
	size?: number; // File size in bytes (optional)
	modified?: string; // Last modified date (optional)
}
