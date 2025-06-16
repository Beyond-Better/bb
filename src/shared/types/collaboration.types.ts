import { type LLMRolesModelConfig } from 'api/types/llms.ts';

export interface CollaborationParams {
	type: 'project' | 'workflow' | 'research'; 
	title?: string;

	/**
	 * Role-specific model configurations
	 */
	rolesModelConfig: LLMRolesModelConfig;
	
}

export interface StatementParams {
	objective?: string;

	rolesModelConfig: LLMRolesModelConfig;
	
}

