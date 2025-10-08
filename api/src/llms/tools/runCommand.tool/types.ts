import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

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
	dataSourceId?: string;
	command: string;
	args?: string[];
	cwd?: string;
	outputTruncation?: OutputTruncationConfig;
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

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolRunCommandResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: LLMToolRunCommandResponseData;
}
