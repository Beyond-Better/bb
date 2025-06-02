export interface DefaultModels {
	orchestrator: string;
	agent: string;
	chat: string;
}

export interface DefaultModelsPartial {
	orchestrator?: string;
	agent?: string;
	chat?: string;
}

export const DefaultModelsConfigDefaults: Readonly<DefaultModels> = {
	orchestrator: 'claude-sonnet-4-20250514',
	agent: 'claude-sonnet-4-20250514',
	chat: 'claude-3-5-haiku-20241022',
};
