import type { ModelProvider } from '../tool.ts';
import OpenAI from 'openai';
import { logger } from 'shared/logger.ts';

export class OpenAIProvider implements ModelProvider {
	private client: OpenAI;

	constructor(configApiKey?: string) {
		const apiKey = configApiKey || Deno.env.get('OPENAI_API_KEY');

		if (!apiKey) {
			throw new Error('OpenAI API key is not set in the config or environment variables.');
		}

		this.client = new OpenAI({ apiKey });
	}

	async query(model: string, prompt: string): Promise<string> {
		try {
			const response = await this.client.chat.completions.create({
				model: model,
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 4000,
			});

			return response.choices[0].message.content || '';
		} catch (error) {
			logger.error(
				`LLMToolMultiModelQuery[OpenAIProvider]: Error querying OpenAI model ${model}:`,
				error as Error,
			);
			throw new Error(`Failed to query OpenAI model ${model}: ${(error as Error).message}`);
		}
	}
}
