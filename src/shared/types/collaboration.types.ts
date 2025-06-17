import { type LLMRolesModelConfig } from 'api/types/llms.ts';

// [TODO] temporary interface until full class is defined
export interface Collaboration {
	id: string;
	//ownerId: string;

	type: 'project' | 'workflow' | 'research';
	title?: string;

	collaborationParams: CollaborationParams;
}

export interface CollaborationParams {
	rolesModelConfig: LLMRolesModelConfig;
}

export interface StatementParams {
	objective?: string;

	rolesModelConfig: LLMRolesModelConfig;
}
