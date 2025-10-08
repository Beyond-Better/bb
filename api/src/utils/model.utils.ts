import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import {
	AnthropicModel,
	DeepSeekModel,
	GoogleModel,
	GroqModel,
	LLMProvider,
	OllamaModel,
	OpenAIModel,
} from 'api/types/llms.ts';

/**
 * Legacy model-to-provider mapping for backwards compatibility
 * This will be populated dynamically by the ModelRegistryService
 * For now, provide static mapping for known models
 */
const staticModelToProvider: Record<string, LLMProvider> = {};

// Populate static mappings
Object.values(AnthropicModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.ANTHROPIC;
});
Object.values(OpenAIModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.OPENAI;
});
Object.values(DeepSeekModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.DEEPSEEK;
});
Object.values(GoogleModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.GOOGLE;
});
Object.values(GroqModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.GROQ;
});
Object.values(OllamaModel).forEach((model) => {
	staticModelToProvider[model] = LLMProvider.OLLAMA;
});

// Export the static mapping (will be enhanced by ModelRegistryService)
export const LLMModelToProvider: Record<string, LLMProvider> = staticModelToProvider;

/**
 * Function to get updated model-to-provider mapping from ModelRegistryService
 * This should be used instead of the static LLMModelToProvider when possible
 */
export async function getLLMModelToProvider(): Promise<Record<string, LLMProvider>> {
	try {
		const registryService = await ModelRegistryService.getInstance();
		return registryService.getModelToProviderMapping();
	} catch (_error) {
		// Fallback to static mapping if service isn't available
		return staticModelToProvider;
	}
}
