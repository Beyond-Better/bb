import { join } from '@std/path';
import { exists } from '@std/fs';
import { getConfigManager } from 'shared/config/configManager.ts';
import { getWorkingRootFromStartDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';
import { countTokens } from 'anthropic-tokenizer';
//import { contentType } from '@std/media-types';

const TIERS = [
	{ args: ['-R', '--fields=+l', '--languages=all'] },
	{ args: ['-R', '--fields=+l', '--languages=c,c++,javascript,typescript,python,java,go'] },
	{
		args: [
			'-R',
			'--fields=+l',
			'--languages=c,c++,javascript,typescript,python,java,go',
			'--kinds-c-=-v',
			'--kinds-c++=-v',
			'--kinds-javascript=-v',
			'--kinds-typescript=-v',
			'--kinds-python=-v',
			'--kinds-java=-v',
			'--kinds-go=-v',
		],
	},
	{
		args: [
			'-R',
			'--fields=+l',
			'--languages=c,c++,javascript,typescript,python,java,go',
			'--kinds-c-=-v,-p',
			'--kinds-c++=-v,-p',
			'--kinds-javascript=-v,-p',
			'--kinds-typescript=-v,-p',
			'--kinds-python=-v,-p',
			'--kinds-java=-v,-p',
			'--kinds-go=-v,-p',
		],
	},
	{
		args: [
			'-R',
			'--fields=+l',
			'--languages=c,c++,javascript,typescript,python,java,go',
			'--kinds-c-=f,c,m',
			'--kinds-c++=f,c,m',
			'--kinds-javascript=f,c,m',
			'--kinds-typescript=f,c,m',
			'--kinds-python=f,c,m',
			'--kinds-java=f,c,m',
			'--kinds-go=f,c,m',
		],
	},
];

/*
const FILE_LISTING_TIERS = [
	{ depth: Infinity, includeMetadata: true },
	{ depth: Infinity, includeMetadata: false },
	{ depth: 5, includeMetadata: false },
	{ depth: 3, includeMetadata: false },
	{ depth: 2, includeMetadata: false },
	{ depth: 1, includeMetadata: false },
];
 */

async function generateCtagsTier(
	workingRoot: string,
	ctagsFilePath: string,
	tier: number,
	tokenLimit: number,
): Promise<boolean> {
	const excludeOptions = await getExcludeOptions(workingRoot);

	const command = new Deno.Command('ctags', {
		args: [...TIERS[tier].args, '-f', ctagsFilePath, ...excludeOptions, '.'],
		cwd: workingRoot,
	});

	try {
		const { code, stderr } = await command.output();
		if (code !== 0) {
			logger.error(`Failed to generate ctags: ${new TextDecoder().decode(stderr)}`);
			return false;
		}

		const content = await Deno.readTextFile(ctagsFilePath);
		const tokenCount = countTokens(content);
		logger.info(`Created tags for ${tier} using ${tokenCount} tokens - args: ${TIERS[tier].args.join(' ')}`);
		return tokenCount <= tokenLimit;
	} catch (error) {
		logger.error(`Error executing ctags command: ${(error as Error).message}`);
		return false;
	}
}

async function getExcludeOptions(workingRoot: string): Promise<string[]> {
	const excludeFiles = [
		join(workingRoot, 'tags.ignore'),
		join(workingRoot, '.gitignore'),
		join(workingRoot, '.bb', 'tags.ignore'),
	];

	const excludeOptions = [];
	for (const file of excludeFiles) {
		if (await exists(file)) {
			excludeOptions.push(`--exclude=@${file}`);
		}
	}

	if (excludeOptions.length === 0) {
		excludeOptions.push('--exclude=.bb/*');
	}

	return excludeOptions;
}

export async function generateCtags(bbDir: string, projectId: string): Promise<string | null> {
	const configManager = await getConfigManager();
	const projectConfig = await configManager.getProjectConfig(projectId);
	const repoInfoConfig = projectConfig.repoInfo;
	const workingRoot = await getWorkingRootFromStartDir(bbDir);

	if (repoInfoConfig?.ctagsAutoGenerate === false) {
		logger.info('Ctags auto-generation is disabled');
		return null;
	}

	const ctagsFilePath = repoInfoConfig?.ctagsFilePath ? repoInfoConfig.ctagsFilePath : join(bbDir, 'tags');
	const tokenLimit = repoInfoConfig?.tokenLimit || 1024;
	logger.info(`Ctags using tags file: ${ctagsFilePath}, token limit: ${tokenLimit}`);

	for (let tier = 0; tier < TIERS.length; tier++) {
		logger.info(`Attempting to generate ctags with tier ${tier}`);
		if (await generateCtagsTier(workingRoot, ctagsFilePath, tier, tokenLimit)) {
			logger.info(`Ctags file generated successfully at ${ctagsFilePath} using tier ${tier}`);
			return await Deno.readTextFile(ctagsFilePath);
		}
	}

	logger.warn(`Failed to generate ctags file within token limit (${tokenLimit}) after all tiers.`);
	return null;
}

export async function readCtagsFile(bbDir: string, projectId: string): Promise<string | null> {
	const configManager = await getConfigManager();
	const projectConfig = await configManager.getProjectConfig(projectId);
	const repoInfoConfig = projectConfig.repoInfo;

	const ctagsFilePath = repoInfoConfig?.ctagsFilePath
		? join(bbDir, repoInfoConfig.ctagsFilePath)
		: join(bbDir, 'tags');

	if (await exists(ctagsFilePath)) {
		try {
			return await Deno.readTextFile(ctagsFilePath);
		} catch (error) {
			logger.error(`Error reading ctags file: ${(error as Error).message}`);
		}
	}

	return null;
}
