import type { LLMCallbacks } from 'api/types.ts';
import type { LLMModelConfig } from 'api/types/llms.ts';
import type {
	CollaborationId,
	InteractionId,
	InteractionMetadata,
	TokenUsageStats,
} from 'shared/types.ts';
import type { CollaborationParams } from 'shared/types/collaboration.types.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import InteractionPersistence from 'api/storage/interactionPersistence.ts';
import CollaborationPersistence from 'api/storage/collaborationPersistence.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/llms/conversationInteraction.ts';
import { logger } from 'shared/logger.ts';
import { generateInteractionId, shortenInteractionId } from 'shared/utils/interactionManagement.utils.ts';

// Ensure ProjectInfo includes projectId
type ExtendedProjectInfo = ProjectInfo & { projectId: string };

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
	private interactions: Map<InteractionId, LLMInteraction> = new Map();
	
	// Usage tracking
	public tokenUsageStats: TokenUsageStats;
	
	// Persistence
	private persistence: CollaborationPersistence;
	private projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo };
	
	// State management
	private initialized: boolean = false;

	constructor(
		id: CollaborationId,
		projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo },
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
		this.projectEditor = projectEditor;
		this.projectId = projectEditor.projectId;
		
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
		
		// Initialize persistence
		this.persistence = new CollaborationPersistence(this.id, this.projectEditor);
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

	async init(): Promise<Collaboration> {
		if (!this.initialized) {
			await this.persistence.init();
			this.initialized = true;
		}
		return this;
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.init();
		}
	}

	// Interaction management methods
	async createInteraction(
		parentInteractionId?: InteractionId,
		interactionCallbacks?: LLMCallbacks,
	): Promise<LLMConversationInteraction> {
		await this.ensureInitialized();
		
		// Generate new interaction ID
		const interactionId = shortenInteractionId(generateInteractionId());
		
		// Create interaction persistence instance
		const interactionPersistence = new InteractionPersistence(
			interactionId,
			this.projectEditor,
			this.id,
			parentInteractionId,
		);
		
		await interactionPersistence.init();

		// Create the interaction instance
		const interaction = new LLMConversationInteraction(interactionId);
		if (interactionCallbacks) {
			// Initialize with default model - this can be overridden later
			const defaultModel = this.collaborationParams.rolesModelConfig.orchestrator?.model || 
				'claude-sonnet-4-20250514';
			await interaction.init(defaultModel, interactionCallbacks);
		}

		// Set collaboration reference
		interaction.collaboration = {
			id: this.id,
			type: this.type,
			collaborationParams: this.collaborationParams,
		};

		// Add to our collections
		this.interactions.set(interactionId, interaction);
		this.addInteractionId(interactionId);

		// Update metadata
		this.lastInteractionId = interactionId;
		this.updatedAt = new Date().toISOString();
		
		// Save the collaboration state
		await this.save();

		logger.info(`Collaboration: Created interaction ${interactionId} for collaboration ${this.id}`);
		return interaction;
	}

	async getInteraction(interactionId: InteractionId): Promise<LLMInteraction | null> {
		await this.ensureInitialized();
		
		// Check if already loaded
		if (this.interactions.has(interactionId)) {
			return this.interactions.get(interactionId)!;
		}

		// Check if it's one of our interaction IDs
		if (!this.interactionIds.includes(interactionId)) {
			return null;
		}

		// Load from persistence
		try {
			const interactionPersistence = new InteractionPersistence(
				interactionId,
				this.projectEditor,
				this.id,
			);
			
			await interactionPersistence.init();
			
			// We need callbacks to load an interaction, but we don't have them here
			// This is a limitation - we might need to pass callbacks or handle this differently
			logger.warn(`Collaboration: Cannot load interaction ${interactionId} without callbacks`);
			return null;
		} catch (error) {
			logger.error(`Collaboration: Failed to load interaction ${interactionId}:`, error);
			return null;
		}
	}

	addInteraction(interaction: LLMInteraction): void {
		this.interactions.set(interaction.id, interaction);
		this.addInteractionId(interaction.id);
		
		// Set collaboration reference if it's a conversation interaction
		if (interaction instanceof LLMConversationInteraction) {
			interaction.collaboration = {
				id: this.id,
				type: this.type,
				collaborationParams: this.collaborationParams,
			};
		}
	}

	removeInteraction(interactionId: InteractionId): boolean {
		const removed = this.interactions.delete(interactionId);
		if (removed) {
			this.interactionIds = this.interactionIds.filter(id => id !== interactionId);
			this.totalInteractions = this.interactionIds.length;
			this.updatedAt = new Date().toISOString();
		}
		return removed;
	}

	private addInteractionId(interactionId: InteractionId): void {
		if (!this.interactionIds.includes(interactionId)) {
			this.interactionIds.push(interactionId);
			this.totalInteractions = this.interactionIds.length;
		}
	}

	getInteractionIds(): InteractionId[] {
		return [...this.interactionIds];
	}

	getLoadedInteractions(): LLMInteraction[] {
		return Array.from(this.interactions.values());
	}

	hasInteraction(interactionId: InteractionId): boolean {
		return this.interactionIds.includes(interactionId);
	}

	// Persistence methods
	async save(): Promise<void> {
		await this.ensureInitialized();
		
		// Update timestamp
		this.updatedAt = new Date().toISOString();
		
		// Prepare metadata for persistence
		const metadata = {
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

		await this.persistence.saveCollaboration(metadata);
		logger.debug(`Collaboration: Saved collaboration ${this.id}`);
	}

	async load(): Promise<boolean> {
		await this.ensureInitialized();
		
		const metadata = await this.persistence.loadCollaboration();
		if (!metadata) {
			return false;
		}

		// Update our properties from loaded metadata
		this.title = metadata.title;
		this.type = metadata.type;
		this.collaborationParams = metadata.collaborationParams;
		this.updatedAt = metadata.updatedAt;
		this.totalInteractions = metadata.totalInteractions;
		this.lastInteractionId = metadata.lastInteractionId;
		this.lastInteractionMetadata = metadata.lastInteractionMetadata;
		this.interactionIds = metadata.interactionIds || [];
		this.tokenUsageStats = metadata.tokenUsageStats;

		logger.debug(`Collaboration: Loaded collaboration ${this.id}`);
		return true;
	}

	async delete(): Promise<void> {
		await this.ensureInitialized();
		
		// Clear in-memory state
		this.interactions.clear();
		this.interactionIds = [];
		this.totalInteractions = 0;
		
		// Delete from persistence
		await this.persistence.deleteCollaboration();
		logger.info(`Collaboration: Deleted collaboration ${this.id}`);
	}

	// Utility methods
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

	// Get summary information
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

	// Static factory methods
	static async create(
		id: CollaborationId,
		projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo },
		options: {
			title?: string;
			type?: 'project' | 'workflow' | 'research';
			collaborationParams?: CollaborationParams;
		} = {}
	): Promise<Collaboration> {
		const collaboration = new Collaboration(id, projectEditor, {
			...options,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		
		await collaboration.init();
		await collaboration.save();
		
		return collaboration;
	}

	static async load(
		id: CollaborationId,
		projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo }
	): Promise<Collaboration | null> {
		const collaboration = new Collaboration(id, projectEditor);
		await collaboration.init();
		
		const loaded = await collaboration.load();
		if (!loaded) {
			return null;
		}
		
		return collaboration;
	}
}