import type {
	CollaborationId,
	InteractionId,
	InteractionMetadata,
	TokenUsageStats,
} from 'shared/types.ts';
import type { CollaborationParams } from 'shared/types/collaboration.types.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import { logger } from 'shared/logger.ts';

export default class Collaboration {
	// Core identification
	public readonly id: CollaborationId;
	public title: string;
	public type: 'project' | 'workflow' | 'research';
	
	// Configuration
	public collaborationParams: CollaborationParams;
	
	// Timestamps
	public readonly createdAt: string;
	public updatedAt: string;
	
	// Project association
	public readonly projectId: string;
	
	// Interaction management
	public totalInteractions: number;
	public lastInteractionId?: InteractionId;
	public lastInteractionMetadata?: InteractionMetadata;
	private interactionIds: InteractionId[] = [];
	private loadedInteractions: Map<InteractionId, LLMInteraction> = new Map();
	
	// Usage tracking
	public tokenUsageStats: TokenUsageStats;

	constructor(
		id: CollaborationId,
		projectId: string,
		options: {
			title?: string;
			type?: 'project' | 'workflow' | 'research';
			collaborationParams?: CollaborationParams;
			createdAt?: string;
			updatedAt?: string;
			totalInteractions?: number;
			lastInteractionId?: InteractionId;
			lastInteractionMetadata?: InteractionMetadata;
			interactionIds?: InteractionId[];
			tokenUsageStats?: TokenUsageStats;
		} = {}
	) {
		this.id = id;
		this.projectId = projectId;
		
		// Initialize with provided options or defaults
		this.title = options.title || 'New Collaboration';
		this.type = options.type || 'project';
		this.collaborationParams = options.collaborationParams || this.getDefaultCollaborationParams();
		this.createdAt = options.createdAt || new Date().toISOString();
		this.updatedAt = options.updatedAt || new Date().toISOString();
		this.totalInteractions = options.totalInteractions || 0;
		this.lastInteractionId = options.lastInteractionId;
		this.lastInteractionMetadata = options.lastInteractionMetadata;
		this.interactionIds = options.interactionIds || [];
		this.tokenUsageStats = options.tokenUsageStats || this.getDefaultTokenUsageStats();
	}

	private getDefaultCollaborationParams(): CollaborationParams {
		return {
			rolesModelConfig: {
				orchestrator: null,
				agent: null,
				chat: null,
			},
		};
	}

