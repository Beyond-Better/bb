import { ensureDir, exists } from '@std/fs';
import { dirname, join, resolve } from '@std/path';
import { parse as parseYaml } from '@std/yaml';
import { getConfigManager } from 'shared/config/configManager.ts';
import { getProjectRegistry } from 'shared/projectRegistry.ts';
import { logger } from 'shared/logger.ts';

export async function getProjectId(startDir: string): Promise<string | undefined> {
	const workingRoot = await getWorkingRootFromStartDir(startDir);

	// Use ProjectRegistry to find project by path
	const registry = await getProjectRegistry();
	const project = await registry.findProjectByPath(workingRoot);

	if (project) {
		return project.projectId;
	}
	return undefined;
}

export async function getWorkingRoot(projectId: string): Promise<string> {
	// Use ProjectRegistry to get project by ID
	const registry = await getProjectRegistry();
	const project = await registry.getProject(projectId);

	if (project) {
		const workingRoot = project.dataSourcePaths ? project.dataSourcePaths[0] : undefined;
		if (!workingRoot) throw new Error('DataDir: No filesystem data sources in project');
		const bbDir = join(workingRoot, '.bb');
		if (await exists(bbDir)) {
			return workingRoot;
		}
		throw new Error('No .bb directory found in workingRoot');
	}
	throw new Error('No .bb directory found in workingRoot');
}

export async function getWorkingRootFromStartDir(startDir: string): Promise<string> {
	let currentDir = resolve(startDir);
	while (true) {
		//logger.log(`Looking for .bb in: ${currentDir}`);
		const bbDir = join(currentDir, '.bb');
		if (await exists(bbDir)) {
			return currentDir;
		}
		const parentDir = resolve(currentDir, '..');
		if (parentDir === currentDir) { // if current is same as parent, then must be at top, nowhere else to go.
			break; // Reached root without finding .bb
		}
		//logger.log(`Moving up to parent: ${parentDir}`);
		currentDir = parentDir;
	}
	throw new Error('No .bb directory found in project hierarchy');
}

export async function getBbDir(projectId: string): Promise<string> {
	return await getBbDirFromProjectId(projectId);
}
export async function getBbDirFromProjectId(projectId: string): Promise<string> {
	const workingRoot = await getWorkingRoot(projectId);
	return await getBbDirFromWorkingRoot(workingRoot);
}
export async function getBbDirFromStartDir(startDir: string): Promise<string> {
	const workingRoot = await getWorkingRootFromStartDir(startDir);
	return await getBbDirFromWorkingRoot(workingRoot);
}
export async function getBbDirFromWorkingRoot(workingRoot: string): Promise<string> {
	const bbDir = join(workingRoot, '.bb');
	await ensureDir(bbDir);
	return bbDir;
}

export async function getGlobalConfigDir(): Promise<string> {
	const customConfigDir = Deno.env.get('BB_GLOBAL_CONFIG_DIR'); // used for testing - don't rely on it for other purposes
	if (customConfigDir) {
		if (!Deno.env.get('BB_UNIT_TESTS')) {
			logger.warn(`DataDir: CUSTOM CONFIG_DIR - USE ONLY FOR TESTING: ${customConfigDir}`);
		}
		await ensureDir(customConfigDir);
		return customConfigDir;
	}

	const globalConfigDir = Deno.build.os === 'windows' ? (join(Deno.env.get('APPDATA') || '', 'bb')) : (
		join(Deno.env.get('HOME') || '', '.config', 'bb')
	);
	await ensureDir(globalConfigDir);
	return globalConfigDir;
}

export async function getBbDataDir(projectId: string): Promise<string> {
	const bbDir = await getBbDir(projectId);
	const repoCacheDir = join(bbDir, 'data');
	await ensureDir(repoCacheDir);
	return repoCacheDir;
}

export async function createDataSourceBbDir(dataSourceRoot: string): Promise<void> {
	const bbDir = join(dataSourceRoot, '.bb');
	try {
		await ensureDir(bbDir);
		//logger.info(`Created .bb directory in ${dataSourceRoot}`);
	} catch (error) {
		logger.error(`Failed to create .bb directory: ${(error as Error).message}`);
		throw error;
	}
}

export async function createDataSourceBbIgnore(dataSourceRoot: string): Promise<void> {
	await createDataSourceBbDir(dataSourceRoot);
	const bbIgnorePath = join(dataSourceRoot, '.bb', 'ignore');
	try {
		const fileInfo = await Deno.stat(bbIgnorePath);
		if (fileInfo.isFile) {
			logger.info('.bb/ignore file already exists, skipping creation');
			return;
		}
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			logger.error(`Error checking .bb/ignore file: ${(error as Error).message}`);
			throw error;
		}
		// File doesn't exist, proceed with creation
		try {
			await Deno.writeTextFile(bbIgnorePath, getDefaultBbIgnore());
			//logger.debug('Created .bb/ignore file');
		} catch (writeError) {
			logger.error(`Failed to create .bb/ignore file: ${(writeError as Error).message}`);
			throw writeError;
		}
	}
}

