import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolConversationSummaryInput {
	requestSource?: 'user' | 'tool';
	maxTokensToKeep?: number;
	summaryLength?: 'short' | 'medium' | 'long';
}

export interface LLMToolConversationSummarySection {
	files: Array<{
		path: string;
		revision: string;
		operations: string[];
	}>;
	tools: Array<{
		name: string;
		uses: number;
		keyResults: string[];
	}>;
	decisions: string[];
	requirements: string[];
	externalReferences: Array<{
		url: string;
		context: string;
	}>;
	codeChanges: Array<{
		description: string;
		files: string[];
	}>;
	projectContext: string[];
}

export interface LLMToolConversationSummaryMetadata {
	messageRange: {
		start: { id: string; timestamp: string };
		end: { id: string; timestamp: string };
	};
	originalTokenCount: number;
	summaryTokenCount: number;
	model: string;
	fallbackUsed?: boolean;
}

export interface LLMToolConversationSummaryData {
	summary: string;
	keptMessages: LLMMessage[];
	originalTokenCount: number;
	newTokenCount: number;
	originalMessageCount: number;
	summaryLength: 'short' | 'medium' | 'long';
	metadata: LLMToolConversationSummaryMetadata;
}

export interface LLMToolConversationSummaryResultData {
	summary: string;
	maxTokensToKeep: number;
	summaryLength: 'short' | 'medium' | 'long';
	requestSource: 'tool' | 'user';
	originalTokenCount: number;
	newTokenCount: number;
	originalMessageCount: number;
	metadata: LLMToolConversationSummaryMetadata;
	keptMessageCount: number;
	removedMessageCount: number;
}

export interface LLMToolConversationSummaryResponseData {
	data: LLMToolConversationSummaryResultData;
}

export interface LLMToolConversationSummaryResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolConversationSummaryResponseData;
}
