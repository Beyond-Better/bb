import type LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
//import type { ObjectivesData } from 'shared/types.ts';
import { stripIndents } from 'common-tags';
import { logger } from 'shared/logger.ts';

export async function generateConversationTitle(chat: LLMChatInteraction, prompt: string): Promise<string> {
	const titlePrompt = stripIndents`
        Create a very short title (max 5 words) for a conversation based on the following prompt:
        "${prompt.substring(0, 1500)}${prompt.length > 1500 ? '...' : ''}"
        
        Respond with the title only, no additional text.`;
	const response = await chat.chat(titlePrompt);
	const contentPart = response.messageResponse.answerContent[0] as { type: 'text'; text: string };
	return contentPart.text.trim();
}

export async function generateConversationObjective(chat: LLMChatInteraction, prompt: string): Promise<string> {
	return generateObjective(chat, prompt, 'conversation');
}

export async function generateStatementObjective(
	chat: LLMChatInteraction,
	prompt: string,
	conversationGoal?: string,
	previousAssistantResponse?: string,
	previousObjective?: string,
): Promise<string> {
	const objective = await generateObjective(chat, prompt, 'statement', conversationGoal, previousAssistantResponse);

	// Check if more context is needed
	if (objective.startsWith('NEED_CONTEXT:')) {
		// If we already have a previous response but still need context, return a more specific objective
		if (previousObjective) {
			// For simple responses or instructions about objectives, maintain the previous objective
			const msg = `Continue the current task based on the previous objective: ${previousObjective}`;
			chat.conversationLogger.logAuxiliaryMessage(chat.getLastMessageId(), `Using previous objective:\n${msg}`);
			return msg;
		} else {
			// Otherwise, create a context-gathering objective
			const neededContext = objective.substring('NEED_CONTEXT:'.length).trim();
			const msg = `Gather context about ${neededContext} to proceed with the task`;
			chat.conversationLogger.logAuxiliaryMessage(chat.getLastMessageId(), msg);
			return msg;
		}
	}

	return objective;
}

export async function generateObjective(
	chat: LLMChatInteraction,
	prompt: string,
	type: 'conversation' | 'statement',
	conversationGoal?: string,
	previousAssistantResponse?: string,
): Promise<string> {
	const objectiveType = type === 'conversation' ? 'conversation goal' : 'task objective';
	const objectivePrompt = stripIndents`
		Analyze this statement and provide ${
		type === 'conversation' ? 'an overall conversation goal' : 'an immediate task objective'
	}.

		Guidelines for objective generation:
		1. Be specific and actionable - avoid vague terms like "analyze" or "check" without context
		2. Include both the action and the target of the action
		${
		type === 'conversation'
			? `3. Ensure the objective captures the overall purpose of the conversation`
			: `3. Only respond with "NEED_CONTEXT: [specific context needed]" if:
		   - The prompt is extremely vague (1-2 words without clear intent)
		   - OR there is no conversation goal provided
		4. Previous assistant response is optional and should not trigger NEED_CONTEXT
		5. Ensure the objective aligns with the conversation goal`
	}

		${conversationGoal ? `<overall_conversation_goal>\n${conversationGoal}\n</overall_conversation_goal>` : ''}
		${
		previousAssistantResponse
			? `<previous_assistant_response>\n${previousAssistantResponse.substring(0, 2500)}${
				previousAssistantResponse.length > 2500 ? '...' : ''
			}\n</previous_assistant_response>`
			: ''
	}

		<user_statement>\n${prompt.substring(0, 2500)}${prompt.length > 2500 ? '...' : ''}\n</user_statement>

		${
		type === 'conversation'
			? `Respond with a specific ${objectiveType}, without a leading label`
			: `Respond with EITHER:
		1. A specific ${objectiveType}, without a leading label
		2. OR "NEED_CONTEXT: [specific context needed]"`
	}
		No additional text.`;

	const response = await chat.chat(objectivePrompt);
	const contentPart = response.messageResponse.answerContent[0] as { type: 'text'; text: string };
	return contentPart.text.trim();
}
