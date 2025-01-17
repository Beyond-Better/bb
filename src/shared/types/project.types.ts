import { DefaultModels, ProjectType, RepoInfoConfigSchema } from 'shared/config/v2/types.ts';

export interface Project {
	projectId: string;
	name: string;
	path: string;
	type: ProjectType;
	myPersonsName?: string;
	myAssistantsName?: string;
	defaultModels?: DefaultModels;
	llmGuidelinesFile?: string;
	repoInfo?: RepoInfoConfigSchema;
	stats?: ProjectStats;
	settings?: {
		api?: {
			maxTurns?: number;
			toolConfigs?: Record<string, unknown>;
		};
	};
}

// export interface ConfigValue<T> {
// 	value: T;
// 	source: 'global' | 'project';
// }
export interface ConfigValue<T> {
	global: T;
	project: T | null; // undefined means use global value
}

export interface ProjectWithSources
	extends Omit<Project, 'myPersonsName' | 'myAssistantsName' | 'settings' | 'llmGuidelinesFile'> {
	myPersonsName: ConfigValue<string | undefined>;
	myAssistantsName: ConfigValue<string | undefined>;
	llmGuidelinesFile: ConfigValue<string | undefined>;
	settings: {
		api: {
			maxTurns: ConfigValue<number | undefined>;
			toolConfigs: ConfigValue<Record<string, unknown> | undefined>;
		};
	};
}

export interface ProjectStats {
	conversationCount: number;
	totalTokens: number;
	lastAccessed: string;
}
