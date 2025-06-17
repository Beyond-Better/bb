import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContent } from 'shared/types.ts';

// source data to be formatted
export interface LogEntrySourceData {
	// For the left side next to icon
	title: string; // e.g. "Setting Title" or "find_resources"
	subtitle?: string; // e.g. "3 operations" or "Found 5 files"

	// For the main body
	content: string | LLMToolInputSchema | CollaborationLogEntryContent; // complete formatted log entry content

	// For the right side preview
	preview?: string; // Very short summary, e.g. "Searching for *.ts files"
}

export interface LogEntryTitleData {
	// For the left side next to icon
	title: string; // e.g. "Setting Title" or "find_resources"
	subtitle?: string; // e.g. "3 operations" or "Found 5 files"
}

// Each formatted result type can be string for console or JSX.Element for browser
export interface LogEntryFormattedResult {
	// For the left side next to icon
	title: string | JSX.Element; // e.g. "Setting Title" or "find_resources"
	subtitle?: string | JSX.Element; // e.g. "3 operations" or "Found 5 files"

	// For the main body
	content: string | JSX.Element; // complete formatted log entry content

	// For the right side preview
	preview: string | JSX.Element; // Very short summary, e.g. "Searching for *.ts files"
}

// export type LLMToolUseInputFormatter = (toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination) => string;
// export type LLMToolRunResultFormatter = (
// 	resultContent: CollaborationLogEntryContent,
// 	format: LLMToolFormatterDestination,
// ) => string;

// export interface LogEntryFormatter {
// 	formatLogEntryToolUse?(toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination): LogEntrySourceData;
// 	formatLogEntryToolResult?(resultContent: unknown, format: LLMToolFormatterDestination): LogEntrySourceData;
// }

export interface AuxiliaryChatContent {
	prompt?: string;
	message: string;
	purpose: string; // e.g. "Setting conversation title", "Writing commit message"
}
