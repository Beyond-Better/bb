import type { JSX } from 'npm:preact@10.25.3';
import type { JSONSchema4 } from 'npm:@types/json-schema@7.0.15/index.d.ts';
import { Ajv } from 'npm:ajv@8.17.1';

import { TOOL_STYLES_BROWSER, TOOL_STYLES_CONSOLE, TOOL_TAGS } from './llm_tool_tags.tsx';
import type { IConversationInteraction } from './conversation.ts';
import type { IProjectEditor } from './project_editor.ts';
import type { LLMAnswerToolUse, LLMMessageContentPart, LLMMessageContentParts } from './message.ts';

export type LLMToolInputSchema = JSONSchema4;
export type LLMToolRunResultContent =
  | string
  | LLMMessageContentPart
  | LLMMessageContentParts;
export type LLMToolRunToolResponse = string;

export interface LLMToolRunBbResponseData {
  data: unknown;
}
export type LLMToolRunBbResponse = LLMToolRunBbResponseData | string;

export interface LLMToolRunResult {
  toolResults: LLMToolRunResultContent;
  toolResponse: LLMToolRunToolResponse;
  bbResponse: LLMToolRunBbResponse;
  finalizeCallback?: (messageId: string) => void;
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
export type LLMToolUseInputFormatter = (
  toolInput: LLMToolInputSchema,
  format: LLMToolFormatterDestination,
) => string;
export type LLMToolRunResultFormatter = (
  resultContent: unknown,
  format: LLMToolFormatterDestination,
) => string;

export interface LLMToolLogEntryFormattedResult {
  title: string | JSX.Element;
  subtitle?: string | JSX.Element;
  content: string | JSX.Element;
  preview: string | JSX.Element;
}

/**
 * Base class for all LLM tools
 */
abstract class LLMTool {
  constructor(
    public name: string,
    public description: string,
    public toolConfig: LLMToolConfig,
    public features: LLMToolFeatures = {},
  ) {}

  public async init(): Promise<LLMTool> {
    return this;
  }

  abstract get inputSchema(): LLMToolInputSchema;

  validateInput(input: unknown): boolean {
    const ajv = new Ajv({ code: { esm: true } });
    const validate = ajv.compile(this.inputSchema);
    return validate(input) as boolean;
  }

  abstract runTool(
    interaction: IConversationInteraction,
    toolUse: LLMAnswerToolUse,
    projectEditor: IProjectEditor,
  ): Promise<LLMToolRunResult>;

  abstract formatLogEntryToolUse(
    toolInput: LLMToolInputSchema,
    format: LLMToolFormatterDestination,
  ): LLMToolLogEntryFormattedResult;

  abstract formatLogEntryToolResult(
    resultContent: unknown,
    format: LLMToolFormatterDestination,
  ): LLMToolLogEntryFormattedResult;

  // Style constants for tool output formatting
  static readonly TOOL_TAGS_BROWSER = TOOL_TAGS;
  static readonly TOOL_STYLES_BROWSER = TOOL_STYLES_BROWSER;
  static readonly TOOL_STYLES_CONSOLE = TOOL_STYLES_CONSOLE;
}

export default LLMTool;
