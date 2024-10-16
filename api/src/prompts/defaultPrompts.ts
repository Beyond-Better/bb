import { stripIndents } from 'common-tags';

import { readFileContent, resolveFilePath } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';
import type { GlobalConfigSchema } from 'shared/configSchema.ts';

interface PromptMetadata {
	name: string;
	description: string;
	version: string;
}

interface Prompt {
	metadata: PromptMetadata;
	getContent: (variables: Record<string, unknown>) => Promise<string>;
}

export const system: Prompt = {
	metadata: {
		name: 'System Prompt',
		description: 'Default system prompt for BB',
		version: '1.0.0',
	},
	getContent: async ({ userDefinedContent = '', fullConfig }) => {
		let guidelines;
		const guidelinesPath = (fullConfig as GlobalConfigSchema).project.llmGuidelinesFile;
		if (guidelinesPath) {
			try {
				const resolvedPath = await resolveFilePath(guidelinesPath);
				guidelines = await readFileContent(resolvedPath) || '';
			} catch (error) {
				logger.error(`Failed to load guidelines: ${error.message}`);
			}
		}

		const myPersonsName = (fullConfig as GlobalConfigSchema).myPersonsName;
		const myAssistantsName = (fullConfig as GlobalConfigSchema).myAssistantsName;

		return stripIndents`
		  You are an AI assistant named ${myAssistantsName}, an expert at a variety of coding and writing tasks. Your capabilities include:
	
		  1. Analyzing and modifying programming code in any language
		  2. Reviewing and enhancing documentation and prose
		  3. Assisting with fiction writing and creative content
		  4. Crafting and refining LLM prompts
		  5. Working with HTML, SVG, and various markup languages
		  6. Handling configuration files and data formats (JSON, YAML, etc.)
	
		  You are facilitating a conversation between "BB" (an AI-powered writing assistant) and the user named "${myPersonsName}". All conversation messages will be labeled as either 'assistant' or 'user'. The 'user' messages will contain instructions from both "BB" and "${myPersonsName}". You should respect instructions from both "BB" and "${myPersonsName}" but always prioritize instructions or comments from ${myPersonsName}. When addressing the user, refer to them as "${myPersonsName}". When providing instructions for the writing assistant, refer to it as "BB". Wrap instructions for "BB" with <bb> XML tags. Always prefer using a tool rather than writing instructions to "BB".
	
		  In each conversational turn, you will begin by thinking about your response. Once you're done, you will write a user-facing response for "${myPersonsName}". It's important to place all user-facing conversational responses in <reply></reply> XML tags to make them easy to parse.
	
		  You have access to a local project and can work with files that have been added to the conversation. When responding to tool use requests for adding files, you should prefer to use the project information inside <project-details> tags, provided as a source for looking up file names. When a file is no longer relevant to the current conversation, you can request its removal using the provided tool.

          When using tools, include multiple tool uses in one response where feasible to reduce the cost of repeated message turns. Ensure that all required parameters for each tool call are provided or can reasonably be inferred from context. If there are no relevant tools or there are missing values for required parameters, ask the user to supply these values; otherwise proceed with the tool calls. If multiple independent tool calls can be made, include them all in the same response.
	
		  Always strive to provide helpful, accurate, and context-aware assistance. You may engage with ${myPersonsName} on topics of their choice, but always aim to keep the conversation relevant to the local project and the task at hand.

		  ${userDefinedContent ? `\n${userDefinedContent}\n` : ''}
		  ${guidelines ? `<guidelines>:\n${guidelines}\n</guidelines>` : ''}
		`;
	},
};

export const addFiles: Prompt = {
	metadata: {
		name: 'Add Files Prompt',
		description: 'Prompt for adding files to the conversation',
		version: '1.0.0',
	},
	getContent: async ({ fileList }) =>
		stripIndents`
		  The following files have been added to the conversation:
	  
		  ${(fileList as string[]).map((file: string) => `- ${file}`).join('\n')}
	  
		  Please review these files and provide any relevant insights or suggestions based on their content.
		`,
};

export const gitCommitMessage: Prompt = {
	metadata: {
		name: 'Create git Commit Prompt',
		description: 'Prompt for creating a git commit message',
		version: '1.0.0',
	},
	getContent: async ({ changedFiles }) => {
		return stripIndents`
		  Generate a concise, single-line git commit message in past tense describing the purpose of the changes in the provided diffs. If necessary, add a blank line followed by a brief detailed explanation. Respond with only the commit message, without any additional text.
	  
		  <changed-files>
		  ${(changedFiles as string[]).join('\n')}
		  </changed-files>
		`;
	},
};

// Add other default prompts here as needed

/*
undo_command_reply =
Last changes discarded via git reset. Await further instructions before repeating. You may inquire about the reversion rationale.
 */

/*
added_files =
Files added to chat: ${filePaths}. Proceed with analysis.
 */

/*
run_output =
Command executed: ${cmdString}
Output:
${cmdOutput}

Analyze and proceed accordingly.
 */

/*
summarize =
Summarize this partial conversation, focusing on recent messages. Organize by topic. Include function names, libraries, packages, and referenced filenames. Exclude code blocks. Write in first person as the user, addressing the assistant as "you". Begin with "I asked you...". Avoid conclusive language.
 */

/*
summary_prefix = "I spoke to you previously about a number of things.\n"
 */
