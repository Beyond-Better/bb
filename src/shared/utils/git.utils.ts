import git from 'isomorphic-git';
import fs from 'node:fs';
import { dirname, join, normalize, resolve } from '@std/path';
import { logger } from './logger.utils.ts';
import { isError } from './error.utils.ts';
import { isPathWithinDataSource } from 'api/utils/fileHandling.ts';
import type { ProjectType } from 'shared/config/types.ts';

export class GitUtils {
	static async findGitRoot(startPath: string = Deno.cwd(), dataSourceRoot?: string): Promise<string | null> {
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

			// If dataSourceRoot is provided, verify the git root is within the project
			if (dataSourceRoot) {
				const isWithinProject = await isPathWithinDataSource(dataSourceRoot, resolvedGitRoot);
				if (!isWithinProject) {
					logger.warn(`Git root ${resolvedGitRoot} is outside project root ${dataSourceRoot}`);
					return null;
				}
			}

			return resolvedGitRoot;
		} catch (error) {
			if ((isError(error) && error.name === 'NotFoundError') || error instanceof Deno.errors.NotFound) {
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
					email: 'git@beyondbetter.app',
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

	/**
	 * Creates or updates a .gitignore file with standard patterns for the project type
	 */
	static async ensureGitignore(projectPath: string, projectType: ProjectType): Promise<void> {
		const gitignorePath = join(projectPath, '.gitignore');
		let existingContent = '';

		// Check if .gitignore already exists
		try {
			existingContent = await Deno.readTextFile(gitignorePath);
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw error;
			}
			// File doesn't exist, which is fine
		}

		// Generate standard gitignore content for this project type
		const standardContent = GitUtils.getStandardGitignoreContent(projectType);

		// Combine existing content with standard content, avoiding duplicates
		const combinedContent = GitUtils.combineGitignoreContent(existingContent, standardContent);

		// Write back to file
		await Deno.writeTextFile(gitignorePath, combinedContent);
	}

	/**
	 * Combines existing gitignore content with standard content, avoiding duplicates
	 */
	static combineGitignoreContent(existing: string, standard: string): string {
		const existingLines = existing.split('\n').map((line) => line.trim());
		const standardLines = standard.split('\n').map((line) => line.trim());

		// Add standard lines that don't already exist
		for (const line of standardLines) {
			if (line && !existingLines.includes(line)) {
				existingLines.push(line);
			}
		}

		return existingLines.join('\n');
	}

	/**
	 * Returns standard gitignore patterns based on project type
	 */
	static getStandardGitignoreContent(projectType: ProjectType): string {
		// Common patterns for all project types
		const common = [
			'.bb/',
			'.trash/',
			'.uploads/',
			'.DS_Store',
			'Thumbs.db',
			'*.log',
			'',
		];

		// Type-specific patterns
		const typeSpecific: Record<ProjectType, string[]> = {
			'local': [],
			'git': [], // Legacy support
			'gdrive': [
				'*.gdoc',
				'*.gsheet',
				'*.gslides',
				'',
			],
			'notion': [],
		};

		return [...common, ...typeSpecific[projectType]].join('\n');
	}

	/**
	 * Gets a list of files to commit, excluding those that should be ignored
	 * This is a simplified approach that focuses on common patterns
	 */
	static async getFilesToCommit(projectPath: string): Promise<string[]> {
		// Get patterns from .gitignore file
		const gitignorePath = join(projectPath, '.gitignore');
		const ignorePatterns: string[] = [];

		try {
			const content = await Deno.readTextFile(gitignorePath);
			// Parse .gitignore file and extract patterns
			const patterns = content.split('\n')
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('#'));
			ignorePatterns.push(...patterns);
		} catch (error) {
			// If .gitignore doesn't exist, use default patterns
			ignorePatterns.push('.git', '.bb');
		}

		// Simple function to check if a path should be ignored
		const shouldIgnore = (path: string): boolean => {
			// Always ignore .git directory
			if (path === '.git' || path.startsWith('.git/')) return true;

			// Check against ignore patterns (very simplified)
			for (const pattern of ignorePatterns) {
				// Handle common ignore pattern formats (simplified)
				if (pattern.endsWith('/') && path.startsWith(pattern)) return true;
				if (path === pattern) return true;
				if (path.endsWith('/' + pattern)) return true;

				// Handle wildcard patterns (very simplified)
				if (pattern.includes('*')) {
					const regexPattern = pattern
						.replace(/\./g, '\\.')
						.replace(/\*/g, '.*');

					if (new RegExp(`^${regexPattern}$`).test(path)) return true;
				}
			}

			return false;
		};

		// Get all files recursively
		const files: string[] = [];

		async function scanDirectory(directory: string, relativePath: string = '') {
			try {
				for await (const entry of Deno.readDir(directory)) {
					const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

					// Skip ignored files/directories
					if (shouldIgnore(entryRelativePath)) continue;

					const entryPath = join(directory, entry.name);

					if (entry.isDirectory) {
						// Recursively scan subdirectories
						await scanDirectory(entryPath, entryRelativePath);
					} else {
						// Add file to list
						files.push(entryRelativePath);
					}
				}
			} catch (error) {
				logger.warn(`Error scanning directory ${directory}: ${(error as Error).message}`);
			}
		}

		// Start scanning from project root
		await scanDirectory(projectPath);

		// Always include .gitignore if it exists
		if (!files.includes('.gitignore')) {
			try {
				await Deno.stat(gitignorePath);
				files.push('.gitignore');
			} catch (error) {
				// .gitignore doesn't exist
			}
		}

		return files;
	}
}
