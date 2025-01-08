import { ensureDir, exists } from '@std/fs';
import { dirname, join, resolve } from '@std/path';
import { parse as parseYaml } from '@std/yaml';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import { logger } from 'shared/logger.ts';

export async function getProjectId(startDir: string): Promise<string> {
	const projectRoot = await getProjectRootFromStartDir(startDir);
	const configManager = await ConfigManagerV2.getInstance();
	return await configManager.getProjectId(projectRoot);
}

export async function getProjectRoot(projectId: string): Promise<string> {
	const configManager = await ConfigManagerV2.getInstance();
	const projectRoot = await configManager.getProjectRoot(projectId);
	const bbDir = join(projectRoot, '.bb');
	if (await exists(bbDir)) {
		return projectRoot;
	}
	throw new Error('No .bb directory found in projectRoot');
}

export async function getProjectRootFromStartDir(startDir: string): Promise<string> {
	let currentDir = resolve(startDir);
	while (true) {
		//console.log(`Looking for .bb in: ${currentDir}`);
		const bbDir = join(currentDir, '.bb');
		if (await exists(bbDir)) {
			return currentDir;
		}
		const parentDir = resolve(currentDir, '..');
		if (parentDir === currentDir) { // if current is same as parent, then must be at top, nowhere else to go.
			break; // Reached root without finding .bb
		}
		//console.log(`Moving up to parent: ${parentDir}`);
		currentDir = parentDir;
	}
	throw new Error('No .bb directory found in project hierarchy');
}

export async function getBbDir(projectId: string): Promise<string> {
	const projectRoot = await getProjectRoot(projectId);
	const bbDir = join(projectRoot, '.bb');
	await ensureDir(bbDir);
	return bbDir;
}
export async function getBbDirFromStartDir(startDir: string): Promise<string> {
	const projectRoot = await getProjectRootFromStartDir(startDir);
	const bbDir = join(projectRoot, '.bb');
	await ensureDir(bbDir);
	return bbDir;
}

export async function getGlobalConfigDir(): Promise<string> {
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

export async function createBbDir(projectRoot: string): Promise<void> {
	const bbDir = join(projectRoot, '.bb');
	try {
		await ensureDir(bbDir);
		//logger.info(`Created .bb directory in ${projectRoot}`);
	} catch (error) {
		logger.error(`Failed to create .bb directory: ${(error as Error).message}`);
		throw error;
	}
}

export async function createBbIgnore(projectRoot: string): Promise<void> {
	const bbIgnorePath = join(projectRoot, '.bb', 'ignore');
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

export async function resolveProjectFilePath(projectId: string, filePath: string): Promise<string> {
	if (filePath.startsWith('/')) {
		return filePath;
	}

	const projectRoot = await getProjectRoot(projectId);
	logger.info(`resolveProjectFilePath: checking ${filePath} in ${projectRoot}`);
	if (projectRoot) {
		const projectPath = join(projectRoot, filePath);
		logger.info(`resolveProjectFilePath: checking ${projectPath}`);
		if (await exists(projectPath)) {
			return projectPath;
		}
	}

	throw new Error(`File not found: ${filePath}`);
}

export async function resolveFilePath(filePath: string): Promise<string> {
	if (filePath.startsWith('/')) {
		return filePath;
	}

	const projectRoot = await getProjectRootFromStartDir(dirname(filePath));
	if (projectRoot) {
		const projectPath = join(projectRoot, filePath);
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
