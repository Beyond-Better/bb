import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import {
	ApiConfigDefaults,
	BuiConfigDefaults,
	CliConfigDefaults,
	DuiConfigDefaults,
	type GlobalConfig,
	GlobalConfigDefaults,
	type ProjectConfig,
} from '../mod.ts';

/**
 * Creates a temporary test environment with mocked config directories
 */
export async function createTestEnv() {
	const testDir = await Deno.makeTempDir();
	await ensureDir(join(testDir, '.bb'));
	await ensureDir(join(testDir, 'global'));

	return {
		testDir,
		cleanup: async () => {
			await Deno.remove(testDir, { recursive: true });
		},
	};
}

/**
 * Sample v1 global configuration for migration testing
 */
export const sampleV1GlobalConfig = {
	version: '1.0.0',
	myPersonsName: 'Test User',
	myAssistantsName: 'Claude',
	noBrowser: false,
	api: {
		apiHostname: 'localhost',
		apiPort: 3162,
		apiUseTls: true,
		anthropicApiKey: 'test-key',
		maxTurns: 25,
		logLevel: 'info',
		usePromptCaching: true,
		userToolDirectories: ['./tools'],
		toolConfigs: {},
	},
	bui: {
		buiHostname: 'localhost',
		buiPort: 8000,
		buiUseTls: true,
	},
	cli: {},
	project: {
		name: 'Test Project',
		type: 'local',
	},
	repoInfo: {
		ctagsAutoGenerate: true,
		tokenLimit: 1024,
	},
};

/**
 * Sample v1 project configuration for migration testing
 */
export const sampleV1ProjectConfig = {
	version: '1.0.0',
	project: {
		name: 'Test Project',
		type: 'local',
		llmGuidelinesFile: 'guidelines.md',
	},
	api: {
		apiPort: 3001,
		apiUseTls: false,
		maxTurns: 50,
	},
	bui: {
		buiPort: 8001,
	},
	cli: {
		defaultEditor: 'vim',
	},
};

/**
 * Sample v2 global configuration for validation testing
 */
export const sampleV2GlobalConfig: GlobalConfig = {
	version: '2.0.0',
	myPersonsName: 'Test User',
	myAssistantsName: 'Claude',
	noBrowser: false,
	bbExeName: 'bb',
	bbApiExeName: 'bb-api',
	defaultModels: {
		orchestrator: 'claude-3-5-sonnet-20241022',
		agent: 'claude-3-5-sonnet-20241022',
		chat: 'claude-3-haiku-20240307',
	},
	api: {
		hostname: 'localhost',
		port: 3162,
		tls: { useTls: true },
		maxTurns: 25,
		logLevel: 'info',
		logFileHydration: false,
		ignoreLLMRequestCache: false,
		usePromptCaching: true,
		userToolDirectories: ['./tools'],
		toolConfigs: {},
		llmKeys: {
			anthropic: 'test-key',
		},
	},
	bui: {
		hostname: 'localhost',
		port: 8000,
		tls: { useTls: true },
	},
	cli: {
		historySize: 1000,
	},
	dui: {
		defaultApiConfig: {},
		projectsDirectory: './projects',
		recentProjects: 5,
	},
};

/**
 * Sample v2 project configuration for validation testing
 */
export const sampleV2ProjectConfig: ProjectConfig = {
	projectId: '123456789abc',
	version: '2.0.0',
	name: 'Test Project',
	type: 'local',
	repoInfo: { tokenLimit: 1024 },
	llmGuidelinesFile: 'guidelines.md',
	settings: {
		api: {
			port: 3001,
			tls: { useTls: false },
		},
		bui: {
			port: 8001,
		},
		cli: {
			defaultEditor: 'vim',
		},
	},
};

/**
 * Mock file system operations for testing
 */
export function mockFileSystem() {
	const files = new Map<string, string>();

	const originalReadFile = Deno.readTextFile;
	const originalWriteFile = Deno.writeTextFile;
	const originalStat = Deno.stat;

	// Mock file reading
	Deno.readTextFile = async (path: string | URL) => {
		const key = path.toString();
		if (!files.has(key)) {
			throw new Deno.errors.NotFound(`File not found: ${key}`);
		}
		return files.get(key)!;
	};

	// Mock file writing
	Deno.writeTextFile = async (path: string | URL, content: string | ReadableStream<string>) => {
		files.set(path.toString(), content as string);
	};

	// Mock file stats
	Deno.stat = async (path: string | URL) => {
		const key = path.toString();
		if (!files.has(key)) {
			throw new Deno.errors.NotFound(`File not found: ${key}`);
		}
		return {
			isFile: true,
			isDirectory: false,
			size: files.get(key)!.length,
			mtime: new Date(),
			atime: new Date(),
			birthtime: new Date(),
			dev: 0,
			ino: 0,
			mode: 0,
			nlink: 1,
			uid: 0,
			gid: 0,
			rdev: 0,
			blksize: 4096,
			blocks: 1,
		} as Deno.FileInfo;
	};

	return {
		files,
		cleanup: () => {
			Deno.readTextFile = originalReadFile;
			Deno.writeTextFile = originalWriteFile;
			Deno.stat = originalStat;
		},
	};
}
