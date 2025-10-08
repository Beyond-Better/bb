import LLMInteraction from 'api/llms/baseInteraction.ts';
//import type { AnthropicModel } from 'api/types.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { InteractionId } from 'shared/types.ts';
import type { AuxiliaryChatContent } from 'api/logEntries/types.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMMessageContentPart, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
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
		prompt: string | LLMMessageContentPart | LLMMessageContentParts,
		speakOptions?: LLMSpeakWithOptions | null,
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
		// Handle different prompt types for multi-modal support
		let messageContent: LLMMessageContentParts;
		if (typeof prompt === 'string') {
			messageContent = [{ type: 'text', text: prompt }];
		} else if (Array.isArray(prompt)) {
			messageContent = prompt;
		} else {
			messageContent = [prompt];
		}

		const messageId = this.addMessageForUserRole(messageContent);

		//this.collaborationLogger.logAuxiliaryMessage(messageId, null, null, prompt);

		//speakOptions = { model: this.projectConfig.defaultModels!.chat, ...speakOptions };
		if (speakOptions.model) this.model = speakOptions.model;
		if (!this.model) this.model = this.projectConfig.defaultModels!.chat || DefaultModelsConfigDefaults.chat;
		logger.debug(`ChatInteraction: chat - calling llm.speakWithRetry for ${messageId}`);
		const response = await this.llm.speakWithRetry(this, speakOptions);

		// Include the latest modelConfig in the saved interaction
		this.modelConfig = response.messageMeta.llmRequestParams.modelConfig;

		//logger.info(`ChatInteraction: saving chat interaction`, { id: this.id, title: this.title, answer: response.messageResponse.answer  });
		await this.saveInteraction(response);

		//const msg = extractTextFromContent(response.messageResponse.answerContent);
		//const msg = `<prompt>${prompt}</prompt>\n${response.messageResponse.answer}`;
		// Convert prompt to string for logging
		const promptText = typeof prompt === 'string'
			? prompt
			: Array.isArray(prompt)
			? prompt.map((p) => p.type === 'text' ? p.text : `[${p.type}]`).join(' ')
			: prompt.type === 'text'
			? prompt.text
			: `[${prompt.type}]`;

		const auxiliaryContent: AuxiliaryChatContent = {
			prompt: promptText,
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
