import ProjectEditor from 'api/editor/projectEditor.ts';
import type { CollaborationId, ProjectId } from 'shared/types.ts';
import type { UserContext } from 'shared/types/app.ts';
import { errorMessage } from 'shared/error.ts';
import { logger } from 'shared/logger.ts';

class ProjectEditorManager {
	private projectEditors: Map<string, ProjectEditor> = new Map();
	// Track in-progress editor creations by projectId
	private pendingEditorCreations: Map<string, Promise<ProjectEditor>> = new Map();
	// Track current editor for getCurrentEditor method
	private currentEditorKey: string | undefined = undefined;
	private currentCollaborationId: CollaborationId | undefined = undefined;
	// Configuration for when to update current editor: 'create', 'get', or 'both'
	private trackCurrentEditorOn: 'create' | 'get' | 'both' = 'both';

	async getOrCreateEditor(
		projectId: ProjectId,
		collaborationId: CollaborationId | undefined,
		userContext: UserContext,
	): Promise<ProjectEditor> {
		if (!collaborationId) {
			throw new Error('CollaborationId is required to create a new ProjectEditor');
		}

		// Create a composite key using both projectId and collaborationId
		const editorKey = `${projectId}|${collaborationId}`;

		if (this.projectEditors.has(editorKey)) {
			return this.projectEditors.get(editorKey)!;
		}

		// Implement an atomic check-and-set pattern
		let editorCreationPromise = this.pendingEditorCreations.get(editorKey);

		if (!editorCreationPromise) {
			// Only create a new promise if one doesn't exist yet
			logger.info(`ProjectEditorManager: Creating projectEditor for ${editorKey}`);
			editorCreationPromise = this.createEditorWithLock(editorKey, projectId, collaborationId, userContext);
			this.pendingEditorCreations.set(editorKey, editorCreationPromise);

			// Since we created this promise, we're responsible for cleanup
			const cleanup = async () => {
				logger.info(`ProjectEditorManager: Waiting to clean up after creating projectEditor for ${editorKey}`);
				try {
					await editorCreationPromise;
				} finally {
					// Only delete if our promise is still the one in the map
					if (this.pendingEditorCreations.get(editorKey) === editorCreationPromise) {
						this.pendingEditorCreations.delete(editorKey);
						logger.info(`ProjectEditorManager: Cleaned up promise for ${editorKey}`);
					}
				}
			};
			// Start cleanup process but don't wait for it
			cleanup();
		}

		// Everyone waits on the same promise, whether we just created it or found an existing one
		try {
			const projectEditor = await editorCreationPromise;
			if (!projectEditor) throw new Error('Unable to get ProjectEditor');

			// Update current editor tracking if enabled for 'create' operations
			if (this.trackCurrentEditorOn === 'create' || this.trackCurrentEditorOn === 'both') {
				this.currentEditorKey = editorKey;
				this.currentCollaborationId = collaborationId;
			}

			logger.info(`ProjectEditorManager: Returning projectEditor for ${editorKey}`);
			return projectEditor;
		} catch (error) {
			logger.error(`ProjectEditorManager: Failed to create ProjectEditor: ${errorMessage(error)}`);
			throw error;
		}
	}

	private async createEditorWithLock(
		editorKey: string,
		projectId: ProjectId,
		collaborationId: CollaborationId,
		userContext: UserContext,
	): Promise<ProjectEditor> {
		//try {
		const projectEditor = await new ProjectEditor(projectId, userContext).init();
		this.projectEditors.set(editorKey, projectEditor);
		await projectEditor.initCollaboration(collaborationId);
		return projectEditor;
		//} catch (error) {
		//	logger.error(`ProjectEditorManager: Failed to create ProjectEditor: ${errorMessage(error)}`);
		//}
	}

	getEditor(collaborationId: CollaborationId, projectId?: string): ProjectEditor | undefined {
		const editorKey = projectId ? `${projectId}|${collaborationId}` : collaborationId;
		const projectEditor = this.projectEditors.get(editorKey);

		// Update current editor tracking if enabled for 'get' operations
		if (projectEditor && (this.trackCurrentEditorOn === 'get' || this.trackCurrentEditorOn === 'both')) {
			this.currentEditorKey = editorKey;
			this.currentCollaborationId = collaborationId;
		}

		return projectEditor;
	}

