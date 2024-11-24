import LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
import { AnthropicModel } from 'api/types.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { ConversationId, TokenUsage } from 'shared/types.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
//import type { LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
//import { extractTextFromContent } from 'api/utils/llms.ts';
//import { logger } from 'shared/logger.ts';

class LLMChatInteraction extends LLMInteraction {
	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
	}

	public override async prepareSytemPrompt(system: string): Promise<string> {
		//logger.info('ChatInteraction: Preparing system prompt for chat', system);
		return new Promise((resolve) => resolve(system));
	}
	public override async prepareMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		return new Promise((resolve) => resolve(messages));
	}
	public override async prepareTools(tools: Map<string, LLMTool>): Promise<LLMTool[]> {
		return Array.from(tools.values());
	}

	public override async updateTotals(
		tokenUsage: TokenUsage,
		role: 'user' | 'assistant' | 'system' = 'assistant',
	): Promise<void> {
		// Record token usage in new format with chat type
		const record = this.createTokenUsageRecord(tokenUsage, role, 'chat');
		await this.conversationPersistence.writeTokenUsage(record, 'chat');

		// Update existing tracking
		await super.updateTotals(tokenUsage, role);
	}

	public async chat(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {
				model: AnthropicModel.CLAUDE_3_HAIKU,
				system: '',
				maxTokens: 4096,
			} as LLMSpeakWithOptions;
		}

		this._statementTurnCount++;
		//logger.debug(`chat - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		const messageId = this.addMessageForUserRole({ type: 'text', text: prompt });
		this.conversationLogger.logAuxiliaryMessage(messageId, prompt);

		const response = await this.llm.speakWithPlus(this, speakOptions);

		// Update token usage tracking
		await this.updateTotals(response.messageResponse.usage);
		//const msg = extractTextFromContent(response.messageResponse.answerContent);
		const msg = response.messageResponse.answer;

		this.conversationLogger.logAuxiliaryMessage(this.getLastMessageId(), msg);

		return response;
	}
}

export default LLMChatInteraction;
