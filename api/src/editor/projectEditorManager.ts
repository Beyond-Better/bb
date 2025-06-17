import ProjectEditor from 'api/editor/projectEditor.ts';
import type { InteractionId } from 'shared/types.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { errorMessage } from 'shared/error.ts';
import { logger } from 'shared/logger.ts';

class ProjectEditorManager {
	private projectEditors: Map<string, ProjectEditor> = new Map();
	// Track in-progress editor creations by projectId
	private pendingEditorCreations: Map<string, Promise<ProjectEditor>> = new Map();

	async getOrCreateEditor(
		conversationId: InteractionId | undefined,
		projectId: string,
		sessionManager: SessionManager,
	): Promise<ProjectEditor> {
		if (!conversationId) {
			throw new Error('InteractionId is required to create a new ProjectEditor');
		}

		// Create a composite key using both projectId and conversationId
		const editorKey = `${projectId}-${conversationId}`;

		if (this.projectEditors.has(editorKey)) {
			return this.projectEditors.get(editorKey)!;
		}

		// Implement an atomic check-and-set pattern
		let editorCreationPromise = this.pendingEditorCreations.get(editorKey);

		if (!editorCreationPromise) {
			// Only create a new promise if one doesn't exist yet
			logger.info(`ProjectEditorManager: Creating projectEditor for ${editorKey}`);
			editorCreationPromise = this.createEditorWithLock(editorKey, projectId, conversationId, sessionManager);
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
			logger.info(`ProjectEditorManager: Returning projectEditor for ${editorKey}`);
			return projectEditor;
		} catch (error) {
			logger.error(`ProjectEditorManager: Failed to create ProjectEditor: ${errorMessage(error)}`);
			throw error;
		}
	}

	private async createEditorWithLock(
		editorKey: string,
		projectId: string,
		conversationId: InteractionId,
		sessionManager: SessionManager,
	): Promise<ProjectEditor> {
		//try {
		const projectEditor = await new ProjectEditor(projectId, sessionManager).init();
		this.projectEditors.set(editorKey, projectEditor);
		await projectEditor.initCollaboration(conversationId);
		return projectEditor;
		//} catch (error) {
		//	logger.error(`ProjectEditorManager: Failed to create ProjectEditor: ${errorMessage(error)}`);
		//}
	}

	getEditor(conversationId: InteractionId, projectId?: string): ProjectEditor | undefined {
		const editorKey = projectId ? `${projectId}-${conversationId}` : conversationId;
		return this.projectEditors.get(editorKey);
	}

	releaseEditor(conversationId: InteractionId, projectId?: string): void {
		const editorKey = projectId ? `${projectId}-${conversationId}` : conversationId;
		this.projectEditors.delete(editorKey);
	}

	isCollaborationActive(conversationId: InteractionId | undefined, projectId?: string): boolean {
		if (!conversationId) return false;
		const editorKey = projectId && conversationId ? `${projectId}-${conversationId}` : conversationId;
		return editorKey ? this.projectEditors.has(editorKey) : false;
	}

	/**
	 * Returns all active ProjectEditor instances
	 * @returns A Map of conversationId to ProjectEditor
	 */
	getActiveEditors(): Map<string, ProjectEditor> {
		return this.projectEditors;
	}
}

export default ProjectEditorManager;

export const projectEditorManager: ProjectEditorManager = new ProjectEditorManager();
