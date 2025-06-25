import LLMInteraction from 'api/llms/baseInteraction.ts';
//import type { AnthropicModel } from 'api/types.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { InteractionId } from 'shared/types.ts';
import type { AuxiliaryChatContent } from 'api/logEntries/types.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
//import type { LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
//import { extractTextFromContent } from 'api/utils/llms.ts';
import { logger } from 'shared/logger.ts';
import type Collaboration from 'api/collaborations/collaboration.ts';

class LLMChatInteraction extends LLMInteraction {
	constructor(collaboration: Collaboration, interactionId?: InteractionId) {
		super(collaboration, interactionId);
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
				model: this.projectConfig.defaultModels!.chat, // 'claude-3-haiku-20240307',
				system: '',
				maxTokens: 4096,
			} as LLMSpeakWithOptions;
		}

		this._statementTurnCount++;

		//logger.debug(`chat - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		const messageId = this.addMessageForUserRole({ type: 'text', text: prompt });

		//this.collaborationLogger.logAuxiliaryMessage(messageId, null, null, prompt);

		//speakOptions = { model: this.projectConfig.defaultModels!.chat, ...speakOptions };
		if (speakOptions.model) this.model = speakOptions.model;
		if (!this.model) this.model = this.projectConfig.defaultModels!.chat || DefaultModelsConfigDefaults.chat;
		logger.debug(`ChatInteraction: chat - calling llm.speakWithRetry for ${messageId}`);
		const response = await this.llm.speakWithRetry(this, speakOptions);

		//logger.info(`ChatInteraction: saving chat interaction`, { id: this.id, title: this.title, answer: response.messageResponse.answer  });
		await this.saveInteraction(response);

		//const msg = extractTextFromContent(response.messageResponse.answerContent);
		//const msg = `<prompt>${prompt}</prompt>\n${response.messageResponse.answer}`;
		const auxiliaryContent: AuxiliaryChatContent = {
			prompt,
			message: response.messageResponse.answer,
			purpose: this.title || '',
		};

		this.collaborationLogger.logAuxiliaryMessage(
			this.getLastMessageId(),
			null,
			null,
			auxiliaryContent,
			this.interactionStats,
			{
				...this.tokenUsageStatsForInteraction,
				tokenUsageCollaboration: this.collaboration.tokenUsageCollaboration,
			},
		);

		return response;
	}
}

export default LLMChatInteraction;
