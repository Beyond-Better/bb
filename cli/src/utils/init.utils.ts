import { ensureDir } from '@std/fs';
import { join } from '@std/path';
//import type { WizardAnswers } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

/*
export async function createDefaultConfig(workingRoot: string, wizardAnswers: WizardAnswers): Promise<void> {
	const configManager = await getConfigManager();
	// v2 handles config creation differently
	// await configManager.ensureUserConfig();

	const projectConfig = {
		...wizardAnswers,
	};

	const projectPersistenceManager = await getProjectPersistenceManager();
	const projectData = await projectPersistenceManager.createProject(projectConfig.name, projectConfig.type as ProjectType, workingRoot);
	logger.info('Created default config files');
}
 */
