import { ensureDir } from '@std/fs';
import { join } from '@std/path';
//import type { WizardAnswers } from 'shared/configManager.ts';
//import { ConfigManager } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

export async function createBbDir(startDir: string): Promise<void> {
	const bbDir = join(startDir, '.bb');
	try {
		await ensureDir(bbDir);
		//logger.info(`Created .bb directory in ${startDir}`);
	} catch (error) {
		logger.error(`Failed to create .bb directory: ${error.message}`);
		throw error;
	}
}

export async function createBbIgnore(startDir: string): Promise<void> {
	const bbIgnorePath = join(startDir, '.bb', 'ignore');
	try {
		const fileInfo = await Deno.stat(bbIgnorePath);
		if (fileInfo.isFile) {
			logger.info('.bb/ignore file already exists, skipping creation');
			return;
		}
	} catch (error) {
		if (!(error instanceof Deno.errors.NotFound)) {
			logger.error(`Error checking .bb/ignore file: ${error.message}`);
			throw error;
		}
		// File doesn't exist, proceed with creation
		try {
			await Deno.writeTextFile(bbIgnorePath, getDefaultBbIgnore());
			//logger.debug('Created .bb/ignore file');
		} catch (writeError) {
			logger.error(`Failed to create .bb/ignore file: ${writeError.message}`);
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
export async function createDefaultConfig(startDir: string, wizardAnswers: WizardAnswers): Promise<void> {
	const configManager = await ConfigManager.getInstance();
	await configManager.ensureUserConfig();

	const projectConfig = {
		...wizardAnswers,
	};

	await configManager.ensureProjectConfig(startDir, projectConfig);
	logger.info('Created default config files');
}
 */
