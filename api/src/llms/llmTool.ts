import type { JSX } from 'preact';
import type { JSONSchema4 } from 'json-schema';
import Ajv from 'ajv';
import { TOOL_STYLES_BROWSER, TOOL_STYLES_CONSOLE, TOOL_TAGS } from './llmToolTags.tsx';

import type { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationId, ConversationLogEntryContent } from 'shared/types.ts';
//import { logger } from 'shared/logger.ts';

export type LLMToolInputSchema = JSONSchema4;

export type LLMToolRunResultContent = string | LLMMessageContentPart | LLMMessageContentParts;
export type LLMToolRunToolResponse = string;
export interface LLMToolRunBbResponseData {
	data: unknown;
}
export type LLMToolRunBbResponse = LLMToolRunBbResponseData | string;

export interface LLMToolFinalizeResult {
	messageId: string;
}

export interface LLMToolRunResult {
	toolResults: LLMToolRunResultContent;
	toolResponse: LLMToolRunToolResponse;
	bbResponse: LLMToolRunBbResponse;
	finalizeCallback?: (messageId: ConversationId) => void;
}

export interface LLMToolFeatures {
	mutates?: boolean; // Whether tool modifies resources
	stateful?: boolean; // Whether tool maintains state
	async?: boolean; // Whether tool runs asynchronously
	idempotent?: boolean; // Whether multiple runs produce same result
	resourceIntensive?: boolean; // Whether tool needs significant resources
	requiresNetwork?: boolean; // Whether tool needs internet access
}

export type LLMToolConfig = Record<string, unknown>;

export type LLMToolFormatterDestination = 'console' | 'browser';
export type LLMToolUseInputFormatter = (toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination) => string;
export type LLMToolRunResultFormatter = (
	resultContent: ConversationLogEntryContent,
	format: LLMToolFormatterDestination,
) => string;

// [TODO] copied LogEntryFormattedResult from api/src/logEntries/types.ts to avoid circular imports
// Renaming to avoid confusion and keep consistency for LLMTool types
// Each formatted result type can be string for console or JSX.Element for browser
export interface LLMToolLogEntryFormattedResult {
	// For the left side next to icon
	title: string | JSX.Element; // e.g. "Setting Title" or "search_project"
	subtitle?: string | JSX.Element; // e.g. "3 operations" or "Found 5 files"

	// For the main body
	content: string | JSX.Element; // complete formatted log entry content

	// For the right side preview
	preview: string | JSX.Element; // Very short summary, e.g. "Searching for *.ts files"
}

abstract class LLMTool {
	constructor(
		public name: string,
		public description: string,
		public toolConfig: LLMToolConfig,
		public features: LLMToolFeatures = {},
	) {
		//logger.info(`LLMTool: Constructing tool ${name}`);
	}

	public async init(): Promise<LLMTool> {
		return this;
	}

	abstract get inputSchema(): LLMToolInputSchema;

	validateInput(input: unknown): boolean {
		const ajv = new Ajv();
		const validate = ajv.compile(this.inputSchema);
		return validate(input) as boolean;
	}

	abstract runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult>;

	abstract formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: LLMToolFormatterDestination,
	): LLMToolLogEntryFormattedResult;

	abstract formatLogEntryToolResult(
		resultContent: ConversationLogEntryContent,
		format: LLMToolFormatterDestination,
	): LLMToolLogEntryFormattedResult;

	// Imported from llmToolTags.tsx
	static readonly TOOL_TAGS_BROWSER = TOOL_TAGS;
	static readonly TOOL_STYLES_BROWSER = TOOL_STYLES_BROWSER;
	static readonly TOOL_STYLES_CONSOLE = TOOL_STYLES_CONSOLE;
}

export default LLMTool;
