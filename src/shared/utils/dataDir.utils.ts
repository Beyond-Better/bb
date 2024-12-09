import { ensureDir, exists } from '@std/fs';
import { dirname, join, resolve } from '@std/path';
import { parse as parseYaml } from '@std/yaml';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
//import { logger } from 'shared/logger.ts';

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
