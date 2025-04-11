import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface OutputTruncationLines {
	head?: number;
	tail?: number;
}

export interface OutputTruncationConfig {
	keepLines?: {
		stdout?: OutputTruncationLines;
		stderr?: OutputTruncationLines;
	};
}

export interface LLMToolRunCommandInput {
	command: string;
	args?: string[];
	cwd?: string;
	outputTruncation?: OutputTruncationConfig;
	dataSource?: string;
}

export interface LLMToolRunCommandResponseData {
	data: {
		code: number;
		command: string;
		stderrContainsError: boolean;
		stdout: string;
		stderr: string;
		truncatedInfo?: {
			stdout?: {
				originalLines: number;
				keptLines: number;
			};
			stderr?: {
				originalLines: number;
				keptLines: number;
			};
		};
		dataSourceId: string;
	};
}

export interface LLMToolRunCommandResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolRunCommandResponseData;
}
