export interface ProjectConfig {
	api?: {
		llmProviders?: {
			anthropic?: {
				apiKey: string;
			};
			google?: {
				apiKey: string;
			};
			openai?: {
				apiKey: string;
			};
			groq?: {
				apiKey: string;
			};
		};
	};
}
