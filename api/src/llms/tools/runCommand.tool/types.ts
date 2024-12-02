import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolRunCommandInput {
	command: string;
	args?: string[];
	cwd?: string;
}

export interface LLMToolRunCommandResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: {
		data: {
			code: number;
			command: string;
			stderrContainsError: boolean;
			stdout: string;
			stderr: string;
		};
	};
}
