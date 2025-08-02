import { getConfigManager } from 'shared/config/configManager.ts';
import type { CreateProjectData } from 'shared/types/project.ts';
import { assert } from 'api/tests/deps.ts';
import { join } from '@std/path';

import type ProjectEditor from 'api/editor/projectEditor.ts';
import ProjectEditorManager from 'api/editor/projectEditorManager.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type LLMChatInteraction from 'api/llms/chatInteraction.ts';
import LLMToolManager from '../../src/llms/llmToolManager.ts';
import type { InteractionStats, ProjectId } from 'shared/types.ts';
import { SessionManager } from 'api/auth/session.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import { FilesystemProvider } from 'api/dataSources/filesystemProvider.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';

export async function setupTestProject(): Promise<
	{ dataSourceRoot: string; projectId: ProjectId; globalConfigDir: string; projectAdminDir: string }
> {
	Deno.env.set('BB_UNIT_TESTS', '1');
	// Set custom global config directory
	const globalConfigDir = await Deno.makeTempDir();
	Deno.env.set('BB_GLOBAL_CONFIG_DIR', globalConfigDir);

	// Generate a unique ID for this test run
	const testInstanceId = crypto.randomUUID();
	Deno.env.set('BB_TEST_INSTANCE_ID', testInstanceId);
	//Deno.env.set('BB_NO_SINGLETON_CONFIG_MANGER', '1');
	//Deno.env.set('BB_NO_SINGLETON_PROJECT_REGISTRY', '1');

	Deno.env.set('SKIP_PROJECT_GIT_REPO', '1');
	Deno.env.set('BB_PROJECT_ADMIN_DIR', '');

	const configManager = await getConfigManager();
	await configManager.ensureGlobalConfig();

	const dataSourceRegistry = await getDataSourceRegistry();
	const dataSourceRoot = await Deno.makeTempDir();
	const dsConnection = FilesystemProvider.createFileSystemDataSource(
		'primary',
		dataSourceRoot,
		dataSourceRegistry,
		{
			id: 'ds-fs-primary',
			isPrimary: true,
			//projectConfig: projectConfig,
		},
	);

	const createProjectData: CreateProjectData = {
		name: 'TestProject',
		status: 'active',
		dsConnections: [
			dsConnection,
		],
	};
	const projectPersistenceManager = await getProjectPersistenceManager();
	const projectData = await projectPersistenceManager.createProject(createProjectData);
	const projectId = projectData.projectId;

	const projectAdminDir = join(globalConfigDir, 'projects', projectId);
	Deno.env.set('BB_PROJECT_ADMIN_DIR', projectAdminDir);
	//console.log('setupTestProject', { dataSourceRoot, projectId });

	return { dataSourceRoot, projectId, globalConfigDir, projectAdminDir };
}

export async function cleanupTestProject(projectId: ProjectId, _dataSourceRoot: string) {
	try {
		const projectPersistenceManager = await getProjectPersistenceManager();
		await projectPersistenceManager.deleteProject(projectId);
	} catch (error) {
		console.error(`Failed to clean up test directory: ${(error as Error).message}`);
	}
}

export async function getProjectEditor(projectId: ProjectId): Promise<ProjectEditor> {
	const projectEditorManager = new ProjectEditorManager();
	//console.log('getProjectEditor', { projectId });
	const sessionManager = new SessionManager();
	await sessionManager.initialize();
	const projectEditor = await projectEditorManager.getOrCreateEditor(projectId, 'test-collaboration', sessionManager);

	assert(projectEditor, 'Failed to get ProjectEditor');

	return projectEditor;
}

export async function getToolManager(
	projectEditor: ProjectEditor,
	toolName?: string,
	toolConfig?: Record<string, unknown>,
): Promise<LLMToolManager> {
	if (toolName && toolConfig) {
		const configManager = await getConfigManager();
		await configManager.setProjectConfigValue(
			projectEditor.projectId,
			`api.toolConfigs.${toolName}`,
			JSON.stringify(toolConfig),
		);
		projectEditor.projectConfig = await configManager.getProjectConfig(projectEditor.projectId);
	}

	const toolManager = await new LLMToolManager(projectEditor.projectConfig, projectEditor.sessionManager, 'core')
		.init(); // Assuming 'core' is the default toolset

	assert(toolManager, 'Failed to get LLMToolManager');

	return toolManager;
}

// Ensure all file paths are relative to testProjectRoot
export const getTestFilePath = (testProjectRoot: string, filename: string) => join(testProjectRoot, filename);

export async function createTestInteraction(
	collaborationId: string,
	interactionId: string,
	projectEditor: ProjectEditor,
): Promise<LLMConversationInteraction> {
	const interaction = await projectEditor.initInteraction(collaborationId, interactionId);
	return interaction as LLMConversationInteraction;
}

export async function createTestChatInteraction(
	collaborationId: string,
	interactionId: string,
	projectEditor: ProjectEditor,
	chatTitle: string = 'Chat Title',
): Promise<LLMChatInteraction> {
	const interaction = await projectEditor.initInteraction(collaborationId, interactionId);
	const chatInteraction = await projectEditor.orchestratorController.createChatInteraction(
		interaction.collaboration,
		interaction.id,
		chatTitle,
	);
	return chatInteraction as LLMChatInteraction;
}

export async function withTestProject<T>(
	testFn: (projectId: ProjectId, dataSourceRoot: string) => Promise<T>,
): Promise<T> {
	const { projectId, dataSourceRoot } = await setupTestProject();
	try {
		return await testFn(projectId, dataSourceRoot);
	} finally {
		await cleanupTestProject(projectId, dataSourceRoot);
	}
}

export function incrementInteractionStats(interactionStats: InteractionStats): InteractionStats {
	return {
		statementCount: interactionStats.statementCount++,
		statementTurnCount: interactionStats.statementTurnCount++,
		interactionTurnCount: interactionStats.interactionTurnCount++,
	};
}
