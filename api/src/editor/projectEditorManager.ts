import ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationId } from 'shared/types.ts';
import type { SessionManager } from '../auth/session.ts';

class ProjectEditorManager {
	private projectEditors: Map<string, ProjectEditor> = new Map();

	async getOrCreateEditor(
		conversationId: ConversationId | undefined,
		projectId: string,
		sessionManager: SessionManager,
	): Promise<ProjectEditor> {
		if (conversationId && this.projectEditors.has(conversationId)) {
			return this.projectEditors.get(conversationId)!;
		}

		if (!conversationId) {
			throw new Error('ConversationId is required to create a new ProjectEditor');
		}

		const projectEditor = await new ProjectEditor(projectId, sessionManager).init();
		this.projectEditors.set(conversationId, projectEditor);
		await projectEditor.initConversation(conversationId);
		return projectEditor;
	}

	getEditor(conversationId: ConversationId): ProjectEditor | undefined {
		return this.projectEditors.get(conversationId);
	}

	releaseEditor(conversationId: ConversationId): void {
		this.projectEditors.delete(conversationId);
	}

	isConversationActive(conversationId: ConversationId | undefined): boolean {
		if (!conversationId) return false;
		return this.projectEditors.has(conversationId);
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