	/**
	 * Get the current ProjectEditor without requiring a collaborationId.
	 * Returns the most recently used editor (if tracking is enabled) or the first created editor as fallback.
	 * @returns Object with projectEditor and collaborationId, or undefined if no editors exist
	 */
	getCurrentEditorWithCollaborationId():
		| { projectEditor: ProjectEditor; collaborationId: CollaborationId }
		| undefined {
		// First, try to return the tracked current editor
		if (this.currentEditorKey && this.currentCollaborationId) {
			const projectEditor = this.projectEditors.get(this.currentEditorKey);
			if (projectEditor) {
				return {
					projectEditor,
					collaborationId: this.currentCollaborationId,
				};
			}
		}

		// Fallback: return the first available editor if no current is tracked or current is stale
		const firstEntry = this.projectEditors.entries().next();
		if (!firstEntry.done) {
			const [editorKey, projectEditor] = firstEntry.value;
			// Parse collaborationId from the composite key
			// Key format is either "${projectId}|${collaborationId}" or just "${collaborationId}"
			const dashIndex = editorKey.lastIndexOf('|');
			const collaborationId = dashIndex > 0 ? editorKey.substring(dashIndex + 1) : editorKey;

			return {
				projectEditor,
				collaborationId,
			};
		}

		// No editors available
		return undefined;
	}

	/**
	 * Get the current ProjectEditor without requiring a collaborationId.
	 * Returns the most recently used editor (if tracking is enabled) or the first created editor as fallback.
	 * @returns projectEditor or undefined if no editors exist
	 */
	getCurrentEditor(): ProjectEditor | undefined {
		const editorWithCollabId = this.getCurrentEditorWithCollaborationId();
		if (editorWithCollabId) return editorWithCollabId.projectEditor;
		// No editors available
		return undefined;
	}

	/**
	 * Get the current CollaborationId.
	 * Returns the most recently used ID (if tracking is enabled) or the first ID as fallback.
	 * @returns CollaborationId or undefined if no ID exists
	 */
	getCurrentCollaborationId(): CollaborationId | undefined {
		const editorWithCollabId = this.getCurrentEditorWithCollaborationId();
		if (editorWithCollabId) return editorWithCollabId.collaborationId;
		// No CollaborationId available
		return undefined;
	}

	releaseEditor(collaborationId: CollaborationId, projectId?: string): void {
		const editorKey = projectId ? `${projectId}|${collaborationId}` : collaborationId;

		// Clear current editor tracking if we're releasing the current editor
		if (this.currentEditorKey === editorKey) {
			this.currentEditorKey = undefined;
			this.currentCollaborationId = undefined;
		}

		this.projectEditors.delete(editorKey);
	}

	isCollaborationActive(collaborationId: CollaborationId | undefined, projectId?: string): boolean {
		if (!collaborationId) return false;
		const editorKey = projectId && collaborationId ? `${projectId}|${collaborationId}` : collaborationId;
		return editorKey ? this.projectEditors.has(editorKey) : false;
	}

	/**
	 * Configure when to track current editor updates
	 * @param mode 'create' tracks on creation, 'get' tracks on access, 'both' tracks on both
	 */
	setTrackCurrentEditorOn(mode: 'create' | 'get' | 'both'): void {
		this.trackCurrentEditorOn = mode;
	}

	/**
	 * Get current tracking configuration
	 * @returns Current tracking mode
	 */
	getTrackCurrentEditorOn(): 'create' | 'get' | 'both' {
		return this.trackCurrentEditorOn;
	}

	/**
	 * Returns all active ProjectEditor instances
	 * @returns A Map of collaborationId to ProjectEditor
	 */
	getActiveEditors(): Map<string, ProjectEditor> {
		return this.projectEditors;
	}
}

export default ProjectEditorManager;

export const projectEditorManager: ProjectEditorManager = new ProjectEditorManager();
