// import { simpleMerge } from '@cross/deepmerge';
import { deepMerge, DeepMergeOptions } from '@cross/deepmerge';

export interface ApiConfigSchema {
	maxTurns?: number;
	anthropicApiKey?: string;
	openaiApiKey?: string;
	voyageaiApiKey?: string;
	environment?: string;
	apiHostname?: string;
	apiPort?: number;
	apiUseTls?: boolean;
	tlsKeyFile?: string;
	tlsCertFile?: string;
	tlsRootCaFile?: string;
	tlsKeyPem?: string;
	tlsCertPem?: string;
	tlsRootCaPem?: string;
	ignoreLLMRequestCache?: boolean;
	usePromptCaching?: boolean;
	logFile?: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	logFileHydration?: boolean;
	userToolDirectories: string[];
	toolConfigs: Record<string, unknown>;
}
export interface BuiConfigSchema {
	environment?: string;
	buiHostname?: string;
	buiPort?: number;
	buiUseTls?: boolean;
	tlsKeyFile?: string;
	tlsCertFile?: string;
	tlsRootCaFile?: string;
	tlsKeyPem?: string;
	tlsCertPem?: string;
	tlsRootCaPem?: string;
}
export interface RepoInfoConfigSchema {
	ctagsAutoGenerate: boolean;
	ctagsFilePath?: string;
	tokenLimit?: number;
}
export interface ProjectDataConfigSchema {
	name: string;
	type: 'local' | 'git';
	llmGuidelinesFile?: string;
}

export interface GlobalConfigSchema {
	myPersonsName?: string;
	myAssistantsName?: string;
	noBrowser?: boolean;
	api: ApiConfigSchema;
	bui: BuiConfigSchema;
	cli: Record<string, unknown>;
	project: ProjectDataConfigSchema;
	repoInfo: RepoInfoConfigSchema;
	version: string;
	bbExeName: string;
	bbApiExeName: string;
}

export interface ProjectConfigSchema {
	myPersonsName?: string;
	myAssistantsName?: string;
	noBrowser?: boolean;
	project: ProjectDataConfigSchema;
	repoInfo: RepoInfoConfigSchema;
	api: ApiConfigSchema;
	bui: BuiConfigSchema;
	cli: Record<string, unknown>;
}

export interface FullConfigSchema extends GlobalConfigSchema, ProjectConfigSchema {}

export const defaultGlobalConfig: GlobalConfigSchema = {
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	noBrowser: false,
	api: {
		environment: 'local',
		apiHostname: 'localhost',
		apiPort: 3162,
		apiUseTls: true,
		ignoreLLMRequestCache: false,
		usePromptCaching: true,
		logFile: 'api.log',
		logLevel: 'info',
		logFileHydration: false,
		toolConfigs: {},
		userToolDirectories: ['./tools'], // This will be resolved to an absolute path by ConfigManager
		maxTurns: 25, // Maximum number of turns in a conversation
	},
	bui: {
		environment: 'local',
		buiHostname: 'localhost',
		buiPort: 8080,
		buiUseTls: true,
	},
	cli: {},
	repoInfo: {
		ctagsAutoGenerate: true,
		tokenLimit: 1024,
	},
	project: {
		name: Deno.cwd(),
		type: 'local',
	},
	version: 'unknown', // This will be overwritten by the actual version from version.ts
	bbExeName: 'bb', // This will be overwritten by the correct exe name when creating globalConfig
	bbApiExeName: 'bb-api', // This will be overwritten by the correct exe name when creating globalConfig
};

export const defaultProjectConfig: ProjectConfigSchema = {
	myPersonsName: Deno.env.get('USER') || 'User',
	myAssistantsName: 'Claude',
	noBrowser: false,
	api: {
		environment: 'local',
		apiHostname: 'localhost',
		apiPort: 3162,
		apiUseTls: true,
		ignoreLLMRequestCache: false,
		usePromptCaching: true,
		logFile: 'api.log',
		logLevel: 'info',
		logFileHydration: false,
		toolConfigs: {},
		userToolDirectories: ['./tools'], // This will be resolved to an absolute path by ConfigManager
	},
	bui: {
		environment: 'local',
		buiHostname: 'localhost',
		buiPort: 8080,
		buiUseTls: true,
	},
	cli: {},
	repoInfo: {
		ctagsAutoGenerate: true,
		tokenLimit: 1024,
	},
	project: {
		name: Deno.cwd(),
		type: 'local',
	},
};

export function mergeConfigs(
	globalConfig: GlobalConfigSchema,
	projectConfig: ProjectConfigSchema,
	envConfig: Partial<FullConfigSchema>,
): FullConfigSchema {
	const options: DeepMergeOptions = {
		arrayMergeStrategy: 'unique',
		setMergeStrategy: 'combine',
		mapMergeStrategy: 'combine',
	};

	// [TODO] there seems to be a bug (or unexpected behaviour) when merging multiple objects at once
	// If both `defaultGlobalConfig` and `globalConfig` are included at the same time in the list of config
	// the merge doesn't work as expected, in particular the `api.apiPort` is always the value set in `defaultGlobalConfig`
	// regardless of any value set in `projectConfig`.
	// I'm leaving this code for future debugging, and going with the `reduce` function which merges each config one-by-one.
	/*
	console.log('defaultGlobalConfig', JSON.stringify(defaultGlobalConfig, null, 2));
	console.log('defaultProjectConfig', JSON.stringify(defaultProjectConfig, null, 2));
	console.log('globalConfig', JSON.stringify(globalConfig, null, 2));
	console.log('projectConfig', JSON.stringify(projectConfig, null, 2));
	console.log('envConfig', JSON.stringify(envConfig, null, 2));

	// Start with defaultGlobalConfig
	let mergedConfig = deepMerge.withOptions(options, {}, defaultGlobalConfig);
	console.log('After merging defaultGlobalConfig:', JSON.stringify(mergedConfig, null, 2));

	// Merge defaultProjectConfig
	mergedConfig = deepMerge.withOptions(options, mergedConfig, defaultProjectConfig);
	console.log('After merging defaultProjectConfig:', JSON.stringify(mergedConfig, null, 2));

	// Merge globalConfig
	mergedConfig = deepMerge.withOptions(options, mergedConfig, globalConfig);
	console.log('After merging globalConfig:', JSON.stringify(mergedConfig, null, 2));

	// Merge projectConfig
	mergedConfig = deepMerge.withOptions(options, mergedConfig, projectConfig);
	console.log('After merging projectConfig:', JSON.stringify(mergedConfig, null, 2));

	// Merge envConfig
	mergedConfig = deepMerge.withOptions(options, mergedConfig, envConfig);
	console.log('After merging envConfig:', JSON.stringify(mergedConfig, null, 2));
 */

	const mergedConfig = [defaultGlobalConfig, defaultProjectConfig, globalConfig, projectConfig, envConfig].reduce(
		(acc, config) => deepMerge.withOptions(options, acc, config),
		{},
	);

	//console.log('Final mergedConfig', JSON.stringify(mergedConfig, null, 2));
	return mergedConfig as FullConfigSchema;
}
