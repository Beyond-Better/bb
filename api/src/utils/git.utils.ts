import { logger } from 'shared/logger.ts';
import { relative, resolve } from '@std/path';
import { stripIndents } from 'common-tags';
import type LLMChatInteraction from 'api/llms/chatInteraction.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createFileChangeXmlString } from './fileChange.utils.ts';
import { GitUtils } from 'shared/git.ts';
import { countProjectFiles } from 'shared/dataDir.ts';

export async function stageAndCommitAfterChanging(
	interaction: LLMConversationInteraction,
	dataSourceRoot: string,
	changedResources: Set<string>,
	changeContents: Map<string, string>,
	projectEditor: ProjectEditor,
): Promise<void> {
	if (changedResources.size === 0) {
		return;
	}

	logger.info(`GitUtils: Starting commit process for ${changedResources.size} files:`);
	for (const file of changedResources) {
		logger.info(`GitUtils:   - ${file}`);
	}
	logger.info(`GitUtils: Project root is: ${dataSourceRoot}`);

	// Group files by their git repository root
	const repoFiles = new Map<string, Set<string>>();
	for (const file of changedResources) {
		logger.info(`GitUtils: Finding git root for file: ${file}`);
		const fullPath = resolve(dataSourceRoot, file);
		logger.info(`GitUtils:   Full path: ${fullPath}`);
		const gitRoot = await GitUtils.findGitRoot(fullPath, dataSourceRoot);
		logger.info(`GitUtils:   Git root: ${gitRoot || 'not found'}`);

		if (!gitRoot) {
			logger.warn(`GitUtils: No git repository found for file: ${file}`);
			continue;
		}
		if (!repoFiles.has(gitRoot)) {
			logger.info(`GitUtils: Creating new file set for repository: ${gitRoot}`);
			repoFiles.set(gitRoot, new Set<string>());
		}
		repoFiles.get(gitRoot)!.add(file);
	}

	// Process each repository separately
	logger.info(`GitUtils: Processing ${repoFiles.size} repositories:`);
	for (const [gitRoot, files] of repoFiles) {
		logger.info(`GitUtils: Processing repository: ${gitRoot}`);
		logger.info(`GitUtils: Files in this repository:`);
		files.forEach((file) => logger.info(`GitUtils:   - ${file}`));

		// Convert file paths to be relative to git root instead of project root
		const filesRelativeToGitRoot = new Set<string>();
		for (const file of files) {
			const fullPath = resolve(dataSourceRoot, file);
			const relativeToGitRoot = relative(gitRoot, fullPath);
			logger.info(
				`GitUtils: Converting path for git:\n  Project relative: ${file}\n  Full path: ${fullPath}\n  Git relative: ${relativeToGitRoot}`,
			);
			filesRelativeToGitRoot.add(relativeToGitRoot);
		}

		logger.info('GitUtils: Generating commit message...');
		const commitMessage = await generateCommitMessage(interaction, files, changeContents, projectEditor);
		logger.info(`GitUtils: Commit message generated: ${commitMessage.split('\n')[0]}...`);
		const filesArray = Array.from(filesRelativeToGitRoot);

		try {
			logger.info(`GitUtils: Attempting to stage and commit ${filesArray.length} files...`);
			logger.info('GitUtils: Files to commit (relative to git root):', filesArray);
			await GitUtils.stageAndCommit(gitRoot, filesArray, commitMessage);
			logger.info(`GitUtils: ✓ Successfully created commit in ${gitRoot} for files: ${filesArray.join(', ')}`);
		} catch (error) {
			logger.error(`GitUtils: ✗ Failed to create commit in ${gitRoot}: ${(error as Error).message}`);
			logger.error('GitUtils: Stack trace:', (error as Error).stack);
		}
	}
}

export async function generateCommitMessage(
	interaction: LLMConversationInteraction,
	changedResources: Set<string>,
	changeContents: Map<string, string>,
	projectEditor: ProjectEditor,
): Promise<string> {
	const changedResourcesArray = Array.from(changedResources);
	const fileCount = changedResourcesArray.length;
	const fileList = changedResourcesArray.map((file) => `- ${file}`).join('\n');
	const fileChangeList = changedResourcesArray
		.map((file) => {
			const changeContent = changeContents.get(file) || '';
			const result = createFileChangeXmlString(file, changeContent);
			if (result === null) {
				console.warn(`GitUtils: Warning: Failed to create file change XML string for file: ${file}`);
			}
			return { file, result };
		})
		.filter((item): item is { file: string; result: string } => item.result !== null)
		.map(({ result }) => result);

	const prompt = await projectEditor.orchestratorController.promptManager.getPrompt('gitCommitMessage', {
		changedResources: fileChangeList,
	});

	const chat: LLMChatInteraction = await projectEditor.orchestratorController.createChatInteraction(
		interaction.collaboration,
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

export async function gitInitDataSource(
	dataSourcePath: string,
): Promise<void> {
	// Check if directory is already a git repo
	try {
		const gitRoot = await GitUtils.findGitRoot(dataSourcePath);

		// Only initialize Git if not already a git repo
		if (!gitRoot) {
			logger.info(`GitUtils: Initializing Git repository in ${dataSourcePath}`);

			// Initialize git repository
			await GitUtils.initGit(dataSourcePath);

			// Create/update .gitignore file
			await GitUtils.ensureGitignore(dataSourcePath, 'local');

			// Count files in the directory (excluding .git and .bb directories)
			const fileCount = await countProjectFiles(dataSourcePath);
			logger.info(`GitUtils: Project has ${fileCount} files (excluding .git and .bb directories)`);

			try {
				// Determine which files to commit based on file count
				let filesToCommit: string[] = [];

				if (fileCount < 12) {
					// For small projects, get all files in the directory (excluding those in .gitignore)
					// This is a simplified approach - in a real implementation, we'd want to use git status
					// or find a more robust way to get all non-ignored files
					filesToCommit = await GitUtils.getFilesToCommit(dataSourcePath);
					logger.info(`GitUtils: Committing all ${filesToCommit.length} project files`);
				} else {
					// For larger projects, only commit the .gitignore file
					filesToCommit = ['.gitignore'];
					logger.info('GitUtils: Project has many files. Only committing .gitignore file');
				}

				// Only commit if we have files to commit
				if (filesToCommit.length > 0) {
					await GitUtils.stageAndCommit(dataSourcePath, filesToCommit, 'Initial project setup');
					logger.info('GitUtils: Initial commit created for new project');
				} else {
					logger.info('GitUtils: No files to commit');
				}
			} catch (commitError) {
				// Log error but don't fail project creation
				logger.warn(`GitUtils: Git commit failed: ${(commitError as Error).message}`);
			}
		} else {
			logger.info(`GitUtils: Project directory is already a Git repository at ${gitRoot}`);
		}
	} catch (gitError) {
		// Log error but don't fail project creation
		logger.warn(`GitUtils: Git initialization failed: ${(gitError as Error).message}`);
	}
}
