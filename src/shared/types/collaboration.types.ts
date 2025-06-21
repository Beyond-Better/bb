import { type LLMRolesModelConfig } from 'api/types/llms.ts';
import type {
	CollaborationId,
	CollaborationType,
	InteractionId,
	InteractionMetadata,
	ProjectId,
	TokenUsageStats,
} from 'shared/types.ts';

// Full collaboration interface matching the Collaboration class
export interface CollaborationInterface {
	// Core identification
	readonly id: CollaborationId;
	title: string;
	type: CollaborationType;

	// Configuration
	collaborationParams: CollaborationParams;

	// Project association
	readonly projectId: ProjectId;

	// Interaction management
	totalInteractions: number;
	lastInteractionId?: InteractionId;
	lastInteractionMetadata?: InteractionMetadata;

	// Usage tracking
	tokenUsageStats: TokenUsageStats;

	// Timestamps
	readonly createdAt: string;
	updatedAt: string;
}

// For JSON transfer
export interface CollaborationValues {
	id: CollaborationId;
	projectId: ProjectId;
	title: string;
	type: CollaborationType;
	collaborationParams: CollaborationParams;
	totalInteractions: number;
	lastInteractionId?: InteractionId;
	lastInteractionMetadata?: InteractionMetadata;
	interactionIds: InteractionId[];
	tokenUsageStats: TokenUsageStats;
	createdAt: string;
	updatedAt: string;
}

// Legacy interface for backward compatibility
// @deprecated Use CollaborationInterface instead
//export interface Collaboration {
//	id: string;
//	type: CollaborationType;
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
	type?: CollaborationType;
	collaborationParams?: CollaborationParams;
}

// Summary information for listing collaborations
export interface CollaborationSummary {
	id: CollaborationId;
	title: string;
	type: CollaborationType;
	projectId: ProjectId;
	totalInteractions: number;
	createdAt: string;
	updatedAt: string;
	lastInteractionId?: InteractionId;
}
