import type { CollaborationId, InteractionId } from 'shared/types.ts';
import type { LLMCallbacks } from 'api/types.ts';
import type { CollaborationParams } from 'shared/types/collaboration.types.ts';
import Collaboration from './collaboration.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/llms/conversationInteraction.ts';
import CollaborationPersistence from 'api/storage/collaborationPersistence.ts';
import { logger } from 'shared/logger.ts';
import { generateCollaborationId, shortenCollaborationId } from 'shared/utils/interactionManagement.utils.ts';

// Ensure ProjectInfo includes projectId
type ExtendedProjectInfo = ProjectInfo & { projectId: string };

export default class CollaborationManager {
	private collaborations: Map<CollaborationId, Collaboration> = new Map();
	private collaborationResults: Map<CollaborationId, unknown> = new Map();
	private projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo };

	constructor(projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo }) {
		this.projectEditor = projectEditor;
	}

	async createCollaboration(
		options: {
			id?: CollaborationId;
			title?: string;
			type?: 'project' | 'workflow' | 'research';
			collaborationParams?: CollaborationParams;
		} = {}
	): Promise<Collaboration> {
		const collaborationId = options.id || shortenCollaborationId(generateCollaborationId());
		
		logger.info(`CollaborationManager: Creating collaboration ${collaborationId}`);

		// Check if collaboration already exists
		if (this.collaborations.has(collaborationId)) {
			throw new Error(`Collaboration with id ${collaborationId} already exists`);
		}

		const collaboration = await Collaboration.create(
			collaborationId,
			this.projectEditor,
			{
				title: options.title,
				type: options.type,
				collaborationParams: options.collaborationParams,
			}
		);

		this.collaborations.set(collaborationId, collaboration);
		logger.info(`CollaborationManager: Created collaboration ${collaborationId}`);

		return collaboration;
	}

	async loadCollaboration(collaborationId: CollaborationId): Promise<Collaboration | null> {
		// Check if already loaded
		if (this.collaborations.has(collaborationId)) {
			return this.collaborations.get(collaborationId)!;
		}

		logger.info(`CollaborationManager: Loading collaboration ${collaborationId}`);

		const collaboration = await Collaboration.load(collaborationId, this.projectEditor);
		if (collaboration) {
			this.collaborations.set(collaborationId, collaboration);
			logger.info(`CollaborationManager: Loaded collaboration ${collaborationId}`);
		} else {
			logger.warn(`CollaborationManager: Collaboration ${collaborationId} not found`);
		}

		return collaboration;
	}

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

	async removeCollaboration(id: CollaborationId): Promise<boolean> {
		const collaboration = this.collaborations.get(id);
		if (!collaboration) {
			return false;
		}

		// Remove from memory
		const removed = this.collaborations.delete(id);
		this.collaborationResults.delete(id);

		logger.info(`CollaborationManager: Removed collaboration ${id} from memory`);
		return removed;
	}

	async deleteCollaboration(id: CollaborationId): Promise<boolean> {
		const collaboration = this.collaborations.get(id);
		if (!collaboration) {
			// Try to load it first to delete it
			const loadedCollaboration = await this.loadCollaboration(id);
			if (!loadedCollaboration) {
				return false;
			}
			await loadedCollaboration.delete();
		} else {
			await collaboration.delete();
		}

		// Remove from memory
		this.collaborations.delete(id);
		this.collaborationResults.delete(id);

		logger.info(`CollaborationManager: Deleted collaboration ${id}`);
		return true;
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

	// Collaboration results management
	setCollaborationResult(collaborationId: CollaborationId, result: unknown): void {
		this.collaborationResults.set(collaborationId, result);
	}

	getCollaborationResult(collaborationId: CollaborationId): unknown {
		return this.collaborationResults.get(collaborationId);
	}

	// Interaction management through collaborations
	async createInteractionInCollaboration(
		collaborationId: CollaborationId,
		interactionCallbacks: LLMCallbacks,
		parentInteractionId?: InteractionId,
	): Promise<{ collaboration: Collaboration; interaction: any }> {
		let collaboration = this.getCollaboration(collaborationId);
		
		if (!collaboration) {
			// Try to load the collaboration
			collaboration = await this.loadCollaboration(collaborationId);
			if (!collaboration) {
				throw new Error(`Collaboration ${collaborationId} not found`);
			}
		}

		const interaction = await collaboration.createInteraction(parentInteractionId, interactionCallbacks);
		
		return { collaboration, interaction };
	}

	async getInteractionFromCollaboration(
		collaborationId: CollaborationId,
		interactionId: InteractionId,
	): Promise<any> {
		const collaboration = this.getCollaboration(collaborationId);
		if (!collaboration) {
			throw new Error(`Collaboration ${collaborationId} not found`);
		}

		return await collaboration.getInteraction(interactionId);
	}

	// Listing and querying methods
	async listCollaborations(options: {
		page: number;
		limit: number;
		startDate?: Date;
		endDate?: Date;
		llmProviderName?: string;
	}) {
		return await CollaborationPersistence.listCollaborations({
			...options,
			projectId: this.projectEditor.projectId,
		});
	}

	async getCollaborationIdByTitle(title: string): Promise<CollaborationId | null> {
		// First check loaded collaborations
		for (const collaboration of this.collaborations.values()) {
			if (collaboration.title === title) {
				return collaboration.id;
			}
		}

		// Then check persistence
		const persistence = new CollaborationPersistence('temp', this.projectEditor);
		await persistence.init();
		return await persistence.getCollaborationIdByTitle(title);
	}

	async getCollaborationTitleById(id: CollaborationId): Promise<string | null> {
		// First check loaded collaborations
		const collaboration = this.collaborations.get(id);
		if (collaboration) {
			return collaboration.title;
		}

		// Then check persistence
		const persistence = new CollaborationPersistence('temp', this.projectEditor);
		await persistence.init();
		return await persistence.getCollaborationTitleById(id);
	}

	async getAllCollaborationSummaries(): Promise<{ id: string; title: string }[]> {
		// Get from persistence (this includes all collaborations, not just loaded ones)
		const persistence = new CollaborationPersistence('temp', this.projectEditor);
		await persistence.init();
		return await persistence.getAllCollaborations();
	}

	// Utility methods
	getCollaborationCount(): number {
		return this.collaborations.size;
	}

	getCollaborationSummaries(): Array<{ id: CollaborationId; title: string; type: string; totalInteractions: number }> {
		return Array.from(this.collaborations.values()).map(collaboration => collaboration.getSummary());
	}

	// Cleanup methods
	clearAllCollaborations(): void {
		this.collaborations.clear();
		this.collaborationResults.clear();
		logger.info('CollaborationManager: Cleared all collaborations from memory');
	}

	// Save all loaded collaborations
	async saveAllCollaborations(): Promise<void> {
		const savePromises = Array.from(this.collaborations.values()).map(collaboration => 
			collaboration.save().catch(error => {
				logger.error(`CollaborationManager: Failed to save collaboration ${collaboration.id}:`, error);
			})
		);

		await Promise.all(savePromises);
		logger.info(`CollaborationManager: Saved ${this.collaborations.size} collaborations`);
	}

	// Load collaborations by criteria
	async loadCollaborationsByDateRange(startDate: Date, endDate: Date): Promise<Collaboration[]> {
		const { collaborations } = await this.listCollaborations({
			page: 1,
			limit: 1000, // Large limit to get all
			startDate,
			endDate,
		});

		const loadedCollaborations: Collaboration[] = [];
		
		for (const metadata of collaborations) {
			let collaboration = this.getCollaboration(metadata.id);
			if (!collaboration) {
				collaboration = await this.loadCollaboration(metadata.id);
			}
			if (collaboration) {
				loadedCollaborations.push(collaboration);
			}
		}

		return loadedCollaborations;
	}
}

// Create a singleton instance for global use
let collaborationManagerInstance: CollaborationManager | null = null;

export function createCollaborationManager(projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo }): CollaborationManager {
	collaborationManagerInstance = new CollaborationManager(projectEditor);
	return collaborationManagerInstance;
}

export function getCollaborationManager(): CollaborationManager {
	if (!collaborationManagerInstance) {
		throw new Error('CollaborationManager not initialized. Call createCollaborationManager first.');
	}
	return collaborationManagerInstance;
}

// Export the singleton for backward compatibility
export const collaborationManager = {
	getInstance: getCollaborationManager,
	createInstance: createCollaborationManager,
};