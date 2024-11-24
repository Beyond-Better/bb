import type { ModelProvider } from '../tool.ts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from 'shared/logger.ts';

export class GeminiProvider implements ModelProvider {
	private client: GoogleGenerativeAI;

	constructor(configApiKey?: string) {
		const apiKey = configApiKey; // || Deno.env.get('GEMINI_API_KEY');

		if (!apiKey) {
			throw new Error('Gemini API key is not set in the config or environment variables.');
		}

		this.client = new GoogleGenerativeAI(apiKey);
	}

	async query(model: string, prompt: string): Promise<string> {
		try {
			const genModel = this.client.getGenerativeModel({ model });
			const result = await genModel.generateContent(prompt);
			const response = result.response;
			return response.text();
		} catch (error) {
			logger.error(
				`LLMToolMultiModelQuery[GeminiProvider]: Error querying Gemini model ${model}:`,
				error as Error,
			);
			throw new Error(`Gemini query failed: ${(error as Error).message}`);
		}
	}
}
