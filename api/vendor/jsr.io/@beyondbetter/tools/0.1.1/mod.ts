// Copyright 2024 the Beyond Better authors. All rights reserved. MIT license.

/**
 * BB Tools Framework
 *
 * A comprehensive framework for building AI assistant tools. Provides base classes,
 * interfaces, and utilities for creating tools that can interact with projects,
 * manage conversations, and format output for both browser and console environments.
 *
 * ```ts
 * import LLMTool from "@beyondbetter/tools";
 * import type {
 *   IProjectEditor,
 *   IConversationInteraction,
 *   LLMToolRunResult
 * } from "@beyondbetter/tools";
 *
 * class MyTool extends LLMTool {
 *   get inputSchema() {
 *     return {
 *       type: "object",
 *       properties: {
 *         param: { type: "string" }
 *       }
 *     };
 *   }
 *
 *   async runTool(
 *     interaction: IConversationInteraction,
 *     toolUse: LLMAnswerToolUse,
 *     projectEditor: IProjectEditor
 *   ): Promise<LLMToolRunResult> {
 *     // Tool implementation
 *   }
 * }
 * ```
 *
 * ## Core Components
 *
 * - {@link LLMTool} - Base class for all tools
 * - {@link IProjectEditor} - Project management interface
 * - {@link IConversationInteraction} - Conversation management interface
 *
 * ## Types and Interfaces
 *
 * - Message Types: {@link LLMMessageContentPart}, {@link LLMMessageContentParts}
 * - Tool Types: {@link LLMToolRunResult}, {@link LLMToolFeatures}
 * - Utility Types: {@link TokenUsage}, {@link FileMetadata}
 *
 * ## Formatting
 *
 * - Browser: {@link TOOL_STYLES_BROWSER}, {@link TOOL_TAGS}
 * - Console: {@link TOOL_STYLES_CONSOLE}
 *
 * @module
 */

export { default } from './llm_tool.ts';

// Core interfaces
export type { IProjectEditor } from './project_editor.ts';
export type { IConversationInteraction } from './conversation.ts';

// Message types
export type {
  LLMAnswerToolUse,
  LLMMessageContentPart,
  LLMMessageContentPartBase,
  LLMMessageContentPartImageBlock,
  LLMMessageContentPartImageBlockSourceMediaType,
  LLMMessageContentParts,
  LLMMessageContentPartTextBlock,
  LLMMessageContentPartToolResultBlock,
  LLMMessageContentPartToolUseBlock,
} from './message.ts';

// Shared types
export type {
  ConversationStats,
  FileMetadata,
  TokenUsage,
  ToolStats,
  ToolUsageStats,
} from './types.ts';

// Tool types
export type {
  LLMToolConfig,
  LLMToolFeatures,
  LLMToolFormatterDestination,
  LLMToolInputSchema,
  LLMToolLogEntryFormattedResult,
  LLMToolRunBbResponse,
  LLMToolRunBbResponseData,
  LLMToolRunResult,
  LLMToolRunResultContent,
  LLMToolRunResultFormatter,
  LLMToolRunToolResponse,
  LLMToolUseInputFormatter,
} from './llm_tool.ts';

// Formatting utilities
export { TOOL_STYLES_BROWSER, TOOL_STYLES_CONSOLE, TOOL_TAGS } from './llm_tool_tags.tsx';

// Example tools
export * from './examples/mod.ts';
