import LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
//import type { AnthropicModel } from 'api/types.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { ConversationId } from 'shared/types.ts';
import type { AuxiliaryChatContent } from 'api/logEntries/types.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
//import type { LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
//import { extractTextFromContent } from 'api/utils/llms.ts';
import { logger } from 'shared/logger.ts';

class LLMChatInteraction extends LLMInteraction {
	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
		this._interactionType = 'chat';
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

	public async chat(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {
				model: this.projectConfig.defaultModels!.chat, // AnthropicModel.CLAUDE_3_HAIKU,
				system: '',
				maxTokens: 4096,
			} as LLMSpeakWithOptions;
		}

		this._statementTurnCount++;

		//logger.debug(`chat - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		const messageId = this.addMessageForUserRole({ type: 'text', text: prompt });

		//this.conversationLogger.logAuxiliaryMessage(messageId, null, prompt);

		//speakOptions = { model: this.projectConfig.defaultModels!.chat, ...speakOptions };
		if (!this.model) this.model = this.projectConfig.defaultModels!.chat;
		logger.debug(`ChatInteraction: chat - calling llm.speakWithRetry for ${messageId}`);
		const response = await this.llm.speakWithRetry(this, speakOptions);

		//const msg = extractTextFromContent(response.messageResponse.answerContent);
		//const msg = `<prompt>${prompt}</prompt>\n${response.messageResponse.answer}`;
		const auxiliaryContent: AuxiliaryChatContent = {
			prompt,
			message: response.messageResponse.answer,
			purpose: this.title,
		};

		this.conversationLogger.logAuxiliaryMessage(
			this.getLastMessageId(),
			null,
			auxiliaryContent,
			this.conversationStats,
			this.tokenUsageStats,
		);

		return response;
	}
}

export default LLMChatInteraction;
