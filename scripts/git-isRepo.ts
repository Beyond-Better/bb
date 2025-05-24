#!/usr/bin/env -S deno run --allow-read --allow-write  --allow-env

//import { walk } from '@std/fs';
import { join, normalize, relative, resolve } from '@std/path';
import git from 'https://esm.sh/isomorphic-git';
import fs from 'node:fs';
//import * as fs from '@std/fs';
//import { join } from 'npm:path-browserify';

// Explicitly provide the path polyfill
globalThis.path = { join };

const findGitRoot = async (startPath: string = Deno.cwd(), workingRoot?: string): Promise<string | null> => {
	try {
		// Get the directory path if startPath is a file
		let dirPath = startPath;
		try {
			const stat = await Deno.stat(startPath);
			if (!stat.isDirectory) {
				dirPath = dirname(startPath);
				console.log(`Using parent directory for git check: ${dirPath}`);
			}
		} catch {
			// If stat fails, assume it's a non-existent path and use its parent
			dirPath = dirname(startPath);
			console.log(`Path doesn't exist, using parent directory: ${dirPath}`);
		}
		console.log(`Checking for git repo in ${dirPath}`);

		const gitRoot = await git.findRoot({ fs, filepath: dirPath });
		console.log(`Found`, { gitRoot });
		const normalizedPath = normalize(gitRoot.trim());
		console.log(`Normalized`, { normalizedPath });
		const resolvedGitRoot = await Deno.realPath(resolve(normalizedPath));
		console.log(`Resolved`, { resolvedGitRoot });

		// If workingRoot is provided, verify the git root is within the project
		if (workingRoot) {
			const isWithinProject = await isPathWithinDataSource(workingRoot, resolvedGitRoot);
			if (!isWithinProject) {
				console.log(`Git root ${resolvedGitRoot} is outside project root ${workingRoot}`);
				return null;
			}
		}

		return resolvedGitRoot;
	} catch (error) {
		if (error.code === 'NotFoundError' || error instanceof Deno.errors.NotFound) {
			return null; // Git root not found
		} else if (error instanceof Deno.errors.PermissionDenied) {
			console.log(
				`GitUtils: Could not find git root; permission denied: ${startPath} - ${(error as Error).message}`,
			);
			return null;
		} else {
			throw new Error(`Failed to resolve git root for: ${startPath} - Error: ${error}`);
		}
	}
};

// Main execution
if (import.meta.main) {
	try {
		const startPath = Deno.args[0] || Deno.cwd();
		console.log(`Git find root for: ${startPath}`);

		const gitRoot = await findGitRoot(startPath);
		console.log({ gitRoot });
	} catch (error) {
		console.error('Error:', error);
		Deno.exit(1);
	}
}
