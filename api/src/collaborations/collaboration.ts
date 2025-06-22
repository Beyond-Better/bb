import type {
	CollaborationId,
	CollaborationType,
	InteractionId,
	InteractionMetadata,
	ProjectId,
	TokenUsage,
} from 'shared/types.ts';
import type { CollaborationParams, CollaborationSummary, CollaborationValues } from 'shared/types/collaboration.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import { logger } from 'shared/logger.ts';

export default class Collaboration {
	// Core identification
	public readonly id: CollaborationId;
	public title: string;
	public type: CollaborationType;

	// Configuration
	public collaborationParams: CollaborationParams;

	// Timestamps
	public readonly createdAt: string;
	public updatedAt: string;

	// Project association
	public readonly projectId: ProjectId;

	// Interaction management
	public totalInteractions: number;
	public lastInteractionId?: InteractionId;
	public lastInteractionMetadata?: InteractionMetadata;
	private _interactionIds: InteractionId[] = [];
	private _loadedInteractions: Map<InteractionId, LLMInteraction> = new Map();

	// Usage tracking
	public tokenUsageCollaboration: TokenUsage;

	constructor(
		id: CollaborationId,
		projectId: ProjectId,
		options: {
			title?: string;
			type?: CollaborationType;
			collaborationParams?: CollaborationParams;
			createdAt?: string;
			updatedAt?: string;
			totalInteractions?: number;
			lastInteractionId?: InteractionId;
			lastInteractionMetadata?: InteractionMetadata;
			interactionIds?: InteractionId[];
			tokenUsageCollaboration?: TokenUsage;
		} = {},
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
		this._interactionIds = options.interactionIds || [];
		this.tokenUsageCollaboration = options.tokenUsageCollaboration || this.getDefaultTokenUsage();
	}

	async init(): Promise<Collaboration> {
		return this;
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

	private getDefaultTokenUsage(): TokenUsage {
		return {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			cacheCreationInputTokens: 0,
			cacheReadInputTokens: 0,
			thoughtTokens: 0,
			totalAllTokens: 0,
		};
	}

	public get interactionIds(): InteractionId[] {
		return [...this._interactionIds];
	}
	// public get loadedInteractions(): Map<InteractionId, LLMInteraction> {
	// 	return this._loadedInteractions;
	// }

	// Interaction ID management
	addInteractionId(interactionId: InteractionId): void {
		if (!this._interactionIds.includes(interactionId)) {
			this._interactionIds.push(interactionId);
			this.totalInteractions = this._interactionIds.length;
			this.lastInteractionId = interactionId;
			this.updatedAt = new Date().toISOString();
		}
	}

	removeInteractionId(interactionId: InteractionId): boolean {
		const index = this._interactionIds.indexOf(interactionId);
		if (index !== -1) {
			this._interactionIds.splice(index, 1);
			this.totalInteractions = this._interactionIds.length;
			this._loadedInteractions.delete(interactionId);

			// Update lastInteractionId if we removed the last one
			if (this.lastInteractionId === interactionId) {
				this.lastInteractionId = this._interactionIds.length > 0
					? this._interactionIds[this._interactionIds.length - 1]
					: undefined;
			}

			this.updatedAt = new Date().toISOString();
			return true;
		}
		return false;
	}

	getInteractionIds(): InteractionId[] {
		return [...this._interactionIds];
	}

	hasInteraction(interactionId: InteractionId): boolean {
		return this._interactionIds.includes(interactionId);
	}

	// Loaded interaction management (cache)
	addLoadedInteraction(interaction: LLMInteraction): void {
		this._loadedInteractions.set(interaction.id, interaction);

		// Ensure the interaction ID is tracked
		this.addInteractionId(interaction.id);

		// Set collaboration reference if it's a conversation interaction
		if ('collaboration' in interaction) {
			interaction.collaboration = this; // the getter in LLMInteraction makes collaboration a weak reference
		}

		logger.debug(`Collaboration: Added loaded interaction ${interaction.id} to collaboration ${this.id}`);
	}

	getLoadedInteraction(interactionId: InteractionId): LLMInteraction | undefined {
		return this._loadedInteractions.get(interactionId);
	}

	removeLoadedInteraction(interactionId: InteractionId): boolean {
		return this._loadedInteractions.delete(interactionId);
	}

	getLoadedInteractions(): LLMInteraction[] {
		return Array.from(this._loadedInteractions.values());
	}

	getLoadedInteractionIds(): InteractionId[] {
		return Array.from(this._loadedInteractions.keys());
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

	updateTokenUsageCollaboration(usage: Partial<TokenUsage>): void {
		this.tokenUsageCollaboration = { ...this.tokenUsageCollaboration, ...usage };
		this.updatedAt = new Date().toISOString();
	}

	updateLastInteractionMetadata(metadata: InteractionMetadata): void {
		this.lastInteractionMetadata = metadata;
		this.updatedAt = new Date().toISOString();
	}

	// Conversion methods for persistence
	toJSON(): CollaborationValues {
		return {
			id: this.id,
			title: this.title,
			type: this.type,
			projectId: this.projectId,
			collaborationParams: this.collaborationParams,
			totalInteractions: this.totalInteractions,
			interactionIds: this.interactionIds,
			lastInteractionId: this.lastInteractionId,
			lastInteractionMetadata: this.lastInteractionMetadata,
			tokenUsageCollaboration: this.tokenUsageCollaboration,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}

	static fromJSON(values: CollaborationValues): Collaboration {
		return new Collaboration(values.id, values.projectId, {
			title: values.title,
			type: values.type,
			collaborationParams: values.collaborationParams,
			totalInteractions: values.totalInteractions,
			interactionIds: values.interactionIds,
			lastInteractionId: values.lastInteractionId,
			lastInteractionMetadata: values.lastInteractionMetadata,
			tokenUsageCollaboration: values.tokenUsageCollaboration,
			createdAt: values.createdAt,
			updatedAt: values.updatedAt,
		});
	}

	// Utility methods
	getSummary(): CollaborationSummary {
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
		projectId: ProjectId,
		options: {
			title?: string;
			type?: CollaborationType;
			collaborationParams?: CollaborationParams;
		} = {},
	): Collaboration {
		return new Collaboration(id, projectId, {
			...options,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}
}
