import type LLMChatInteraction from 'api/llms/chatInteraction.ts';
//import type { ObjectivesData } from 'shared/types.ts';
import { stripIndents } from 'common-tags';
import type { LLMModelConfig, LLMRolesModelConfig } from 'api/types/llms.ts';
//import { logger } from 'shared/logger.ts';

export async function generateCollaborationTitle(
	chat: LLMChatInteraction,
	prompt: string,
	modelConfig?: LLMModelConfig | null,
): Promise<string> {
	const titlePrompt = stripIndents`
        Create a very short title (max 5 words) for a conversation based on the following prompt:

        <prompt>
        ${prompt.substring(0, 5000)}${prompt.length > 5000 ? '...' : ''}
        </prompt>
        
        Respond with the title only, no additional text.`;
	const response = await chat.chat(titlePrompt, modelConfig);
	return response.messageResponse.answer;
}

export async function generateCollaborationObjective(
	chat: LLMChatInteraction,
	prompt: string,
	modelConfig?: LLMModelConfig | null,
): Promise<string> {
	return generateObjective(chat, prompt, 'collaboration', modelConfig);
}

export async function generateStatementObjective(
	chat: LLMChatInteraction,
	prompt: string,
	modelConfig?: LLMModelConfig | null,
	collaborationGoal?: string,
	previousAssistantResponse?: string,
	previousObjective?: string,
): Promise<string> {
	const objective = await generateObjective(
		chat,
		prompt,
		'statement',
		modelConfig,
		collaborationGoal,
		previousAssistantResponse,
	);

	// Check if more context is needed
	if (objective.startsWith('NEED_CONTEXT:')) {
		// If we already have a previous response but still need context, return a more specific objective
		if (previousObjective) {
			// For simple responses or instructions about objectives, maintain the previous objective
			const msg = `Continue the current task based on the previous objective: ${previousObjective}`;
			chat.collaborationLogger.logAuxiliaryMessage(
				chat.getLastMessageId(),
				null, // only orchestrator creates statement objectives
				null, // only orchestrator creates statement objectives
				{
					message: `Using previous objective:\n${msg}`,
					purpose: 'Using previous context for Objective',
				},
			);
			return msg;
		} else {
			// Otherwise, create a context-gathering objective
			const neededContext = objective.substring('NEED_CONTEXT:'.length).trim();
			const msg = `Gather context about ${neededContext} to proceed with the task`;
			chat.collaborationLogger.logAuxiliaryMessage(
				chat.getLastMessageId(),
				null, // only orchestrator creates statement objectives
				null, // only orchestrator creates statement objectives
				{
					message: msg,
					purpose: 'Need more context for Objective',
				},
			);
			return msg;
		}
	}

	return objective;
}

export async function generateObjective(
	chat: LLMChatInteraction,
	prompt: string,
	type: 'collaboration' | 'statement',
	modelConfig?: LLMModelConfig | null,
	collaborationGoal?: string,
	previousAssistantResponse?: string,
): Promise<string> {
	const objectiveType = type === 'collaboration' ? 'collaboration goal' : 'task objective';
	const objectivePrompt = stripIndents`
		Analyze this statement and provide ${
		type === 'collaboration' ? 'an overall collaboration goal' : 'an immediate task objective'
	}.

		Guidelines for objective generation:
		1. Be specific and actionable - avoid vague terms like "analyze" or "check" without context
		2. Include both the action and the target of the action
		${
		type === 'collaboration'
			? `3. Ensure the objective captures the overall purpose of the collaboration`
			: `3. Only respond with "NEED_CONTEXT: [specific context needed]" if:
		   - The prompt is extremely vague (1-2 words without clear intent)
		   - OR there is no collaboration goal provided
		4. Previous assistant response is optional and should not trigger NEED_CONTEXT
		5. Ensure the objective aligns with the collaboration goal`
	}${
		collaborationGoal
			? `\n<overall_collaboration_goal>\n${collaborationGoal}\n</overall_collaboration_goal>\n`
			: ''
	}${
		previousAssistantResponse
			? `\n<previous_assistant_response>\n${previousAssistantResponse.substring(0, 2500)}${
				previousAssistantResponse.length > 2500 ? '...' : ''
			}\n</previous_assistant_response>\n`
			: ''
	}
		<user_statement>\n${prompt.substring(0, 2500)}${prompt.length > 2500 ? '...' : ''}\n</user_statement>

		${
		type === 'collaboration'
			? `Respond with a specific ${objectiveType}, without a leading label`
			: `Respond with EITHER:
		1. A specific ${objectiveType}, without a leading label
		2. OR "NEED_CONTEXT: [specific context needed]"`
	}
		No additional text.`;

	//logger.info('CollaborationUtils: generateObjective', { title: chat.title });
	const response = await chat.chat(objectivePrompt, modelConfig);
	return response.messageResponse.answer;
}
