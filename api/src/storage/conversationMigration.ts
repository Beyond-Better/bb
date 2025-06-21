import { join } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { logger } from 'shared/logger.ts';
import { TokenUsagePersistence } from './tokenUsagePersistence.ts';
import type {
	CollaborationMetadata,
	InteractionMetadata,
	ProjectId,
	TokenUsage,
	TokenUsageAnalysis,
} from 'shared/types.ts';

export interface ConversationsFileV1 {
	version: string;
	conversations: InteractionMetadata[];
}

export interface InteractionsFileV4 {
	version: string;
	interactions: InteractionMetadata[];
}

export interface CollaborationsFileV4 {
	version: string;
	collaborations: CollaborationMetadata[];
}
import type { CollaborationParams } from 'shared/types/collaboration.ts';
import { getProjectAdminDataDir } from 'shared/projectPath.ts';

export interface MigrationResult {
	total: number;
	migrated: number;
	skipped: number;
	failed: number;
	results: Array<{
		conversationId: string;
		result: ConversationMigrationResult;
	}>;
}

export interface ConversationMigrationResult {
	success: boolean;
	version: {
		from: number;
		to: number;
	};
	changes: Array<{
		type: string;
		path: string;
		details: string;
	}>;
	errors: Array<{
		message: string;
		details?: unknown;
	}>;
}

export class ConversationMigration {
	static async migrateProject(dataDir: string): Promise<MigrationResult> {
		const result: MigrationResult = {
			total: 0,
			migrated: 0,
			skipped: 0,
			failed: 0,
			results: [],
		};

		try {
			// Read conversations.json
			const conversations = await ConversationMigration.readConversationsJson(dataDir);
			result.total = conversations.length;

			// Track which conversations need updating in conversations.json
			const updatedInteractions: InteractionMetadata[] = [];
			let needsUpdate = false;

			// Process each conversation
			for (const conversation of conversations) {
				const conversationDir = join(dataDir, 'conversations', conversation.id);
				try {
					const migrationResults = await ConversationMigration.migrateConversation(conversationDir);
					for (const migrationResult of migrationResults) {
						result.results.push({
							conversationId: conversation.id,
							result: migrationResult,
						});

						if (migrationResult.success) {
							if (migrationResult.version.from === migrationResult.version.to) {
								result.skipped++;
							} else {
								result.migrated++;
								needsUpdate = true;
							}
						} else if (migrationResult.errors[0]?.message.startsWith('Legacy conversation:')) {
							// Handle legacy conversations (pre-v1) by skipping them
							result.skipped++;
							logger.info(`Skipping legacy conversation ${conversation.id}`);
						} else {
							// Handle actual migration failures
							result.failed++;
							logger.error(
								`Failed to migrate conversation ${conversation.id}: ${
									migrationResult.errors[0]?.message
								}`,
								{ error: migrationResult.errors[0]?.details },
							);
						}
					}

					const finalMigration = migrationResults[migrationResults.length - 1];
					if (finalMigration.success) {
						if (finalMigration.version.from === finalMigration.version.to) {
							updatedInteractions.push(conversation);
						} else {
							// Get updated metadata for conversations.json
							const metadata = await ConversationMigration.readMetadata(
								join(conversationDir, 'metadata.json'),
							);
							updatedInteractions.push(metadata);
						}
					} else if (finalMigration.errors[0]?.message.startsWith('Legacy conversation:')) {
						// Handle legacy conversations (pre-v1) by skipping them
						updatedInteractions.push(conversation);
					} else {
						// Handle actual migration failures
						updatedInteractions.push(conversation);
					}
				} catch (error) {
					// Handle unexpected errors during migration
					result.failed++;
					logger.error(
						`Failed to migrate conversation ${conversation.id}: ${(error as Error).message}`,
						{ error },
					);
					updatedInteractions.push(conversation);
				}
			}

			// Update conversations.json if any migrations were successful
			if (needsUpdate) {
				await ConversationMigration.saveConversationsJson(dataDir, updatedInteractions);
			}

			return result;
		} catch (error) {
			logger.error(
				`Failed to migrate conversations: ${(error as Error).message}`,
				{ error },
			);
			throw error;
		}
	}

