import type { ModelProvider } from '../tool.ts';
import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';
import { logger } from 'shared/logger.ts';

export class AnthropicProvider implements ModelProvider {
	private client: Anthropic;

	constructor(configApiKey?: string) {
		const apiKey = configApiKey || Deno.env.get('ANTHROPIC_API_KEY');

		if (!apiKey) {
			throw new Error('Anthropic API key is not set in the config or environment variables.');
		}

		const clientOptions: ClientOptions = { apiKey };
		//logger.info(`LLMToolMultiModelQuery[AnthropicProvider]: creating client with: `, clientOptions);
		this.client = new Anthropic(clientOptions);
	}

	async query(model: string, prompt: string): Promise<string> {
		try {
			const response = await this.client.messages.create({
				model: model,
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 4000,
			});

			const contentBlocks = response.content as Array<Anthropic.TextBlock>;
			return contentBlocks[0].text;
		} catch (error) {
			logger.error(
				`LLMToolMultiModelQuery[AnthropicProvider]: Error querying Anthropic model ${model}:`,
				error as Error,
			);
			throw new Error(`Failed to query Anthropic model ${model}: ${(error as Error).message}`);
		}
	}
}
