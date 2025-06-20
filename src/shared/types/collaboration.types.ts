import { type LLMRolesModelConfig } from 'api/types/llms.ts';
import type {
	CollaborationId,
	InteractionId,
	InteractionMetadata,
	TokenUsageStats,
} from 'shared/types.ts';

// Full collaboration interface matching the Collaboration class
export interface CollaborationInterface {
	// Core identification
	readonly id: CollaborationId;
	title: string;
	type: 'project' | 'workflow' | 'research';
	
	// Configuration
	collaborationParams: CollaborationParams;
	
	// Timestamps
	readonly createdAt: string;
	updatedAt: string;
	
	// Project association
	readonly projectId: string;
	
	// Interaction management
	totalInteractions: number;
	lastInteractionId?: InteractionId;
	lastInteractionMetadata?: InteractionMetadata;
	
	// Usage tracking
	tokenUsageStats: TokenUsageStats;
}

// Legacy interface for backward compatibility
// @deprecated Use CollaborationInterface instead
//export interface Collaboration {
//	id: string;
//	type: 'project' | 'workflow' | 'research';
//	title?: string;
//	collaborationParams: CollaborationParams;
//}

export interface CollaborationParams {
	rolesModelConfig: LLMRolesModelConfig;
}

export interface StatementParams {
	objective?: string;
	rolesModelConfig: LLMRolesModelConfig;
}

// Creation options for new collaborations
export interface CollaborationCreateOptions {
	id?: CollaborationId;
	title?: string;
	type?: 'project' | 'workflow' | 'research';
	collaborationParams?: CollaborationParams;
}

// Summary information for listing collaborations
export interface CollaborationSummary {
	id: CollaborationId;
	title: string;
	type: 'project' | 'workflow' | 'research';
	projectId: string;
	totalInteractions: number;
	createdAt: string;
	updatedAt: string;
	lastInteractionId?: InteractionId;
}
