import { LLMProvider as LLMProviderEnum } from 'api/types.ts';
import type { LLMCallbacks } from '../types.ts';
import type LLM from './providers/baseLLM.ts';
import AnthropicLLM from './providers/anthropicLLM.ts';
//import OpenAILLM from './providers/openAILLM.ts';

class LLMFactory {
	static getProvider(
		interactionCallbacks: LLMCallbacks,
		llmProviderName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC,
	): LLM {
		switch (llmProviderName) {
			case LLMProviderEnum.ANTHROPIC:
				return new AnthropicLLM(interactionCallbacks);
			// case LLMProviderEnum.OPENAI:
			// 	return new OpenAILLM(callbacks);
			default:
				throw new Error(`Unsupported LLM provider: ${llmProviderName}`);
		}
	}
}

export default LLMFactory;
