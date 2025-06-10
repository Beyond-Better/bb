import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { PersistenceError, TokenUsageValidationError } from 'api/errors/error.ts';
import type { TokenUsageAnalysis, TokenUsageRecord } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

/**
 * Handles persistence and analysis of token usage records in the new token usage tracking system.
 * Manages separate files for conversation and chat token usage.
 */
export class TokenUsagePersistence {
	private readonly tokenUsageDir: string;
	private readonly conversationFile: string;
	private readonly chatsFile: string;
	private ensuredDir: boolean = false;

	constructor(private conversationDir: string) {
		this.tokenUsageDir = join(this.conversationDir, 'tokenUsage');
		this.conversationFile = join(this.tokenUsageDir, 'conversation.jsonl');
		this.chatsFile = join(this.tokenUsageDir, 'chats.jsonl');
	}

	/**
	 * Initializes the token usage directory structure.
	 * Creates the tokenUsage directory if it doesn't exist.
	 */
	// deno-lint-ignore require-await
	async init(): Promise<TokenUsagePersistence> {
		return this;
	}

	/**
	 * Ensures tokenUsageDir exists, uses ensuredDir to avoid redundant calls
	 */
	private async ensureDirectory(): Promise<void> {
		if (!this.ensuredDir) {
			try {
				await ensureDir(this.tokenUsageDir);
			} catch (error) {
				throw new PersistenceError(
					`Failed to create token usage directory: ${(error as Error).message}`,
					{
						name: 'TokenUsagePersistenceError',
						filePath: this.tokenUsageDir,
						operation: 'write',
					},
				);
			}
		}
	}

	/**
	 * Validates a TokenUsageRecord.
	 *
	 * Throws TokenUsageValidationError for:
	 * - Missing required fields (messageId, timestamp, role, type)
	 * - Invalid role or type values
	 * - Missing required structures (rawUsage, differentialUsage, cacheImpact)
	 * - Missing required fields within structures
	 *
	 * Logs warning but continues for:
	 * - Negative token counts
	 * - Cache impact calculation mismatches
	 * - Savings calculation discrepancies
	 */
	private validateRecord(record: TokenUsageRecord): void {
		// 1. Check required fields first
		const requiredFields = ['messageId', 'timestamp', 'role', 'type'] as const;
		for (const field of requiredFields) {
			if (!record[field]) {
				throw new TokenUsageValidationError(
					`Missing required field: ${field}`,
					{
						name: 'TokenUsageValidationError',
						field,
						constraint: 'required',
					},
				);
			}
		}

		// 2. Validate role and type values
		const validRoles = ['user', 'assistant', 'system'] as const;
		if (!validRoles.includes(record.role as typeof validRoles[number])) {
			throw new TokenUsageValidationError(
				`Invalid role: ${record.role}`,
				{
					name: 'TokenUsageValidationError',
					field: 'role',
					value: record.role,
					constraint: `must be one of: ${validRoles.join(', ')}`,
				},
			);
		}

		const validTypes = ['conversation', 'chat'] as const;
		if (!validTypes.includes(record.type as typeof validTypes[number])) {
			throw new TokenUsageValidationError(
				`Invalid type: ${record.type}`,
				{
					name: 'TokenUsageValidationError',
					field: 'type',
					value: record.type,
					constraint: `must be one of: ${validTypes.join(', ')}`,
				},
			);
		}

		// 3. Check required structures exist
		const structureNames = ['rawUsage', 'differentialUsage', 'cacheImpact'] as const;
		for (const structureName of structureNames) {
			if (!record[structureName]) {
				throw new TokenUsageValidationError(
					`Missing required structure: ${structureName}`,
					{
						name: 'TokenUsageValidationError',
						field: structureName,
						constraint: 'structure is required',
					},
				);
			}
		}

		// Log but continue for negative token counts
		const tokenFields = [
			{ field: 'inputTokens', value: record.rawUsage.inputTokens },
			{ field: 'outputTokens', value: record.rawUsage.outputTokens },
			{ field: 'totalTokens', value: record.rawUsage.totalTokens },
			{ field: 'cacheCreationInputTokens', value: record.rawUsage.cacheCreationInputTokens },
			{ field: 'cacheReadInputTokens', value: record.rawUsage.cacheReadInputTokens },
		];

		for (const { field, value } of tokenFields) {
			if (value !== undefined && value < 0) {
				logger.warn(
					`TokenUsagePersistence: Negative token count in rawUsage.${field}`,
					{
						field: `rawUsage.${field}`,
						value,
						constraint: 'should be non-negative',
						recordId: record.messageId,
					},
				);
			}
		}

		// Validate field types for each structure
		// rawUsage fields
		if (
			typeof record.rawUsage.inputTokens !== 'number' ||
			typeof record.rawUsage.outputTokens !== 'number' ||
			typeof record.rawUsage.totalTokens !== 'number'
		) {
			throw new TokenUsageValidationError(
				'Invalid rawUsage field types',
				{
					name: 'TokenUsageValidationError',
					field: 'rawUsage',
					constraint: 'all fields must be numbers',
				},
			);
		}

		// differentialUsage fields
		if (
			typeof record.differentialUsage.inputTokens !== 'number' ||
			typeof record.differentialUsage.outputTokens !== 'number' ||
			typeof record.differentialUsage.totalTokens !== 'number'
		) {
			throw new TokenUsageValidationError(
				'Invalid differentialUsage field types',
				{
					name: 'TokenUsageValidationError',
					field: 'differentialUsage',
					constraint: 'all fields must be numbers',
				},
			);
		}

		// cacheImpact fields
		if (
			typeof record.cacheImpact.potentialCost !== 'number' ||
			typeof record.cacheImpact.actualCost !== 'number' ||
			typeof record.cacheImpact.savingsTotal !== 'number' ||
			typeof record.cacheImpact.savingsPercentage !== 'number'
		) {
			throw new TokenUsageValidationError(
				'Invalid cacheImpact field types',
				{
					name: 'TokenUsageValidationError',
					field: 'cacheImpact',
					constraint: 'all fields must be numbers',
				},
			);
		}

		// Value validation - log warnings but don't throw

		// 1. Check for negative token counts
		const { inputTokens, outputTokens, totalTokens } = record.rawUsage;
		if (inputTokens < 0 || outputTokens < 0 || totalTokens < 0) {
			logger.warn(
				'TokenUsagePersistence: Negative token counts detected',
				{
					field: 'rawUsage',
					value: { inputTokens, outputTokens, totalTokens },
					constraint: 'token counts should be non-negative',
					recordId: record.messageId,
				},
			);
		}

		// 2. Check cache impact calculations
		const { actualCost, potentialCost, savingsTotal } = record.cacheImpact;
		const cacheValidation = {
			expectedSavings: potentialCost - actualCost,
			actualExceedsPotential: actualCost > potentialCost,
			incorrectSavings: false,
		};
		cacheValidation.incorrectSavings = Math.abs(savingsTotal - cacheValidation.expectedSavings) > 0.0001;

		// Log cache validation warnings
		if (cacheValidation.actualExceedsPotential) {
			logger.warn(
				'TokenUsagePersistence: Cache impact actual cost exceeds potential',
				{
					field: 'cacheImpact',
					value: { actualCost, potentialCost },
					constraint: 'actual cost should not exceed potential cost',
					recordId: record.messageId,
				},
			);
		}

		if (cacheValidation.incorrectSavings) {
			logger.warn(
				'TokenUsagePersistence: Incorrect cache impact savings',
				{
					field: 'cacheImpact.savingsTotal',
					value: { actual: savingsTotal, expected: cacheValidation.expectedSavings },
					constraint: 'savings should equal potential cost minus actual cost',
					recordId: record.messageId,
				},
			);
		}
	}

