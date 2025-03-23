import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { CreateProjectData } from 'shared/config/v2/types.ts';
import { assert } from 'api/tests/deps.ts';
import { join } from '@std/path';

import type ProjectEditor from 'api/editor/projectEditor.ts';
import ProjectEditorManager from '../../src/editor/projectEditorManager.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type LLMChatInteraction from 'api/llms/chatInteraction.ts';
import LLMToolManager from '../../src/llms/llmToolManager.ts';
import type { ConversationStats } from 'shared/types.ts';
import { SessionManager } from '../../src/auth/session.ts';

export async function setupTestProject(): Promise<{ projectRoot: string; projectId: string }> {
	const projectRoot = Deno.makeTempDirSync();

	const configManager = await ConfigManagerV2.getInstance();
	await configManager.ensureGlobalConfig();
	const createProjectData: CreateProjectData = { name: 'TestProject', type: 'local', path: projectRoot };
	const projectId = await configManager.createProject(createProjectData);
	//console.log('setupTestProject', { projectRoot, projectId });

	return { projectRoot, projectId };
}

export async function cleanupTestProject(projectId: string, projectRoot: string) {
	try {
		const configManager = await ConfigManagerV2.getInstance();
		await configManager.deleteProject(projectId);
		await Deno.remove(projectRoot, { recursive: true });
	} catch (error) {
		console.error(`Failed to clean up test directory: ${(error as Error).message}`);
	}
}

export async function getProjectEditor(projectId: string): Promise<ProjectEditor> {
	const projectEditorManager = new ProjectEditorManager();
	//console.log('getProjectEditor', { projectId });
	const sessionManager = new SessionManager();
	await sessionManager.initialize();
	const projectEditor = await projectEditorManager.getOrCreateEditor('test-conversation', projectId, sessionManager);

	assert(projectEditor, 'Failed to get ProjectEditor');

	return projectEditor;
}

export async function getToolManager(
	projectEditor: ProjectEditor,
	toolName?: string,
	toolConfig?: Record<string, unknown>,
): Promise<LLMToolManager> {
	if (toolName && toolConfig) {
		const configManager = await ConfigManagerV2.getInstance();
		await configManager.setProjectConfigValue(
			projectEditor.projectId,
			`settings.api.toolConfigs.${toolName}`,
			JSON.stringify(toolConfig),
		);
		projectEditor.projectConfig = await configManager.getProjectConfig(projectEditor.projectId);
	}

	const toolManager = await new LLMToolManager(projectEditor.projectConfig, 'core', projectEditor.mcpManager).init(); // Assuming 'core' is the default toolset

	assert(toolManager, 'Failed to get LLMToolManager');

	return toolManager;
}

// Ensure all file paths are relative to testProjectRoot
export const getTestFilePath = (testProjectRoot: string, filename: string) => join(testProjectRoot, filename);

export async function createTestInteraction(
	conversationId: string,
	projectEditor: ProjectEditor,
): Promise<LLMConversationInteraction> {
	const interaction = await projectEditor.initConversation(conversationId);
	return interaction as LLMConversationInteraction;
}

export async function createTestChatInteraction(
	conversationId: string,
	projectEditor: ProjectEditor,
	chatTitle: string = 'Chat Title',
): Promise<LLMChatInteraction> {
	const chatInteraction = await projectEditor.orchestratorController.createChatInteraction(
		conversationId,
		chatTitle,
	);
	return chatInteraction as LLMChatInteraction;
}

export async function withTestProject<T>(
	testFn: (projectId: string, projectRoot: string) => Promise<T>,
): Promise<T> {
	const { projectId, projectRoot } = await setupTestProject();
	try {
		return await testFn(projectId, projectRoot);
	} finally {
		await cleanupTestProject(projectId, projectRoot);
	}
}

export function incrementConversationStats(conversationStats: ConversationStats): ConversationStats {
	return {
		statementCount: conversationStats.statementCount++,
		statementTurnCount: conversationStats.statementTurnCount++,
		conversationTurnCount: conversationStats.conversationTurnCount++,
	};
}