	static async migrateConversation(conversationDir: string): Promise<Array<ConversationMigrationResult>> {
		try {
			// Get current metadata to check version
			const metadata = await ConversationMigration.readMetadata(join(conversationDir, 'metadata.json'));
			const currentVersion = metadata.version || 1;

			// Call appropriate migration method based on current version
			switch (currentVersion) {
				case 1: {
					const migrationResult2 = await ConversationMigration.migrateV1toV2(conversationDir);
					const migrationResult3 = await ConversationMigration.migrateV2toV3(conversationDir);
					const migrationResult4 = await ConversationMigration.migrateV3toV4(conversationDir);
					return [migrationResult2, migrationResult3, migrationResult4];
				}
				case 2: {
					const migrationResult3 = await ConversationMigration.migrateV2toV3(conversationDir);
					const migrationResult4 = await ConversationMigration.migrateV3toV4(conversationDir);
					return [migrationResult3, migrationResult4];
				}
				case 3: {
					return [await ConversationMigration.migrateV3toV4(conversationDir)];
				}
				default:
					return [{
						success: true,
						version: {
							from: currentVersion,
							to: currentVersion,
						},
						changes: [],
						errors: [],
					}];
			}
		} catch (error) {
			return [{
				success: false,
				version: {
					from: 1,
					to: 1,
				},
				changes: [],
				errors: [{
					message: (error as Error).message,
					details: error,
				}],
			}];
		}
	}

	private static async migrateV1toV2(conversationDir: string): Promise<ConversationMigrationResult> {
		const result: ConversationMigrationResult = {
			success: true,
			version: {
				from: 1,
				to: 2,
			},
			changes: [],
			errors: [],
		};
		try {
			// Get current metadata
			const metadata = await ConversationMigration.readMetadata(join(conversationDir, 'metadata.json'));
			if (metadata.version === 2) {
				// Already at latest version
				result.version.from = 2;
				return result;
			}

			metadata.version = 2;

			// Save updated metadata
			await ConversationMigration.saveMetadata(join(conversationDir, 'metadata.json'), metadata);
			result.changes.push({
				type: 'metadata',
				path: 'metadata.json',
				details: 'Updated version',
			});

			return result;
		} catch (error) {
			result.success = false;
			result.errors.push({
				message: `Migration failed: ${(error as Error).message}`,
				details: error,
			});
			return result;
		}
	}

	private static async migrateV2toV3(conversationDir: string): Promise<ConversationMigrationResult> {
		const result: ConversationMigrationResult = {
			success: true,
			version: {
				from: 2,
				to: 3,
			},
			changes: [],
			errors: [],
		};

		try {
			// Get current metadata
			const metadata = await ConversationMigration.readMetadata(join(conversationDir, 'metadata.json'));
			if (metadata.version === 3) {
				// Already at latest version
				result.version.from = 3;
				return result;
			}

			// Create TokenUsagePersistence instance
			const tokenUsagePersistence = await new TokenUsagePersistence(conversationDir).init();

			// 1. Update token usage records
			const tokenUsageRecords = await tokenUsagePersistence.getUsage('conversation');
			for (const record of tokenUsageRecords) {
				// Skip if totalAllTokens already exists
				if (record.rawUsage.totalAllTokens !== undefined) continue;

				// Calculate totalAllTokens
				const totalAllTokens = (record.rawUsage.totalTokens ?? 0) +
					(record.rawUsage.cacheCreationInputTokens ?? 0) +
					(record.rawUsage.cacheReadInputTokens ?? 0) +
					(record.rawUsage.thoughtTokens ?? 0);

				// Update the record
				record.rawUsage.totalAllTokens = totalAllTokens;

				// Write back to file
				await tokenUsagePersistence.updateRecord(record);

				result.changes.push({
					type: 'token_usage',
					path: `tokenUsage/conversations.jsonl`,
					details: `Added totalAllTokens: ${totalAllTokens} for message ${record.messageId}`,
				});
			}

			// 2. Update conversation metadata
			const tokenAnalysis: TokenUsageAnalysis = await tokenUsagePersistence.analyzeUsage('conversation');
			if (!metadata.tokenUsageStats) {
				const defaultInteractionTokenUsage: TokenUsage = {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					thoughtTokens: 0,
					totalAllTokens: 0,
				};
				metadata.tokenUsageStats = {
					tokenUsageTurn: defaultInteractionTokenUsage,
					tokenUsageStatement: defaultInteractionTokenUsage,
					tokenUsageInteraction: defaultInteractionTokenUsage,
				};
			}
			metadata.tokenUsageStats.tokenUsageInteraction = {
				inputTokens: tokenAnalysis.totalUsage.input,
				outputTokens: tokenAnalysis.totalUsage.output,
				totalTokens: tokenAnalysis.totalUsage.total,
				cacheCreationInputTokens: tokenAnalysis.totalUsage.cacheCreationInput,
				cacheReadInputTokens: tokenAnalysis.totalUsage.cacheReadInput,
				thoughtTokens: tokenAnalysis.totalUsage.thoughtTokens,
				totalAllTokens: tokenAnalysis.totalUsage.totalAll,
			};
			metadata.version = 3;

			// Save updated metadata
			await ConversationMigration.saveMetadata(join(conversationDir, 'metadata.json'), metadata);
			result.changes.push({
				type: 'metadata',
				path: 'metadata.json',
				details: 'Updated tokenUsageInteraction and version',
			});

			return result;
		} catch (error) {
			result.success = false;
			result.errors.push({
				message: `Migration failed: ${(error as Error).message}`,
				details: error,
			});
			return result;
		}
	}

