import type { CollaborationId, CollaborationType, InteractionId, ProjectId } from 'shared/types.ts';
import type { CollaborationParams } from 'shared/types/collaboration.ts';
import Collaboration from './collaboration.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import { logger } from 'shared/logger.ts';

class CollaborationManager {
	private collaborations: Map<CollaborationId, Collaboration> = new Map();
	private collaborationResults: Map<CollaborationId, unknown> = new Map();

	async createCollaboration(
		collaborationId: CollaborationId,
		projectId: ProjectId,
		type: CollaborationType = 'project',
		title?: string,
		collaborationParams?: CollaborationParams,
	): Promise<Collaboration> {
		//const collaborationId = shortenCollaborationId(generateCollaborationId());
		let collaboration: Collaboration;

		logger.info('CollaborationManager: Creating collaboration of type: ', type);

		collaboration = await new Collaboration(
			collaborationId,
			projectId,
			{
				title,
				type,
				collaborationParams,
			},
		).init();

		this.collaborations.set(collaborationId, collaboration);

		return collaboration;
	}

	// Basic collaboration management
	addCollaboration(collaboration: Collaboration): void {
		this.collaborations.set(collaboration.id, collaboration);
		logger.debug(`CollaborationManager: Added collaboration ${collaboration.id}`);
	}

	getCollaboration(id: CollaborationId): Collaboration | undefined {
		const collaboration = this.collaborations.get(id);
		if (!collaboration) {
			logger.warn(`CollaborationManager: Could not get collaboration with id ${id}`);
		}
		return collaboration;
	}

	getCollaborationStrict(id: CollaborationId): Collaboration {
		return this.getCollaborationOrThrow(id);
	}

	private getCollaborationOrThrow(id: CollaborationId): Collaboration {
		const collaboration = this.getCollaboration(id);
		if (!collaboration) {
			throw new Error(`Collaboration with id ${id} not found`);
		}
		return collaboration;
	}

	removeCollaboration(id: CollaborationId): boolean {
		const removed = this.collaborations.delete(id);
		this.collaborationResults.delete(id);

		if (removed) {
			logger.info(`CollaborationManager: Removed collaboration ${id} from cache`);
		}
		return removed;
	}

	hasCollaboration(id: CollaborationId): boolean {
		return this.collaborations.has(id);
	}

	getAllCollaborations(): Collaboration[] {
		return Array.from(this.collaborations.values());
	}

	getLoadedCollaborationIds(): CollaborationId[] {
		return Array.from(this.collaborations.keys());
	}

	// Collaboration results management (for storing operation results)
	setCollaborationResult(collaborationId: CollaborationId, result: unknown): void {
		this.collaborationResults.set(collaborationId, result);
	}

	getCollaborationResult(collaborationId: CollaborationId): unknown {
		return this.collaborationResults.get(collaborationId);
	}

	// Interaction management through collaborations
	addInteractionToCollaboration(
		collaborationId: CollaborationId,
		interaction: LLMInteraction,
	): void {
		const collaboration = this.getCollaboration(collaborationId);
		if (!collaboration) {
			throw new Error(`Collaboration ${collaborationId} not found`);
		}

		collaboration.addLoadedInteraction(interaction);
		logger.debug(`CollaborationManager: Added interaction ${interaction.id} to collaboration ${collaborationId}`);
	}

	getInteractionFromCollaboration(
		collaborationId: CollaborationId,
		interactionId: InteractionId,
	): LLMInteraction | undefined {
		const collaboration = this.getCollaboration(collaborationId);
		if (!collaboration) {
			return undefined;
		}

		return collaboration.getLoadedInteraction(interactionId);
	}

	removeInteractionFromCollaboration(
		collaborationId: CollaborationId,
		interactionId: InteractionId,
	): boolean {
		const collaboration = this.getCollaboration(collaborationId);
		if (!collaboration) {
			return false;
		}

		const removed = collaboration.removeLoadedInteraction(interactionId);
		if (removed) {
			logger.debug(
				`CollaborationManager: Removed interaction ${interactionId} from collaboration ${collaborationId}`,
			);
		}
		return removed;
	}

	// Utility methods
	getCollaborationCount(): number {
		return this.collaborations.size;
	}

	getCollaborationSummaries(): Array<{
		id: CollaborationId;
		title: string | null;
		type: string;
		totalInteractions: number;
		projectId: ProjectId;
	}> {
		return Array.from(this.collaborations.values()).map((collaboration) => collaboration.getSummary());
	}

	// Find collaborations by criteria
	findCollaborationsByTitle(title: string): Collaboration[] {
		return Array.from(this.collaborations.values()).filter(
			(collaboration) => collaboration.title && collaboration.title.toLowerCase().includes(title.toLowerCase()),
		);
	}

	findCollaborationsByType(type: CollaborationType): Collaboration[] {
		return Array.from(this.collaborations.values()).filter(
			(collaboration) => collaboration.type === type,
		);
	}

	findCollaborationsByProjectId(projectId: ProjectId): Collaboration[] {
		return Array.from(this.collaborations.values()).filter(
			(collaboration) => collaboration.projectId === projectId,
		);
	}

	// Bulk operations
	clearAllCollaborations(): void {
		this.collaborations.clear();
		this.collaborationResults.clear();
		logger.info('CollaborationManager: Cleared all collaborations from cache');
	}

	// Get collaborations with loaded interactions
	getCollaborationsWithLoadedInteractions(): Collaboration[] {
		return Array.from(this.collaborations.values()).filter(
			(collaboration) => collaboration.getLoadedInteractions().length > 0,
		);
	}

	// Statistics
	getTotalLoadedInteractions(): number {
		return Array.from(this.collaborations.values()).reduce(
			(total, collaboration) => total + collaboration.getLoadedInteractions().length,
			0,
		);
	}

	getCollaborationStats() {
		const collaborations = Array.from(this.collaborations.values());
		return {
			totalCollaborations: collaborations.length,
			totalInteractions: collaborations.reduce((sum, c) => sum + c.totalInteractions, 0),
			totalLoadedInteractions: this.getTotalLoadedInteractions(),
			collaborationsByType: {
				project: collaborations.filter((c) => c.type === 'project').length,
				workflow: collaborations.filter((c) => c.type === 'workflow').length,
				research: collaborations.filter((c) => c.type === 'research').length,
			},
		};
	}
}

export default CollaborationManager;

export const collaborationManager: CollaborationManager = new CollaborationManager();
