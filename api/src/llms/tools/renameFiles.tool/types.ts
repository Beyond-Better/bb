// Tool-specific type definitions for the renameFiles tool
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolRenameFilesInput {
	operations: Array<{
		source: string;
		destination: string;
	}>;
	createMissingDirectories?: boolean;
	overwrite?: boolean;
}

export interface LLMToolRenameFilesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: {
		data: {
			filesRenamed: Array<{
				source: string;
				destination: string;
			}>;
			filesError: Array<{
				source: string;
				destination: string;
				error?: string;
			}>;
		};
	};
}