	private static async readMetadata(path: string): Promise<InteractionMetadata> {
		try {
			const content = await Deno.readTextFile(path);
			try {
				return JSON.parse(content);
			} catch (error) {
				throw new Error(`Invalid JSON in metadata file: ${(error as Error).message}`);
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				throw new Error('Legacy conversation: metadata.json not found');
			}
			throw error;
		}
	}

	private static async saveMetadata(path: string, metadata: InteractionMetadata): Promise<void> {
		await Deno.writeTextFile(path, JSON.stringify(metadata, null, 2));
	}

	private static async readConversationsJson(dataDir: string): Promise<InteractionMetadata[]> {
		const path = join(dataDir, 'conversations.json');
		try {
			const content = await Deno.readTextFile(path);
			return JSON.parse(content);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				return [];
			}
			throw error;
		}
	}

	private static async saveConversationsJson(dataDir: string, conversations: InteractionMetadata[]): Promise<void> {
		const path = join(dataDir, 'interactions.json');
		await Deno.writeTextFile(path, JSON.stringify(conversations, null, 2));
	}

	private static async migrateV3toV4(conversationDir: string): Promise<ConversationMigrationResult> {
		const result: ConversationMigrationResult = {
			success: true,
			version: {
				from: 3,
				to: 4,
			},
			changes: [],
			errors: [],
		};

		try {
			// Get current metadata
			const metadata = await ConversationMigration.readMetadata(join(conversationDir, 'metadata.json'));
			if (metadata.version === 4) {
				// Already at latest version
				result.version.from = 4;
				return result;
			}

			// This migration is handled by the new collaboration system
			// The actual migration from conversations to collaborations happens
			// in migrateConversationsToCollaborations function
			metadata.version = 4;

			// Save updated metadata
			await ConversationMigration.saveMetadata(join(conversationDir, 'metadata.json'), metadata);
			result.changes.push({
				type: 'metadata',
				path: 'metadata.json',
				details: 'Updated version to 4 for collaboration format',
			});

			return result;
		} catch (error) {
			result.success = false;
			result.errors.push({
				message: `Migration failed: ${(error as Error).message}`,
				details: error,
			});
			return result;
		}
	}
}

/**
 * Migrate conversations to collaborations structure
 * This function handles the major structural change from conversations to collaborations
 */