	private getDefaultTokenUsageStats(): TokenUsageStats {
		return {
			tokenUsageInteraction: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				thoughtTokens: 0,
				totalAllTokens: 0,
			},
			tokenUsageStatement: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				thoughtTokens: 0,
				totalAllTokens: 0,
			},
			tokenUsageTurn: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				thoughtTokens: 0,
				totalAllTokens: 0,
			},
		};
	}

	// Interaction ID management
	addInteractionId(interactionId: InteractionId): void {
		if (!this.interactionIds.includes(interactionId)) {
			this.interactionIds.push(interactionId);
			this.totalInteractions = this.interactionIds.length;
			this.lastInteractionId = interactionId;
			this.updatedAt = new Date().toISOString();
		}
	}

	removeInteractionId(interactionId: InteractionId): boolean {
		const index = this.interactionIds.indexOf(interactionId);
		if (index !== -1) {
			this.interactionIds.splice(index, 1);
			this.totalInteractions = this.interactionIds.length;
			this.loadedInteractions.delete(interactionId);
			
			// Update lastInteractionId if we removed the last one
			if (this.lastInteractionId === interactionId) {
				this.lastInteractionId = this.interactionIds.length > 0 
					? this.interactionIds[this.interactionIds.length - 1] 
					: undefined;
			}
			
			this.updatedAt = new Date().toISOString();
			return true;
		}
		return false;
	}

	getInteractionIds(): InteractionId[] {
		return [...this.interactionIds];
	}

	hasInteraction(interactionId: InteractionId): boolean {
		return this.interactionIds.includes(interactionId);
	}

	// Loaded interaction management (cache)
	addLoadedInteraction(interaction: LLMInteraction): void {
		this.loadedInteractions.set(interaction.id, interaction);
		
		// Ensure the interaction ID is tracked
		this.addInteractionId(interaction.id);
		
		// Set collaboration reference if it's a conversation interaction
		if ('collaboration' in interaction) {
			(interaction as any).collaboration = {
				id: this.id,
				type: this.type,
				collaborationParams: this.collaborationParams,
			};
		}
		
		logger.debug(`Collaboration: Added loaded interaction ${interaction.id} to collaboration ${this.id}`);
	}

	getLoadedInteraction(interactionId: InteractionId): LLMInteraction | undefined {
		return this.loadedInteractions.get(interactionId);
	}

	removeLoadedInteraction(interactionId: InteractionId): boolean {
		return this.loadedInteractions.delete(interactionId);
	}

	getLoadedInteractions(): LLMInteraction[] {
		return Array.from(this.loadedInteractions.values());
	}

	getLoadedInteractionIds(): InteractionId[] {
		return Array.from(this.loadedInteractions.keys());
	}

	// State management methods
	updateTitle(title: string): void {
		this.title = title;
		this.updatedAt = new Date().toISOString();
	}

	updateCollaborationParams(params: Partial<CollaborationParams>): void {
		this.collaborationParams = { ...this.collaborationParams, ...params };
		this.updatedAt = new Date().toISOString();
	}

	updateTokenUsageStats(stats: Partial<TokenUsageStats>): void {
		this.tokenUsageStats = { ...this.tokenUsageStats, ...stats };
		this.updatedAt = new Date().toISOString();
	}

	updateLastInteractionMetadata(metadata: InteractionMetadata): void {
		this.lastInteractionMetadata = {
			llmProviderName: metadata.llmProviderName,
			model: metadata.model,
			updatedAt: metadata.updatedAt,
		};
		this.updatedAt = new Date().toISOString();
	}

	// Conversion methods for persistence
	toMetadata() {
		return {
			id: this.id,
			title: this.title,
			type: this.type,
			collaborationParams: this.collaborationParams,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
			projectId: this.projectId,
			totalInteractions: this.totalInteractions,
			lastInteractionId: this.lastInteractionId,
			lastInteractionMetadata: this.lastInteractionMetadata,
			interactionIds: this.interactionIds,
			tokenUsageStats: this.tokenUsageStats,
		};
	}

	static fromMetadata(metadata: {
		id: CollaborationId;
		title: string;
		type: 'project' | 'workflow' | 'research';
		collaborationParams: CollaborationParams;
		createdAt: string;
		updatedAt: string;
		projectId: string;
		totalInteractions: number;
		lastInteractionId?: InteractionId;
		lastInteractionMetadata?: InteractionMetadata;
		interactionIds: InteractionId[];
		tokenUsageStats: TokenUsageStats;
	}): Collaboration {
		return new Collaboration(metadata.id, metadata.projectId, {
			title: metadata.title,
			type: metadata.type,
			collaborationParams: metadata.collaborationParams,
			createdAt: metadata.createdAt,
			updatedAt: metadata.updatedAt,
			totalInteractions: metadata.totalInteractions,
			lastInteractionId: metadata.lastInteractionId,
			lastInteractionMetadata: metadata.lastInteractionMetadata,
			interactionIds: metadata.interactionIds,
			tokenUsageStats: metadata.tokenUsageStats,
		});
	}

	// Utility methods
	getSummary() {
		return {
			id: this.id,
			title: this.title,
			type: this.type,
			projectId: this.projectId,
			totalInteractions: this.totalInteractions,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
			lastInteractionId: this.lastInteractionId,
		};
	}

	// Static factory method for new collaborations
	static create(
		id: CollaborationId,
		projectId: string,
		options: {
			title?: string;
			type?: 'project' | 'workflow' | 'research';
			collaborationParams?: CollaborationParams;
		} = {}
	): Collaboration {
		return new Collaboration(id, projectId, {
			...options,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}
}