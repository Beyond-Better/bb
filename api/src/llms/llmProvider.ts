import { LLMProvider as LLMProviderEnum } from 'api/types.ts';
import type { LLMCallbacks } from 'api/types.ts';
import type LLM from './providers/baseLLM.ts';
import AnthropicLLM from './providers/anthropicLLM.ts';
import BbLLM from './providers/bbLLM.ts';
import OpenAILLM from './providers/openAILLM.ts';
import DeepseekLLM from './providers/deepseekLLM.ts';
import OllamaLLM from './providers/ollamaLLM.ts';
import GoogleLLM from './providers/googleLLM.ts';

class LLMFactory {
	static getProvider(
		interactionCallbacks: LLMCallbacks,
		llmProviderName: LLMProviderEnum = LLMProviderEnum.ANTHROPIC,
	): LLM {
		switch (llmProviderName) {
			case LLMProviderEnum.BB:
				return new BbLLM(interactionCallbacks);
			case LLMProviderEnum.ANTHROPIC:
				return new AnthropicLLM(interactionCallbacks);
			case LLMProviderEnum.OPENAI:
				return new OpenAILLM(interactionCallbacks);
			case LLMProviderEnum.DEEPSEEK:
				return new DeepseekLLM(interactionCallbacks);
			case LLMProviderEnum.OLLAMA:
				return new OllamaLLM(interactionCallbacks);
			case LLMProviderEnum.GOOGLE:
				return new GoogleLLM(interactionCallbacks);
			default:
				throw new Error(`Unsupported LLM provider: ${llmProviderName}`);
		}
	}
}

export default LLMFactory;
