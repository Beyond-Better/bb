import git from 'isomorphic-git';
import fs from 'node:fs';
import { dirname, normalize, resolve } from '@std/path';
import { logger } from './logger.utils.ts';
import { isError } from './error.utils.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';

export class GitUtils {
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

			const gitRoot = await git.findRoot({ fs, filepath: dirPath });
			const normalizedPath = normalize(gitRoot.trim());
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
		} catch (error) {
			if ((isError(error) && error.code === 'NotFoundError') || error instanceof Deno.errors.NotFound) {
				return null; // Git root not found
			} else if (error instanceof Deno.errors.PermissionDenied) {
				logger.error(
					`GitUtils: Could not find git root; permission denied: ${startPath} - ${(error as Error).message}`,
				);
				return null;
			} else {
				throw new Error(`Failed to resolve git root for: ${startPath} - Error: ${error}`);
			}
		}
	}

	static async initGit(repoPath: string): Promise<void> {
		try {
			await git.init({ fs, dir: repoPath, defaultBranch: 'main' });
			await git.setConfig({
				fs,
				dir: repoPath,
				path: 'user.name',
				value: 'Beyond Better',
			});
		} catch (error) {
			throw new Error(`Failed to init git repo: ${(error as Error).message}`);
		}
	}

	static async stageAndCommit(repoPath: string, files: string[], commitMessage: string): Promise<string> {
		try {
			// Stage the specified files
			await git.add({ fs, dir: repoPath, filepath: files });

			// Commit the staged changes
			const commitSha = await git.commit({
				fs,
				dir: repoPath,
				message: commitMessage,
				author: {
					name: 'Beyond Better',
					email: 'git@beyondbetter.dev',
				},
			});

			return `Changes committed successfully [${commitSha}]: ${commitMessage}`;
		} catch (error) {
			throw new Error(`Failed to stage and commit changes: ${(error as Error).message}`);
		}
	}

	static async getCurrentCommit(repoPath: string): Promise<string | null> {
		try {
			const commitSha = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
			return commitSha.trim();
		} catch (error) {
			throw new Error(`Failed to get current commit: ${(error as Error).message}`);
		}
	}

	static async getLastCommitForFile(repoPath: string, filePath: string): Promise<string | null> {
		try {
			const commits = await git.log({ fs, dir: repoPath, filepath: filePath, ref: 'HEAD', depth: 1 });
			// commits are returned with last/recent at top of list
			// so grab first one from array
			const lastCommitSha = commits[0]?.oid || null;
			return lastCommitSha;
			// let lastSHA = null;
			// let lastCommit = null;
			// const commitsThatMatter = [];
			// for (const commit of commits) {
			// 	try {
			// 		const o = await git.readObject({ fs, dir, oid: commit.oid, filepath });
			// 		if (o.oid !== lastSHA) {
			// 			if (lastSHA !== null) commitsThatMatter.push(lastCommit);
			// 			lastSHA = o.oid;
			// 		}
			// 	} catch (err) {
			// 		// file no longer there
			// 		commitsThatMatter.push(lastCommit);
			// 		break;
			// 	}
			// 	lastCommit = commit;
			// }
			// //logger.info(commitsThatMatter);
			// return lastSHA;
		} catch (error) {
			throw new Error(`Failed to get last commit for file ${filePath}: ${(error as Error).message}`);
		}
	}
}
