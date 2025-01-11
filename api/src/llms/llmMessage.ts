import { ulid } from '@std/ulid';
import type {
	LLMMessageStop,
	LLMProviderMessageResponseRole,
	LLMProviderMessageResponseType,
	LLMTokenUsage,
} from 'api/types.ts';
import type { ConversationStats } from 'shared/types.ts';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';

export interface LLMMessageContentPartTextBlock {
	messageId?: string;
	type: 'text';
	text: string;
}

export interface LLMMessageContentPartImageBlock {
	messageId?: string;
	type: 'image';
	source: LLMMessageContentPartImageBlockSource;
}
export type LLMMessageContentPartImageBlockSourceMediaType =
	| 'image/jpeg'
	| 'image/png'
	| 'image/gif'
	| 'image/webp';
export interface LLMMessageContentPartImageBlockSource {
	data: string;
	media_type: LLMMessageContentPartImageBlockSourceMediaType;
	type: 'base64';
}
export interface LLMMessageContentPartAudioBlock { // openai
	messageId?: string;
	type: 'audio';
	id: string; //Unique identifier for a previous audio response from the model
}

export interface LLMMessageContentPartToolUseBlock {
	messageId?: string;
	//type: 'tool_use' | 'tool_calls'; // tool_use is anthropic - tool_calls is openai
	type: 'tool_use'; // see comments in LLMMessageContentPartType
	id: string;
	input: object;
	name: string;
}

export interface LLMMessageContentPartToolResultBlock {
	messageId?: string;
	//type: 'tool_result' | 'tool'; // tool_result is anthropic - tool is openai
	type: 'tool_result'; // see comments in LLMMessageContentPartType
	tool_use_id?: string; // anthropic
	//tool_call_id?: string; // openai // use `tool_use_id` will be converted to `tool_call_id` by openAILLM
	content?: Array<
		LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock
	>;
	is_error?: boolean;
}

export type LLMMessageContentPartType =
	| 'text'
	| 'image'
	| 'audio' // openai
	| 'tool_use' 
	| 'tool_result'
	| 'system' // openai // will be converted to `system` role by openAILLM
	| 'developer'; // openai // will be converted to `developer` role by openAILLM
// 	| 'tool_calls' // openai // use `tool_use` will be converted to `tool_calls` part of `assistant` role by openAILLM
// 	| 'tool'; // openai // use `tool_result` will be converted to `tool` role by openAILLM

export type LLMMessageContentPart =
	| LLMMessageContentPartTextBlock
	| LLMMessageContentPartImageBlock
	| LLMMessageContentPartAudioBlock
	| LLMMessageContentPartToolUseBlock
	| LLMMessageContentPartToolResultBlock;

export type LLMMessageContentParts = Array<LLMMessageContentPart>;

export interface LLMAnswerToolUse {
	toolThinking?: string;
	toolInput: LLMToolInputSchema;
	toolUseId: string;
	toolName: string;
	toolValidation: { validated: boolean; results: string };
}

export interface LLMMessageProviderResponse {
	id: string;
	type: LLMProviderMessageResponseType;
	role: LLMProviderMessageResponseRole;
	model: string;
	system?: string;
	messageStop: LLMMessageStop;
	usage: LLMTokenUsage;
	isTool: boolean;
	toolsUsed?: Array<LLMAnswerToolUse>;
	toolThinking?: string;
	extra?: object;
	createdAt?: Date;
	updatedAt?: Date;
}

class LLMMessage {
	public timestamp: string = new Date().toISOString();
	public id!: string;

	public _conversationTurnCount!: number;
	public _statementTurnCount!: number;
	public _statementCount!: number;

	constructor(
		//public role: 'user' | 'assistant' | 'system' | 'developer' | 'tool', // system, developer and tool are only for openai
		public role: 'user' | 'assistant' , 
		public content: LLMMessageContentParts,
		stats: ConversationStats,
		public tool_call_id?: string,
		public providerResponse?: LLMMessageProviderResponse,
		id?: string,
	) {
		this.setId(id);
		this.setTimestamp();
		this.conversationStats = stats;
	}

	public setId(id?: string): void {
		if (!this.id && id) {
			this.id = id;
		} else if (!this.id) {
			this.id = ulid();
		}
	}

	public get conversationStats(): ConversationStats {
		return {
			statementCount: this._statementCount,
			statementTurnCount: this._statementTurnCount,
			conversationTurnCount: this._conversationTurnCount,
		};
	}

	public set conversationStats(stats: ConversationStats) {
		this._statementCount = stats.statementCount ?? 1;
		this._statementTurnCount = stats.statementTurnCount ?? 1;
		this._conversationTurnCount = stats.conversationTurnCount ?? 1;
	}

	public setTimestamp(): void {
		if (!this.timestamp) {
			this.timestamp = new Date().toISOString();
		}
	}
}

export default LLMMessage;