	/**
	 * Writes a token usage record to the appropriate file based on type.
	 * Validates the record before writing.
	 */
	async writeUsage(record: TokenUsageRecord, type: 'conversation' | 'chat' | 'base'): Promise<void> {
		// Validate type parameter matches record type
		if (record.type !== type) {
			throw new TokenUsageValidationError(
				'Type mismatch',
				{
					name: 'TokenUsageValidationError',
					field: 'type',
					value: { record: record.type, parameter: type },
					constraint: 'record type must match specified type parameter',
				},
			);
		}

		// Validate record - structural errors will throw, value errors will log
		this.validateRecord(record);

		await this.ensureDirectory();
		const filePath = type === 'conversation' ? this.conversationFile : this.chatsFile;
		try {
			const line = JSON.stringify(record) + '\n';
			await Deno.writeTextFile(filePath, line, { append: true });
		} catch (error) {
			throw new PersistenceError(
				`Failed to write token usage record: ${(error as Error).message}`,
				{
					name: 'TokenUsagePersistenceError',
					filePath,
					operation: 'write',
				},
			);
		}
	}

	/**
	 * Reads all token usage records from the specified file type.
	 *
	 * Updates a token usage record in the appropriate file.
	 * Since JSONL files don't support in-place updates, this will:
	 * 1. Read all records
	 * 2. Update the matching record
	 * 3. Write all records back
	 */
	async updateRecord(record: TokenUsageRecord): Promise<void> {
		// Validate the record
		this.validateRecord(record);

		await this.ensureDirectory();
		const filePath = record.type === 'conversation' ? this.conversationFile : this.chatsFile;

		try {
			// Read all records
			const records = await this.getUsage(record.type);

			// Find and update the matching record
			const index = records.findIndex((r) => r.messageId === record.messageId);
			if (index === -1) {
				throw new Error(`Record not found with messageId: ${record.messageId}`);
			}
			records[index] = record;

			// Write all records back
			const content = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
			await Deno.writeTextFile(filePath, content);
		} catch (error) {
			throw new PersistenceError(
				`Failed to update token usage record: ${(error as Error).message}`,
				{
					name: 'TokenUsagePersistenceError',
					filePath,
					operation: 'write',
				},
			);
		}
	}

