export enum LLMProvider {
	ANTHROPIC = 'anthropic',
	GOOGLE = 'google',
	OPENAI = 'openai',
	GROQ = 'groq',
}

export enum AnthropicModel {
	CLAUDE_3_OPUS = 'claude-3-opus-20240229',
	CLAUDE_3_SONNET = 'claude-3-sonnet-20240229',
	CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
	CLAUDE_4_0_SONNET = 'claude-3-5-sonnet-20240620',
}

export enum GoogleModel {
	GOOGLE_GEMINI_2_5_FLASH = 'gemini-1.5-flash',
	GOOGLE_GEMINI_2_5_PRO = 'gemini-1.5-pro',
}

export enum OpenAIModel {
	GPT_4_TURBO = 'gpt-4-turbo',
	GPT_4_O = 'gpt-4o',
	GPT_3_5_TURBO = 'gpt-3.5-turbo',
}

export enum GroqModel {
	LLAMA3_8B = 'llama3-8b-8192',
	LLAMA3_70B = 'llama3-70b-8192',
	MIXTRAL_8X7B = 'mixtral-8x7b-32768',
}

export type Model = AnthropicModel | GoogleModel | OpenAIModel | GroqModel;
