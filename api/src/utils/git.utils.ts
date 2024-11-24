import { logger } from 'shared/logger.ts';
import { relative, resolve } from '@std/path';
import { stripIndents } from 'common-tags';
import type LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
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

	logger.info(`Starting commit process for ${changedFiles.size} files:`);
	for (const file of changedFiles) {
		logger.info(`  - ${file}`);
	}
	logger.info(`Project root is: ${projectRoot}`);

	// Group files by their git repository root
	const repoFiles = new Map<string, Set<string>>();
	for (const file of changedFiles) {
		logger.info(`Finding git root for file: ${file}`);
		const fullPath = resolve(projectRoot, file);
		logger.info(`  Full path: ${fullPath}`);
		const gitRoot = await GitUtils.findGitRoot(fullPath, projectRoot);
		logger.info(`  Git root: ${gitRoot || 'not found'}`);

		if (!gitRoot) {
			logger.warn(`No git repository found for file: ${file}`);
			continue;
		}
		if (!repoFiles.has(gitRoot)) {
			logger.info(`Creating new file set for repository: ${gitRoot}`);
			repoFiles.set(gitRoot, new Set<string>());
		}
		repoFiles.get(gitRoot)!.add(file);
	}

	// Process each repository separately
	logger.info(`Processing ${repoFiles.size} repositories:`);
	for (const [gitRoot, files] of repoFiles) {
		logger.info(`\nProcessing repository: ${gitRoot}`);
		logger.info(`Files in this repository:`);
		files.forEach((file) => logger.info(`  - ${file}`));

		// Convert file paths to be relative to git root instead of project root
		const filesRelativeToGitRoot = new Set<string>();
		for (const file of files) {
			const fullPath = resolve(projectRoot, file);
			const relativeToGitRoot = relative(gitRoot, fullPath);
			logger.info(
				`Converting path for git:\n  Project relative: ${file}\n  Full path: ${fullPath}\n  Git relative: ${relativeToGitRoot}`,
			);
			filesRelativeToGitRoot.add(relativeToGitRoot);
		}

		logger.info('Generating commit message...');
		const commitMessage = await generateCommitMessage(interaction, files, changeContents, projectEditor);
		logger.info(`Commit message generated: ${commitMessage.split('\n')[0]}...`);
		const filesArray = Array.from(filesRelativeToGitRoot);

		try {
			logger.info(`Attempting to stage and commit ${filesArray.length} files...`);
			logger.info('Files to commit (relative to git root):', filesArray);
			await GitUtils.stageAndCommit(gitRoot, filesArray, commitMessage);
			logger.info(`✓ Successfully created commit in ${gitRoot} for files: ${filesArray.join(', ')}`);
		} catch (error) {
			logger.error(`✗ Failed to create commit in ${gitRoot}: ${(error as Error).message}`);
			logger.error('Stack trace:', (error as Error).stack);
		}
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
