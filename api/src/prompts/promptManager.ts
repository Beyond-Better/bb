import { join } from '@std/path';
import { exists } from '@std/fs';
import { parse as parseYaml } from '@std/yaml';
import { stripIndents } from 'common-tags';
import { getBbDir, readFileContent, resolveFilePath } from 'shared/dataDir.ts';
import * as defaultPrompts from './defaultPrompts.ts';
import { ConfigManager, type FullConfigSchema } from 'shared/configManager.ts';
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
	private fullConfig!: FullConfigSchema;

	constructor() {
		this.userPromptsDir = '';
	}

	async init(projectRoot: string): Promise<PromptManager> {
		const bbDir = await getBbDir(projectRoot);
		this.userPromptsDir = join(bbDir, 'prompts');
		this.fullConfig = await ConfigManager.fullConfig(projectRoot);
		return this;
	}

	public async loadGuidelines(): Promise<string | null> {
		const guidelinesPath = this.fullConfig.project.llmGuidelinesFile;
		if (!guidelinesPath) {
			return null;
		}

		const resolvedPath = await resolveFilePath(guidelinesPath);
		return await readFileContent(resolvedPath);
	}

	async getPrompt(promptName: string, variables: Record<string, unknown> = {}): Promise<string> {
		const userPrompt = await this.loadUserPrompt(promptName);
		const defaultPrompt = defaultPrompts[promptName as keyof typeof defaultPrompts];

		if (!userPrompt && !defaultPrompt) {
			throw new Error(`Prompt '${promptName}' not found`);
		}

		if (userPrompt) {
			return this.applyTemplate(userPrompt.content, variables);
		}

		if (defaultPrompt) {
			return defaultPrompt.getContent(variables);
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