export async function migrateConversationsToCollaborations(projectId: ProjectId): Promise<void> {
	const projectAdminDataDir = await getProjectAdminDataDir(projectId);
	if (!projectAdminDataDir) {
		throw new Error(`Failed to get project admin data directory for ${projectId}`);
	}

	const conversationsDir = join(projectAdminDataDir, 'conversations');
	const collaborationsDir = join(projectAdminDataDir, 'collaborations');
	const cleanupDir = join(projectAdminDataDir, 'cleanup');
	const conversationsJsonPath = join(projectAdminDataDir, 'conversations.json');
	const collaborationsJsonPath = join(projectAdminDataDir, 'collaborations.json');

	// Check if migration is needed
	if (await exists(collaborationsJsonPath) && await exists(collaborationsDir)) {
		// Already migrated
		return;
	}

	if (!await exists(conversationsDir)) {
		// No conversations to migrate
		return;
	}

	logger.info(`Starting migration from conversations to collaborations for project ${projectId}`);

	try {
		// Ensure cleanup directory exists
		await ensureDir(cleanupDir);
		await ensureDir(collaborationsDir);

		// Read existing conversations.json if it exists
		let conversations: InteractionMetadata[] = [];
		if (await exists(conversationsJsonPath)) {
			const content = await Deno.readTextFile(conversationsJsonPath);
			const data = JSON.parse(content);
			if (Array.isArray(data)) {
				conversations = data;
			} else if (data.version && Array.isArray(data.interactions || data.conversations)) {
				conversations = data.interactions || data.conversations;
			}
		}

		// Create collaborations from conversations
		const collaborations: CollaborationMetadata[] = [];
		const processedDirs = new Set<string>();

		// Process each conversation directory
		for await (const entry of Deno.readDir(conversationsDir)) {
			if (!entry.isDirectory) continue;

			const conversationId = entry.name;
			const conversationPath = join(conversationsDir, conversationId);
			processedDirs.add(conversationId);

			// Check if directory is empty or only has empty resource_revisions
			const isEmpty = await isEmptyConversationDir(conversationPath);
			if (isEmpty) {
				// Move empty directory to cleanup
				const cleanupPath = join(cleanupDir, `empty_conversation_${conversationId}`);
				await Deno.rename(conversationPath, cleanupPath);
				logger.info(`Moved empty conversation directory ${conversationId} to cleanup`);
				continue;
			}

			// Find corresponding metadata
			const conversationMetadata = conversations.find((c) => c.id === conversationId);
			if (!conversationMetadata) {
				logger.warn(`No metadata found for conversation ${conversationId}, skipping`);
				continue;
			}

			// Create collaboration using existing conversation ID
			const collaborationId = conversationId;
			const collaborationDir = join(collaborationsDir, collaborationId);
			const interactionsDir = join(collaborationDir, 'interactions');

			// Create collaboration directory structure
			await ensureDir(collaborationDir);
			await ensureDir(interactionsDir);

			// Move conversation data to interaction within collaboration
			const interactionDir = join(interactionsDir, conversationId);
			await Deno.rename(conversationPath, interactionDir);

			// Create collaboration metadata
			const collaborationMetadata: CollaborationMetadata = {
				id: collaborationId,
				version: 4,
				title: conversationMetadata.title || 'untitled',
				type: 'project',
				collaborationParams: conversationMetadata.collaborationParams || {
					rolesModelConfig: {
						orchestrator: null,
						agent: null,
						chat: null,
					},
				},
				createdAt: conversationMetadata.createdAt,
				updatedAt: conversationMetadata.updatedAt,
				projectId: projectId,
				totalInteractions: 1,
				tokenUsageStats: conversationMetadata.tokenUsageStats,
				lastInteractionId: conversationId,
				lastInteractionMetadata: {
					id: conversationId,
					llmProviderName: conversationMetadata.llmProviderName,
					model: conversationMetadata.model,
					interactionStats: conversationMetadata.interactionStats,
					tokenUsageStats: conversationMetadata.tokenUsageStats,
					createdAt: conversationMetadata.createdAt,
					updatedAt: conversationMetadata.updatedAt,
				},
				interactionIds: [conversationId],
			};

			// Save collaboration metadata
			const collaborationMetadataPath = join(collaborationDir, 'metadata.json');
			await Deno.writeTextFile(collaborationMetadataPath, JSON.stringify(collaborationMetadata, null, 2));

			collaborations.push(collaborationMetadata);
			logger.info(`Migrated conversation ${conversationId} to collaboration`);
		}

		// Create collaborations.json
		const collaborationsData: CollaborationsFileV4 = {
			version: '4.0',
			collaborations: collaborations,
		};
		await Deno.writeTextFile(collaborationsJsonPath, JSON.stringify(collaborationsData, null, 2));

		// Move original conversations directory to cleanup
		if (await exists(conversationsDir)) {
			const backupConversationsPath = join(cleanupDir, 'conversations_backup');
			await Deno.rename(conversationsDir, backupConversationsPath);
			logger.info(`Moved original conversations directory to cleanup`);
		}

		// Move original conversations.json to cleanup
		if (await exists(conversationsJsonPath)) {
			const backupConversationsJsonPath = join(cleanupDir, 'conversations_backup.json');
			await Deno.rename(conversationsJsonPath, backupConversationsJsonPath);
			logger.info(`Moved original conversations.json to cleanup`);
		}

		logger.info(
			`Successfully migrated ${collaborations.length} conversations to collaborations for project ${projectId}`,
		);
	} catch (error) {
		logger.error(
			`Failed to migrate conversations to collaborations for project ${projectId}: ${(error as Error).message}`,
		);
		throw error;
	}
}

/**
 * Check if a conversation directory is empty or only contains empty resource_revisions
 */
async function isEmptyConversationDir(conversationPath: string): Promise<boolean> {
	try {
		const entries = [];
		for await (const entry of Deno.readDir(conversationPath)) {
			entries.push(entry);
		}

		if (entries.length === 0) {
			return true;
		}

		// Check if only resource_revisions directory exists and is empty
		if (entries.length === 1 && entries[0].name === 'resource_revisions' && entries[0].isDirectory) {
			const resourceRevisionsPath = join(conversationPath, 'resource_revisions');
			const revisionEntries = [];
			for await (const entry of Deno.readDir(resourceRevisionsPath)) {
				revisionEntries.push(entry);
			}
			return revisionEntries.length === 0;
		}

		return false;
	} catch (error) {
		// If we can't read the directory, assume it's not empty
		return false;
	}
}
