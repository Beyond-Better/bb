import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';
import type LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
import type LLMConversationInteraction from '../llms/interactions/conversationInteraction.ts';
import type ProjectEditor from '../editor/projectEditor.ts';
import { createFileChangeXmlString } from './fileChange.utils.ts';
import { GitUtils } from 'shared/git.ts';

export async function stageAndCommitAfterChanging(
	interaction: LLMConversationInteraction,
	projectRoot: string,
	changedFiles: Set<string>,
	changeContents: Map<string, string>,
	projectEditor: ProjectEditor,
): Promise<void> {
	if (changedFiles.size === 0) {
		return;
	}

	const commitMessage = await generateCommitMessage(interaction, changedFiles, changeContents, projectEditor);
	const changedFilesArray = Array.from(changedFiles);

	try {
		await GitUtils.stageAndCommit(projectRoot, changedFilesArray, commitMessage);
		logger.info(`Created commit for changed files: ${changedFilesArray.join(', ')}`);
	} catch (error) {
		logger.error(`Failed to create commit: ${error.message}`);
	}
}

export async function generateCommitMessage(
	interaction: LLMConversationInteraction,
	changedFiles: Set<string>,
	changeContents: Map<string, string>,
	projectEditor: ProjectEditor,
): Promise<string> {
	const changedFilesArray = Array.from(changedFiles);
	const fileCount = changedFilesArray.length;
	const fileList = changedFilesArray.map((file) => `- ${file}`).join('\n');
	const fileChangeList = changedFilesArray.map((file) => {
		const changeContent = changeContents.get(file) || '';
		return createFileChangeXmlString(file, changeContent);
	});

	const prompt = await projectEditor.orchestratorController.promptManager.getPrompt('gitCommitMessage', {
		changedFiles: fileChangeList,
	});
	const chat: LLMChatInteraction = await projectEditor.orchestratorController.createChatInteraction(
		interaction.id,
		'Generate Commit Message',
	);
	const response = await chat.chat(prompt);
	const msg = response.messageResponse.answer;

	return stripIndents`${msg}
        
        Applied changes from BB to ${fileCount} file${fileCount > 1 ? 's' : ''}

        Files modified:
        ${fileList}
        `;
}
