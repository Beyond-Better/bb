import { ensureDir } from '@std/fs';
import { join } from '@std/path';
//import type { WizardAnswers } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';


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
