import { SimpleGit, simpleGit } from 'simple-git';
import { dirname, normalize, resolve } from '@std/path';
import { logger } from './logger.utils.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';

export class GitUtils {
	private static gitInstances: SimpleGit[] = [];

	private static async getGit(path: string): Promise<SimpleGit | null> {
		try {
			const { installed } = await simpleGit().version();
			if (!installed) {
				throw new Error(`Exit: "git" not available.`);
			}
			const git = simpleGit(path);
			this.gitInstances.push(git);
			return git;
		} catch (error) {
			// If an error occurs (e.g., git not found), return null
			if (error instanceof Error && error.message.includes('ENOENT')) {
				logger.warn('Git is not installed or not in the PATH');
			} else {
				logger.error(`Unexpected error when initializing git: ${(error as Error).message}`);
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

	static async findGitRoot(startPath: string = Deno.cwd(), projectRoot?: string): Promise<string | null> {
		logger.info(`Checking for git repo in ${startPath}`);
		try {
			// Get the directory path if startPath is a file
			let dirPath = startPath;
			try {
				const stat = await Deno.stat(startPath);
				if (!stat.isDirectory) {
					dirPath = dirname(startPath);
					logger.info(`Using parent directory for git check: ${dirPath}`);
				}
			} catch {
				// If stat fails, assume it's a non-existent path and use its parent
				dirPath = dirname(startPath);
				logger.info(`Path doesn't exist, using parent directory: ${dirPath}`);
			}
			const git = await this.getGit(dirPath);
			if (git === null) {
				return null; // Git not installed or not available
			}
			const result = await git.revparse(['--show-toplevel']);
			const normalizedPath = normalize(result.trim());
			const resolvedGitRoot = await Deno.realPath(resolve(normalizedPath));

			// If projectRoot is provided, verify the git root is within the project
			if (projectRoot) {
				const isWithinProject = await isPathWithinProject(projectRoot, resolvedGitRoot);
				if (!isWithinProject) {
					logger.warn(`Git root ${resolvedGitRoot} is outside project root ${projectRoot}`);
					return null;
				}
			}

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
			throw new Error(`Failed to init git repo: ${(error as Error).message}`);
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
			throw new Error(`Failed to stage and commit changes: ${(error as Error).message}`);
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
			throw new Error(`Failed to get current commit: ${(error as Error).message}`);
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
			throw new Error(`Failed to get last commit for file ${filePath}: ${(error as Error).message}`);
		}
	}
}
