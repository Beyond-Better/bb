import { ensureDir } from '@std/fs';
import { join } from '@std/path';
//import type { WizardAnswers } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

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

/*
export async function createDefaultConfig(projectRoot: string, wizardAnswers: WizardAnswers): Promise<void> {
	const configManager = await ConfigManagerV2.getInstance();
	// v2 handles config creation differently
	// await configManager.ensureUserConfig();

	const projectConfig = {
		...wizardAnswers,
	};

	await configManager.createProject(projectConfig.name, projectConfig.type as ProjectType, projectRoot);
	logger.info('Created default config files');
}
 */
