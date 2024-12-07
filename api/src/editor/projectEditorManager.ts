import ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationId } from 'shared/types.ts';

class ProjectEditorManager {
	private projectEditors: Map<string, ProjectEditor> = new Map();

	async getOrCreateEditor(conversationId: ConversationId | undefined, projectId: string): Promise<ProjectEditor> {
		if (conversationId && this.projectEditors.has(conversationId)) {
			return this.projectEditors.get(conversationId)!;
		}

		if (!conversationId) {
			throw new Error('ConversationId is required to create a new ProjectEditor');
		}

		const projectEditor = await new ProjectEditor(projectId).init();
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
}

export default ProjectEditorManager;

export const projectEditorManager: ProjectEditorManager = new ProjectEditorManager();
