import { join } from '@std/path';
import { PersistenceError } from 'api/errors/error.ts';
import type { LLMRequestRecord } from 'shared/types.ts';
//import { logger } from 'shared/logger.ts';

/**
 * Handles persistence for llm request records.
 */
export class LLMRequestPersistence {
	private readonly llmRequestFile: string;

	constructor(private conversationDir: string) {
		this.llmRequestFile = join(this.conversationDir, 'llmRequests.jsonl');
	}

	/**
	 * Initializes the token usage directory structure.
	 * Creates the llmRequest directory if it doesn't exist.
	 */
	async init(): Promise<LLMRequestPersistence> {
		return this;
	}

	/**
	 * Writes a token usage record to the appropriate file based on type.
	 * Validates the record before writing.
	 */
	async writeLLMRequest(record: LLMRequestRecord): Promise<void> {
		try {
			const line = JSON.stringify(record) + '\n';
			await Deno.writeTextFile(this.llmRequestFile, line, { append: true });
		} catch (error) {
			throw new PersistenceError(
				`Failed to write token usage record: ${(error as Error).message}`,
				{
					name: 'PersistenceError',
					filePath: this.llmRequestFile,
					operation: 'write',
				},
			);
		}
	}

	/**
	 * Reads all token usage records from the specified file type.
	 */
	async getLLMRequest(): Promise<LLMRequestRecord[]> {
		try {
			const content = await Deno.readTextFile(this.llmRequestFile);
			return content
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line));
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				return [];
			}
			throw new PersistenceError(
				`Failed to read token usage records: ${(error as Error).message}`,
				{
					name: 'PersistenceError',
					filePath: this.llmRequestFile,
					operation: 'read',
				},
			);
		}
	}
}
