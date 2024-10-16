import type { JSONSchema4 } from 'json-schema';
import Ajv from 'ajv';
import type { JSX } from 'preact';

import type { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from './interactions/conversationInteraction.ts';
import type ProjectEditor from '../editor/projectEditor.ts';
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

export type LLMToolConfig = Record<string, unknown>;

export type LLMToolFormatterDestination = 'console' | 'browser';
export type LLMToolUseInputFormatter = (toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination) => string;
export type LLMToolRunResultFormatter = (
	resultContent: ConversationLogEntryContent,
	format: LLMToolFormatterDestination,
) => string;

abstract class LLMTool {
	constructor(
		public name: string,
		public description: string,
		public toolConfig: LLMToolConfig,
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

	abstract formatToolUse(toolInput: LLMToolInputSchema, format: LLMToolFormatterDestination): string | JSX.Element;

	abstract formatToolResult(
		resultContent: ConversationLogEntryContent,
		format: LLMToolFormatterDestination,
	): string | JSX.Element;
}

export default LLMTool;
