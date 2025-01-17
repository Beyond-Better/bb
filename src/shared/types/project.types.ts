import {ProjectType, DefaultModels, RepoInfoConfigSchema} from 'shared/config/v2/types.ts';

export interface Project {
	projectId: string;
	name: string;
	type: ProjectType;
	myPersonsName?: string;
	myAssistantsName?: string;
	defaultModels?: DefaultModels;
	llmGuidelinesFile?: string;
	repoInfo?: RepoInfoConfigSchema;
}
