import { SimpleGit, simpleGit } from 'simple-git';
import { Command } from '@std/cli';
import { normalize, resolve } from '@std/path';

//import { logger } from './logger.utils.ts';

export class GitUtils {
	private static gitInstances: SimpleGit[] = [];

	private static async getGit(path: string): Promise<SimpleGit | null> {
		// Check if git is available using Deno's Command API
		try {
			const gitCheck = new Command('git', '--version');
			const gitCheckOutput = await gitCheck.output();
			if (!gitCheckOutput.success) {
				//logger.warn('Git is not installed or not in the PATH');
				return null;
			}
		} catch (error) {
			//logger.warn(`Error checking git: ${error.message}`);
			return null;
		}

		// If we reach here, git is available, so we can proceed with simple-git
		//logger.info(`Creating simpleGit in ${path}`);
		try {
			const git = simpleGit(path);
			// Test if git is available by running a simple command
			await git.raw(['--version']);
			this.gitInstances.push(git);
			return git;
		} catch (error) {
			// If an error occurs (e.g., git not found), return null
			if (error instanceof Error && error.message.includes('ENOENT')) {
				//logger.warn('Git is not installed or not in the PATH');
			} else {
				//logger.error(`Unexpected error when initializing git: ${error.message}`);
			}
			return null;
		}
	}

	static async cleanup(): Promise<void> {
		for (const git of this.gitInstances) {
			await git.clean('f', ['-d']);
		}
		this.gitInstances = [];
	}
	static async findGitRoot(startPath: string = Deno.cwd()): Promise<string | null> {
		//logger.info(`Checking for git repo in ${startPath}`);
		try {
			const git = await this.getGit(startPath);
			if (git === null) {
				return null; // Git not installed or not available
			}
			const result = await git.revparse(['--show-toplevel']);
			const normalizedPath = normalize(result.trim());
			const resolvedGitRoot = await Deno.realPath(resolve(normalizedPath));
			return resolvedGitRoot;
		} catch (_) {
			return null; // Git root not found
		}
	}

	static async initGit(repoPath: string): Promise<void> {
		try {
			const git = await this.getGit(repoPath);
			if (git === null) {
				throw new Error('Git is not available');
			}
			await git.init();
		} catch (error) {
			throw new Error(`Failed to init git repo: ${error.message}`);
		}
	}

	static async stageAndCommit(repoPath: string, files: string[], commitMessage: string): Promise<string> {
		try {
			const git = await this.getGit(repoPath);
			if (git === null) {
				throw new Error('Git is not available');
			}
			// Stage the specified files
			await git.add(files);

			// Commit the staged changes
			await git.commit(commitMessage);

			return `Changes committed successfully: ${commitMessage}`;
		} catch (error) {
			throw new Error(`Failed to stage and commit changes: ${error.message}`);
		}
	}

	static async getCurrentCommit(repoPath: string): Promise<string | null> {
		try {
			const git = await this.getGit(repoPath);
			if (git === null) {
				return null;
			}
			const result = await git.revparse(['HEAD']);
			return result.trim();
		} catch (error) {
			throw new Error(`Failed to get current commit: ${error.message}`);
		}
	}

	static async getLastCommitForFile(repoPath: string, filePath: string): Promise<string | null> {
		try {
			const git = await this.getGit(repoPath);
			if (git === null) {
				return null;
			}
			const result = await git.log({ file: filePath, maxCount: 1 });
			if (result.latest) {
				return result.latest.hash;
			}
			return null;
		} catch (error) {
			throw new Error(`Failed to get last commit for file ${filePath}: ${error.message}`);
		}
	}
}