export function getDefaultBbIgnore(): string {
	return `
# Ignore patterns for BB
# Add files and directories that should be ignored by BB here

# Ignore node_modules directory
node_modules/

# Ignore build output directories
dist/
build/
out/

# Ignore log files
*.log

# Ignore temporary files
*.tmp
*.temp

# Ignore OS-specific files
.DS_Store
Thumbs.db

# Ignore IDE and editor files
.vscode/
.idea/
*.swp
*.swo

# Ignore BB's own directory
.bb/

# Ignore git directory
.git/

# Add your custom ignore patterns below
`;
}

export async function writeToBbDir(projectId: string, filename: string, content: string): Promise<void> {
	const bbDir = await getBbDir(projectId);
	const filePath = join(bbDir, filename);
	await Deno.writeTextFile(filePath, content);
}

export async function readFromBbDir(projectId: string, filename: string): Promise<string | null> {
	const bbDir = await getBbDir(projectId);
	const filePath = join(bbDir, filename);
	try {
		return await Deno.readTextFile(filePath);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return null;
		}
		throw error;
	}
}

export async function removeFromBbDir(projectId: string, filename: string): Promise<void> {
	const bbDir = await getBbDir(projectId);
	const filePath = join(bbDir, filename);
	try {
		await Deno.remove(filePath);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}
}

export async function writeToGlobalConfigDir(filename: string, content: string): Promise<void> {
	const bbDir = await getGlobalConfigDir();
	const filePath = join(bbDir, filename);
	await Deno.writeTextFile(filePath, content);
}

export async function readFromGlobalConfigDir(filename: string): Promise<string | null> {
	const bbDir = await getGlobalConfigDir();
	const filePath = join(bbDir, filename);
	try {
		return await Deno.readTextFile(filePath);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return null;
		}
		throw error;
	}
}

export async function removeFromGlobalConfigDir(filename: string): Promise<void> {
	const bbDir = await getGlobalConfigDir();
	const filePath = join(bbDir, filename);
	try {
		await Deno.remove(filePath);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}
}

export async function writeToBbDataDir(projectId: string, filename: string, content: string): Promise<void> {
	const dataDir = await getBbDataDir(projectId);
	const filePath = join(dataDir, filename);
	await Deno.writeTextFile(filePath, content);
}

export async function readFromBbDataDir(projectId: string, filename: string): Promise<string | null> {
	const dataDir = await getBbDataDir(projectId);
	const filePath = join(dataDir, filename);
	try {
		return await Deno.readTextFile(filePath);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return null;
		}
		throw error;
	}
}

export async function removeFromBbDataDir(projectId: string, filename: string): Promise<void> {
	const dataDir = await getBbDataDir(projectId);
	const filePath = join(dataDir, filename);
	try {
		await Deno.remove(filePath);
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			throw error;
		}
	}
}

export async function resolveDataSourceFilePath(dataSourceRoot: string, filePath: string): Promise<string> {
	if (filePath.startsWith('/')) {
		return filePath;
	}

	logger.info(`resolveDataSourceFilePath: checking ${filePath} in ${dataSourceRoot}`);
	const dataSourcePath = join(dataSourceRoot, filePath);
	if (await exists(dataSourcePath)) {
		return dataSourcePath;
	}

	// // Then check all additional data source paths if any
	// if (project.dataSourcePaths && project.dataSourcePaths.length > 0) {
	// 	for (const dsPath of project.dataSourcePaths) {
	// 		if (dsPath === dataSourceRoot) continue; // Skip main path we already checked
	//
	// 		logger.info(`resolveDataSourceFilePath: checking ${filePath} in alternate data source ${dsPath}`);
	// 		const altSourcePath = join(dsPath, filePath);
	// 		if (await exists(altSourcePath)) {
	// 			return altSourcePath;
	// 		}
	// 	}
	// }

	throw new Error(`File not found: ${filePath}`);
}

export async function resolveFilePath(filePath: string): Promise<string> {
	if (filePath.startsWith('/')) {
		return filePath;
	}

	const workingRoot = await getWorkingRootFromStartDir(dirname(filePath));
	if (workingRoot) {
		const projectPath = join(workingRoot, filePath);
		if (await exists(projectPath)) {
			return projectPath;
		}
	}

	const homePath = join(Deno.env.get('HOME') || '', filePath);
	if (await exists(homePath)) {
		return homePath;
	}

	throw new Error(`File not found: ${filePath}`);
}

export async function readFileContent(filePath: string): Promise<string | null> {
	if (await exists(filePath)) {
		return await Deno.readTextFile(filePath);
	}
	return null;
}

/**
 * Counts files in a project directory, excluding .git and .bb directories
 */
export async function countProjectFiles(dataSourceRoot: string): Promise<number> {
	let count = 0;

	try {
		for await (const entry of Deno.readDir(dataSourceRoot)) {
			// Skip .git and .bb directories
			if (entry.name === '.git' || entry.name === '.bb') {
				continue;
			}

			const path = join(dataSourceRoot, entry.name);
			if (entry.isDirectory) {
				count += await countProjectFiles(path);
			} else {
				count++;
			}
		}
	} catch (error) {
		logger.warn(`Error counting files in ${dataSourceRoot}: ${(error as Error).message}`);
	}

	return count;
}
