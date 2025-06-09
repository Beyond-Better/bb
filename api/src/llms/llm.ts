import { LLMProvider } from 'api/types.ts';
import type { LLMCallbacks } from 'api/types.ts';
import AnthropicLLM from './providers/anthropicLLM.ts';
import GoogleLLM from './providers/googleLLM.ts';
import GroqLLM from './providers/groqLLM.ts';
import OpenAI from './providers/openaiLLM.ts';
import type LLM from './providers/baseLLM.ts';

export function createLLM(
	provider: LLMProvider,
	callbacks: LLMCallbacks,
): LLM {
	switch (provider) {
		case LLMProvider.ANTHROPIC:
			return new AnthropicLLM(callbacks);
		case LLMProvider.GOOGLE:
			return new GoogleLLM(callbacks);
		case LLMProvider.GROQ:
			return new GroqLLM(callbacks);
		case LLMProvider.OPENAI:
			return new OpenAI(callbacks);
		default:
			throw new Error(`Unsupported LLM provider: ${provider}`);
	}
}