	async getUsage(type: 'conversation' | 'chat' | 'base'): Promise<TokenUsageRecord[]> {
		try {
			await this.ensureDirectory();
			const filePath = type === 'conversation' ? this.conversationFile : this.chatsFile;
			const content = await Deno.readTextFile(filePath);
			return content
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line))
				.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				return [];
			}
			throw new PersistenceError(
				`Failed to read token usage records: ${(error as Error).message}`,
				{
					name: 'TokenUsagePersistenceError',
					filePath: type === 'conversation' ? this.conversationFile : this.chatsFile,
					operation: 'read',
				},
			);
		}
	}

	async analyzeUsage(type: 'conversation' | 'chat'): Promise<TokenUsageAnalysis> {
		const records = await this.getUsage(type);

		const analysis: TokenUsageAnalysis = {
			totalUsage: {
				input: 0,
				output: 0,
				total: 0,
				cacheCreationInput: 0,
				cacheReadInput: 0,
				thoughtTokens: 0,
				totalAll: 0,
			},
			differentialUsage: { input: 0, output: 0, total: 0 },
			cacheImpact: { potentialCost: 0, actualCost: 0, savingsTotal: 0, savingsPercentage: 0 },
			byRole: { user: 0, assistant: 0, system: 0, tool: 0 },
		};

		for (const record of records) {
			try {
				// Ensure required structures exist
				if (!record.rawUsage || !record.differentialUsage || !record.cacheImpact) {
					logger.warn(
						'TokenUsagePersistence: Skipping malformed record in analysis',
						{
							recordId: record.messageId,
							missing: {
								rawUsage: !record.rawUsage,
								differentialUsage: !record.differentialUsage,
								cacheImpact: !record.cacheImpact,
							},
						},
					);
					continue;
				}

				// Total raw usage
				analysis.totalUsage.input += record.rawUsage.inputTokens || 0;
				analysis.totalUsage.output += record.rawUsage.outputTokens || 0;
				analysis.totalUsage.total += record.rawUsage.totalTokens || 0;
				analysis.totalUsage.cacheCreationInput += record.rawUsage.cacheCreationInputTokens || 0;
				analysis.totalUsage.cacheReadInput += record.rawUsage.cacheReadInputTokens || 0;
				analysis.totalUsage.thoughtTokens += record.rawUsage.thoughtTokens || 0;
				// legacy calc
				// const totalAllTokens =
				// 	(((record.rawUsage.totalTokens ?? 0) > 0 || (record.rawUsage.cacheCreationInputTokens ?? 0) > 0 ||
				// 			(record.rawUsage.cacheReadInputTokens ?? 0) > 0) && !record.rawUsage.totalAllTokens
				// 		? (record.rawUsage.totalTokens ?? 0) + (record.rawUsage.cacheCreationInputTokens ?? 0) +
				// 			(record.rawUsage.cacheReadInputTokens ?? 0)
				// 		: record.rawUsage.totalAllTokens) || 0;
				analysis.totalUsage.totalAll += record.rawUsage.totalAllTokens || 0;

				// Differential usage
				analysis.differentialUsage.input += record.differentialUsage.inputTokens || 0;
				analysis.differentialUsage.output += record.differentialUsage.outputTokens || 0;
				analysis.differentialUsage.total += record.differentialUsage.totalTokens || 0;

				// Cache impact
				analysis.cacheImpact.potentialCost += record.cacheImpact.potentialCost || 0;
				analysis.cacheImpact.actualCost += record.cacheImpact.actualCost || 0;
				analysis.cacheImpact.savingsTotal += record.cacheImpact.savingsTotal || 0;
				// [TODO] savingsPercentage needs to be an avergage, not sum, calculated below
				//analysis.cacheImpact.savingsPercentage += record.cacheImpact.savingsPercentage || 0;

				// Usage by role - only count if we have valid rawUsage
				if (record.role && record.rawUsage.totalTokens !== undefined) {
					analysis.byRole[record.role] += record.rawUsage.totalTokens;
				}
			} catch (error) {
				logger.error(
					'TokenUsagePersistence: Error processing record in analysis',
					{
						recordId: record.messageId,
						error: (error as Error).message,
					},
				);
				// Continue processing other records
				continue;
			}
		}

		// Calculate cache savings percentage
		if (analysis.cacheImpact.potentialCost > 0) {
			analysis.cacheImpact.savingsPercentage =
				(analysis.cacheImpact.savingsTotal / analysis.cacheImpact.potentialCost) * 100;
		}

		return analysis;
	}
}
