import { dirname, join } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { ConfigManager } from 'shared/configManager.ts';

export interface InstallLocation {
	type: 'system' | 'user';
	path: string;
	writable: boolean;
}

const USER_BB_DIR = join(Deno.env.get('HOME') || '~', '.bb');
const USER_BB_BIN = join(USER_BB_DIR, 'bin');
const SYSTEM_BB_BIN = '/usr/local/bin';

export async function getCurrentInstallLocation(): Promise<InstallLocation> {
	const bbPath = await Deno.realPath(Deno.execPath());

	if (bbPath.startsWith(USER_BB_BIN)) {
		return {
			type: 'user',
			path: USER_BB_BIN,
			writable: await isDirectoryWritable(USER_BB_BIN),
		};
	}

	return {
		type: 'system',
		path: SYSTEM_BB_BIN,
		writable: await isDirectoryWritable(SYSTEM_BB_BIN),
	};
}

export async function ensureUserInstallLocation(): Promise<boolean> {
	try {
		await ensureDir(USER_BB_DIR);
		await ensureDir(USER_BB_BIN);
		return await isDirectoryWritable(USER_BB_BIN);
	} catch {
		return false;
	}
}

async function isDirectoryWritable(dir: string): Promise<boolean> {
	try {
		// First check if directory exists
		if (!await exists(dir)) {
			// Try to create it
			await ensureDir(dir);
		}

		// Try to write a temporary file
		const testFile = join(dir, '.write-test');
		await Deno.writeTextFile(testFile, 'test');
		await Deno.remove(testFile);
		return true;
	} catch {
		return false;
	}
}
