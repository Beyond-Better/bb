import { join } from '@std/path';
import { exists } from '@std/fs';
import { parse as parseYaml } from '@std/yaml';
import { stripIndents } from 'common-tags';
import { getBbDir } from 'shared/dataDir.ts';
import * as defaultPrompts from './defaultPrompts.ts';
import type { PromptVariableMap } from './defaultPrompts.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import type { ProjectId } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

interface PromptMetadata {
	name: string;
	description: string;
	version: string;
}

interface Prompt {
	metadata: PromptMetadata;
	content: string;
}

class PromptManager {
	private userPromptsDir: string;
	private projectConfig!: ProjectConfig;

	constructor() {
		this.userPromptsDir = '';
	}

	async init(projectId: ProjectId): Promise<PromptManager> {
		try {
			const bbDir = await getBbDir(projectId);
			this.userPromptsDir = join(bbDir, 'prompts');
		} catch (error) {
			logger.error(`PromptManager: Could not set userPromptsDir: ${(error as Error).message}`);
		}
		const configManager = await getConfigManager();
		this.projectConfig = await configManager.getProjectConfig(projectId);
		return this;
	}

	async getPrompt<K extends keyof PromptVariableMap>(
		promptName: K,
		variables: PromptVariableMap[K],
	): Promise<string> {
		const userPrompt = await this.loadUserPrompt(promptName);
		const defaultPrompt = defaultPrompts[promptName as keyof typeof defaultPrompts];

		if (!userPrompt && !defaultPrompt) {
			throw new Error(`Prompt '${promptName}' not found`);
		}

		if (userPrompt) {
			return this.applyTemplate(userPrompt.content, variables);
		}

		if (defaultPrompt) {
			return (defaultPrompt.getContent as (vars: PromptVariableMap[K]) => Promise<string>)(variables);
		}

		throw new Error(`Prompt '${promptName}' content not found`);
	}

	private async loadUserPrompt(promptName: string): Promise<Prompt | null> {
		const promptPath = join(this.userPromptsDir, `${promptName}.md`);
		if (!(await exists(promptPath))) {
			return null;
		}

		const content = await Deno.readTextFile(promptPath);
		const [metadataStr, promptContent] = content.split('---\n').slice(1);

		const metadata = parseYaml(metadataStr) as PromptMetadata;
		return {
			metadata,
			content: stripIndents(promptContent.trim()),
		};
	}

	applyTemplate(template: string, variables: Record<string, unknown>): string {
		return stripIndents(template).replace(
			/\${(.*?)}/g,
			(_, expr) => {
				try {
					// Create a function that takes variables as arguments and evaluates the expression
					const func = new Function(...Object.keys(variables), `return ${expr};`);
					return func(...Object.values(variables));
				} catch (error) {
					logger.error(`Error evaluating expression: ${expr}`, error);
					return `\${${expr}}`;
				}
			},
		);
	}

	// Basic validation for user-supplied prompts
	validatePrompt(prompt: Prompt): boolean {
		if (!prompt.metadata || !prompt.content) {
			return false;
		}
		if (!prompt.metadata.name || !prompt.metadata.description || !prompt.metadata.version) {
			return false;
		}
		return true;
	}
}

export default PromptManager;
