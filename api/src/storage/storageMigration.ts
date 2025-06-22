import { join } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { logger } from 'shared/logger.ts';
import { getProjectRegistry } from 'shared/projectRegistry.ts';
import { getProjectAdminDataDir } from 'shared/projectPath.ts';
import { TokenUsagePersistence } from './tokenUsagePersistence.ts';
import { generateResourceRevisionKey, generateResourceUriKey } from 'shared/dataSource.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import type { ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import type {
	CollaborationMetadata,
	InteractionMetadata,
	ProjectId,
	TokenUsage,
	TokenUsageAnalysis,
} from 'shared/types.ts';
//import type { CollaborationParams } from 'shared/types/collaboration.ts';
import type { ResourceMetadata, ResourceRevisionMetadata } from 'shared/types/dataSourceResource.ts';
import ProjectPersistence from 'api/storage/projectPersistence.ts';

/**
 * Current unified storage version
 * This version covers all storage-related data files (projects, collaborations, interactions, resources)
 * The config system maintains its own separate versioning (currently v2)
 */
export const CURRENT_STORAGE_VERSION = 4;

/**
 * Versioned format for conversations.json file (legacy v1)
 */
export interface ConversationsFileV1 {
	version: string;
	conversations: InteractionMetadata[];
}

/**
 * Versioned format for interactions.json file (v4)
 */
export interface InteractionsFileV4 {
	version: string;
	interactions: InteractionMetadata[];
}

/**
 * Versioned format for collaborations.json file (v4)
 */
export interface CollaborationsFileV4 {
	version: string;
	collaborations: CollaborationMetadata[];
}

/**
 * Interface for tracking project migration state
 */
export interface ProjectMigrationState {
	version: number; // Current storage version
	lastMigrated: string; // ISO timestamp
	migratedCount: number; // Number of entities migrated
}

/**
 * Interface for migration result tracking
 */
export interface MigrationResult {
	total: number;
	migrated: number;
	skipped: number;
	failed: number;
	results: Array<{
		entityId: string;
		result: EntityMigrationResult;
	}>;
}

/**
 * Interface for individual entity migration results
 */
export interface EntityMigrationResult {
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

/**
 * Interface for tracking resource revisions during migration
 */
interface ResourceRevisionInfo {
	uri: string;
	latestRevision: string;
	revisions: string[];
	metadata: ResourceRevisionMetadata;
}

/**
 * Storage Migration Manager
 * Handles all storage-related migrations across the entire persistence stack
 */
export class StorageMigration {
	/**
	 * Main entry point for storage migration - called once at API startup
	 * Migrates all projects found in the registry to the current storage version
	 */
	static async migrateAllProjectsAtStartup(): Promise<void> {
		logger.info('StorageMigration: Starting global storage migration check at API startup');

		try {
			const registry = await getProjectRegistry();
			const projects = await registry.listProjects();

			logger.info(`StorageMigration: Found ${projects.length} projects to check for migration`);

			for (const project of projects) {
				try {
					await StorageMigration.migrateProjectStorage(project.projectId);
				} catch (error) {
					logger.error(
						`StorageMigration: Failed to migrate project ${project.projectId}: ${errorMessage(error)}`,
					);
					// Continue with other projects rather than failing the entire startup
				}
			}

			logger.info('StorageMigration: Completed global storage migration check');
		} catch (error) {
			logger.error(`StorageMigration: Failed to run global storage migration: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to run global storage migration: ${errorMessage(error)}`,
				{} as ProjectHandlingErrorOptions,
			);
		}
	}

	/**
	 * Migrates storage for a specific project
	 * Designed to support both startup migration and future per-project import feature
	 */
	static async migrateProjectStorage(projectId: ProjectId): Promise<void> {
		logger.info(`StorageMigration: Checking storage migration for project ${projectId}`);

		try {
			const projectAdminDataDir = await getProjectAdminDataDir(projectId);
			if (!projectAdminDataDir) {
				throw new Error(`Failed to get project admin data directory for ${projectId}`);
			}

			const migrationStateFile = join(projectAdminDataDir, '.storage-migration-state');

			// Check if migration is needed
			if (await exists(migrationStateFile)) {
				try {
					const stateContent = await Deno.readTextFile(migrationStateFile);
					const state = JSON.parse(stateContent) as ProjectMigrationState;

					if (state.version === CURRENT_STORAGE_VERSION) {
						logger.debug(
							`StorageMigration: Project ${projectId} already at storage version ${state.version}, skipping`,
						);
						return;
					}

					logger.info(
						`StorageMigration: Project ${projectId} at version ${state.version}, migrating to ${CURRENT_STORAGE_VERSION}`,
					);
				} catch (error) {
					logger.warn(
						`StorageMigration: Error reading migration state for project ${projectId}, proceeding with migration: ${
							errorMessage(error)
						}`,
					);
				}
			}

			// Migrate individual interactions through version progression
			await StorageMigration.migrateProjectInteractions(projectId, projectAdminDataDir);

			// Migrate conversations to collaborations structure (v3 to v4)
			await StorageMigration.migrateConversationsToCollaborations(projectId);

			// Create/update migration state file
			const migrationState: ProjectMigrationState = {
				version: CURRENT_STORAGE_VERSION,
				lastMigrated: new Date().toISOString(),
				migratedCount: 0, // TODO: track actual migration count
			};

			await ensureDir(projectAdminDataDir);
			await Deno.writeTextFile(migrationStateFile, JSON.stringify(migrationState, null, 2));

			logger.info(
				`StorageMigration: Successfully migrated project ${projectId} to storage version ${CURRENT_STORAGE_VERSION}`,
			);
		} catch (error) {
			logger.error(`StorageMigration: Failed to migrate project ${projectId}: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to migrate project storage: ${errorMessage(error)}`,
				{
					projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
	}

	/**
	 * Migrates all interactions within a project through the version progression
	 * Previously named migrateProject in conversationMigration.ts
	 */
	static async migrateProjectInteractions(projectId: ProjectId, dataDir: string): Promise<MigrationResult> {
		const result: MigrationResult = {
			total: 0,
			migrated: 0,
			skipped: 0,
			failed: 0,
			results: [],
		};

		try {
			// Check both old conversations directory and new collaborations directory
			const conversationsDir = join(dataDir, 'conversations');
			const collaborationsDir = join(dataDir, 'collaborations');

			// Handle legacy conversations directory
			if (await exists(conversationsDir)) {
				const conversations = await StorageMigration.readConversationsJson(dataDir);
				result.total += conversations.length;

				for (const conversation of conversations) {
					const conversationDir = join(conversationsDir, conversation.id);
					await StorageMigration.processEntityMigration(projectId, conversationDir, conversation.id, result);
				}
			}

			// Handle new collaborations directory structure
			if (await exists(collaborationsDir)) {
				for await (const collaborationEntry of Deno.readDir(collaborationsDir)) {
					if (!collaborationEntry.isDirectory) continue;

					const interactionsDir = join(collaborationsDir, collaborationEntry.name, 'interactions');
					if (await exists(interactionsDir)) {
						for await (const interactionEntry of Deno.readDir(interactionsDir)) {
							if (!interactionEntry.isDirectory) continue;

							const interactionDir = join(interactionsDir, interactionEntry.name);
							await StorageMigration.processEntityMigration(
								projectId,
								interactionDir,
								interactionEntry.name,
								result,
							);
						}
					}
				}
			}

			return result;
		} catch (error) {
			logger.error(`StorageMigration: Failed to migrate project interactions: ${errorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * Process migration for a single entity (conversation/interaction)
	 */
	private static async processEntityMigration(
		projectId: ProjectId,
		entityDir: string,
		entityId: string,
		result: MigrationResult,
	): Promise<void> {
		try {
			const migrationResults = await StorageMigration.migrateInteractionThroughVersions(projectId, entityDir);
			for (const migrationResult of migrationResults) {
				result.results.push({
					entityId,
					result: migrationResult,
				});

				if (migrationResult.success) {
					if (migrationResult.version.from === migrationResult.version.to) {
						result.skipped++;
					} else {
						result.migrated++;
					}
				} else if (migrationResult.errors[0]?.message.startsWith('Legacy entity:')) {
					result.skipped++;
					logger.info(`StorageMigration: Skipping legacy entity ${entityId}`);
				} else {
					result.failed++;
					logger.error(
						`StorageMigration: Failed to migrate entity ${entityId}: ${migrationResult.errors[0]?.message}`,
						{ error: migrationResult.errors[0]?.details },
					);
				}
			}
		} catch (error) {
			result.failed++;
			logger.error(`StorageMigration: Failed to migrate entity ${entityId}: ${errorMessage(error)}`, { error });
		}
	}

	/**
	 * Migrates a single interaction through all necessary version upgrades
	 * Previously named migrateConversation in conversationMigration.ts
	 */
	static async migrateInteractionThroughVersions(
		projectId: ProjectId,
		interactionDir: string,
	): Promise<Array<EntityMigrationResult>> {
		try {
			// Get current metadata to check version
			const metadata = await StorageMigration.readMetadata(join(interactionDir, 'metadata.json'));
			const currentVersion = metadata.version || 1;

			// Apply incremental migrations based on current version
			switch (currentVersion) {
				case 1: {
					const migrationResult2 = await StorageMigration.migrateV1toV2(projectId, interactionDir);
					const migrationResult3 = await StorageMigration.migrateV2toV3(projectId, interactionDir);
					const migrationResult4 = await StorageMigration.migrateV3toV4(projectId, interactionDir);
					return [migrationResult2, migrationResult3, migrationResult4];
				}
				case 2: {
					const migrationResult3 = await StorageMigration.migrateV2toV3(projectId, interactionDir);
					const migrationResult4 = await StorageMigration.migrateV3toV4(projectId, interactionDir);
					return [migrationResult3, migrationResult4];
				}
				case 3: {
					return [await StorageMigration.migrateV3toV4(projectId, interactionDir)];
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
					message: errorMessage(error),
					details: error,
				}],
			}];
		}
	}

	/**
	 * Migrate from version 1 to version 2
	 */
	private static async migrateV1toV2(_projectId: ProjectId, interactionDir: string): Promise<EntityMigrationResult> {
		const result: EntityMigrationResult = {
			success: true,
			version: {
				from: 1,
				to: 2,
			},
			changes: [],
			errors: [],
		};

		try {
			const metadata = await StorageMigration.readMetadata(join(interactionDir, 'metadata.json'));
			if (metadata?.version && metadata.version >= 2) {
				result.version.from = metadata.version;
				return result;
			}

			metadata.version = 2;
			await StorageMigration.saveMetadata(join(interactionDir, 'metadata.json'), metadata);
			result.changes.push({
				type: 'metadata',
				path: 'metadata.json',
				details: 'Updated version to 2',
			});

			return result;
		} catch (error) {
			result.success = false;
			result.errors.push({
				message: `Migration failed: ${errorMessage(error)}`,
				details: error,
			});
			return result;
		}
	}

	/**
	 * Migrate from version 2 to version 3
	 * Includes token usage migration from conversationMigration.utils.ts
	 */
	private static async migrateV2toV3(projectId: ProjectId, interactionDir: string): Promise<EntityMigrationResult> {
		const result: EntityMigrationResult = {
			success: true,
			version: {
				from: 2,
				to: 3,
			},
			changes: [],
			errors: [],
		};

		try {
			const metadata = await StorageMigration.readMetadata(join(interactionDir, 'metadata.json'));
			if (metadata?.version && metadata.version >= 3) {
				result.version.from = metadata.version;
				return result;
			}

			// Create TokenUsagePersistence instance
			const tokenUsagePersistence = await new TokenUsagePersistence(interactionDir).init();

			// Update token usage records
			const tokenUsageRecords = await tokenUsagePersistence.getUsage('conversation');
			for (const record of tokenUsageRecords) {
				// Skip if totalAllTokens already exists
				if (record.rawUsage.totalAllTokens !== undefined) continue;

				// update savings fields
				if ((record as any).cacheImpact.savings !== undefined) {
					record.cacheImpact.savingsTotal = (record as any).cacheImpact.savings;
					record.cacheImpact.savingsPercentage =
						(record.cacheImpact.savingsTotal / record.cacheImpact.potentialCost) * 100;
					delete (record as any).cacheImpact.savings;
				}

				// Calculate totalAllTokens
				const totalAllTokens = (record.rawUsage.totalTokens ?? 0) +
					(record.rawUsage.cacheCreationInputTokens ?? 0) +
					(record.rawUsage.cacheReadInputTokens ?? 0) +
					(record.rawUsage.thoughtTokens ?? 0);

				// Update the record
				record.rawUsage.totalAllTokens = totalAllTokens;
				await tokenUsagePersistence.updateRecord(record);

				result.changes.push({
					type: 'token_usage',
					path: `tokenUsage/conversations.jsonl`,
					details: `Added totalAllTokens: ${totalAllTokens} for message ${record.messageId}`,
				});
			}

			// Update interaction metadata with token analysis
			const tokenAnalysis: TokenUsageAnalysis = await tokenUsagePersistence.analyzeUsage('conversation');
			if (!(metadata as any).tokenUsageStats) {
				const defaultInteractionTokenUsage: TokenUsage = {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					thoughtTokens: 0,
					totalAllTokens: 0,
				};
				(metadata as any).tokenUsageStats = {
					tokenUsageTurn: defaultInteractionTokenUsage,
					tokenUsageStatement: defaultInteractionTokenUsage,
					tokenUsageInteraction: defaultInteractionTokenUsage,
				};
			}
			(metadata as any).tokenUsageStats.tokenUsageInteraction = {
				inputTokens: tokenAnalysis.totalUsage.input,
				outputTokens: tokenAnalysis.totalUsage.output,
				totalTokens: tokenAnalysis.totalUsage.total,
				cacheCreationInputTokens: tokenAnalysis.totalUsage.cacheCreationInput,
				cacheReadInputTokens: tokenAnalysis.totalUsage.cacheReadInput,
				thoughtTokens: tokenAnalysis.totalUsage.thoughtTokens,
				totalAllTokens: tokenAnalysis.totalUsage.totalAll,
			};
			metadata.version = 3;

			await StorageMigration.saveMetadata(join(interactionDir, 'metadata.json'), metadata);
			result.changes.push({
				type: 'metadata',
				path: 'metadata.json',
				details: 'Updated tokenUsageInteraction and version to 3',
			});

			try {
				StorageMigration.migrateConversationsFileIfNeeded(projectId);
			} catch (migrationError) {
				logger.warn(
					`StorageMigration: Error during conversations file migration for project ${projectId}: ${
						errorMessage(migrationError)
					}`,
				);
				// Continue with other migrations even if conversations file migration fails
			}

			// Create ProjectPersistence instance for resource migration
			const projectPersistence = new ProjectPersistence(projectId);
			await projectPersistence.init();

			// Migrate conversation resources to new format
			try {
				await StorageMigration.migrateConversationResources(projectId, projectPersistence);
				logger.info(`StorageMigration: Successfully migrated conversation resources for project ${projectId}`);
			} catch (migrationError) {
				logger.warn(
					`StorageMigration: Error during resource migration for project ${projectId}: ${
						errorMessage(migrationError)
					}`,
				);
				// Continue with other migrations even if resource migration fails
			}

			return result;
		} catch (error) {
			result.success = false;
			result.errors.push({
				message: `Migration failed: ${errorMessage(error)}`,
				details: error,
			});
			return result;
		}
	}

	/**
	 * Migrate from version 3 to version 4
	 */
	private static async migrateV3toV4(_projectId: ProjectId, interactionDir: string): Promise<EntityMigrationResult> {
		const result: EntityMigrationResult = {
			success: true,
			version: {
				from: 3,
				to: 4,
			},
			changes: [],
			errors: [],
		};

		try {
			const metadata = await StorageMigration.readMetadata(join(interactionDir, 'metadata.json'));
			if (metadata?.version && metadata.version >= 4) {
				result.version.from = metadata.version;
				return result;
			}

			// Update metadata version
			metadata.version = 4;

			if ((metadata as any).conversationStats) {
				metadata.interactionStats = {
					...(metadata as any).conversationStats,
					interactionTurnCount: (metadata as any).conversationStats.conversationTurnCount,
				};
				if ((metadata as any).interactionStats) delete (metadata as any).interactionStats.conversationTurnCount;
				delete (metadata as any).conversationStats;
			} else {
				metadata.interactionStats = {
					statementTurnCount: 0,
					interactionTurnCount: 0,
					statementCount: 0,
				};
				// logger.warn(`StorageMigration: Missing conversationStats in metadata for interaction ${metadata.id} - skipping values`);
				result.changes.push({
					type: 'metadata',
					path: 'metadata.json',
					details:
						`Missing conversationStats in metadata for interaction ${metadata.id} - setting values to 0`,
				});
			}
			const emptyTokenUsage = {
				totalTokens: 0,
				inputTokens: 0,
				outputTokens: 0,
				cacheCreationInputTokens: undefined,
				cacheReadInputTokens: undefined,
				thoughtTokens: undefined,
				totalAllTokens: undefined,
			};

			if ((metadata as any).tokenUsageConversation && !(metadata as any).tokenUsageStats) {
				metadata.tokenUsageStatsForInteraction = {
					tokenUsageInteraction: { ...emptyTokenUsage, ...(metadata as any).tokenUsageConversation },
					tokenUsageStatement: {
						...emptyTokenUsage,
						...(metadata as any).tokenUsageStatement,
					},
					tokenUsageTurn: { ...emptyTokenUsage, ...(metadata as any).tokenUsageTurn },
				};
				//metadata.tokenUsageStatsForInteraction.tokenUsageInteraction = { ...(metadata as any).tokenUsageConversation };
				if ((metadata as any).tokenUsageInteraction?.tokenUsageConversation) {
					delete (metadata as any).tokenUsageInteraction.tokenUsageConversation;
				}
				if ((metadata as any).tokenUsageStatsForInteraction) {
					delete (metadata as any).tokenUsageStatsForInteraction.tokenUsageConversation;
				}
				delete (metadata as any).tokenUsageConversation;
				delete (metadata as any).tokenUsageStatement;
				delete (metadata as any).tokenUsageTurn;
			}

			if ((metadata as any).tokenUsageStats?.tokenUsageConversation) {
				metadata.tokenUsageStatsForInteraction = {
					...(metadata.tokenUsageStatsForInteraction || {}),
					...((metadata as any).tokenUsageStats || {}),
					tokenUsageInteraction: {
						...emptyTokenUsage,
						...(metadata as any).tokenUsageStats.tokenUsageConversation,
					},
				};
				if ((metadata as any).tokenUsageInteraction?.tokenUsageConversation) {
					delete (metadata as any).tokenUsageInteraction.tokenUsageConversation;
				}
				if ((metadata as any).tokenUsageStatsForInteraction) {
					delete (metadata as any).tokenUsageStatsForInteraction.tokenUsageConversation;
				}
				if ((metadata as any).tokenUsageStats) delete (metadata as any).tokenUsageStats.tokenUsageConversation;
				delete (metadata as any).tokenUsageStats;
			} else if (!metadata.tokenUsageStatsForInteraction) {
				metadata.tokenUsageStatsForInteraction = {
					tokenUsageInteraction: emptyTokenUsage,
					tokenUsageStatement: emptyTokenUsage,
					tokenUsageTurn: emptyTokenUsage,
				};
				// logger.warn(`StorageMigration: Missing tokenUsageStats.tokenUsageConversation in metadata for interaction ${metadata.id} - skipping values`);
				result.changes.push({
					type: 'metadata',
					path: 'metadata.json',
					details:
						`Missing tokenUsageStats.tokenUsageConversation in metadata for interaction ${metadata.id} - setting values to 0`,
				});
			}

			if ((metadata as any).conversationMetrics) {
				metadata.interactionMetrics = {
					...(metadata as any).conversationMetrics,
					interactionTurnCount: (metadata as any).conversationMetrics?.conversationTurnCount || 0, // rename to interactionTurnCount
				};
				if ((metadata as any).interactionMetrics) {
					delete (metadata as any).interactionMetrics.conversationTurnCount;
				}
				if ((metadata as any).conversationMetrics) {
					delete (metadata as any).conversationMetrics.conversationTurnCount;
				}
				delete (metadata as any).conversationMetrics;
			} else {
				metadata.interactionMetrics = {
					statementTurnCount: 0,
					interactionTurnCount: 0,
					statementCount: 0,
					objectives: {
						statement: [],
						timestamp: '',
					},
					resources: {
						accessed: new Set(),
						modified: new Set(),
						active: new Set(),
					},
					toolUsage: {
						toolStats: new Map(),
					},
				};
				// logger.warn(`StorageMigration: Missing conversationStats in metadata for interaction ${metadata.id} - skipping values`);
				result.changes.push({
					type: 'metadata',
					path: 'metadata.json',
					details:
						`Missing conversationMetrics in metadata for interaction ${metadata.id} - setting values to 0`,
				});
			}

			await StorageMigration.saveMetadata(join(interactionDir, 'metadata.json'), metadata);
			result.changes.push({
				type: 'metadata',
				path: 'metadata.json',
				details: 'Updated version to 4 for collaboration format',
			});

			return result;
		} catch (error) {
			result.success = false;
			result.errors.push({
				message: `Migration failed: ${errorMessage(error)}`,
				details: error,
			});
			return result;
		}
	}

	/**
	 * Migrates conversations file structure to new format if needed
	 * Consolidates logic from conversationMigration.utils.ts
	 */
	static async migrateConversationsFileIfNeeded(projectId: ProjectId): Promise<void> {
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);
		const conversationsFilePath = join(projectAdminDataDir, 'conversations.json');

		// If the file doesn't exist, create it with the new format
		if (!await exists(conversationsFilePath)) {
			logger.info(`StorageMigration: Creating new conversations.json file for project ${projectId}`);
			await ensureDir(projectAdminDataDir);
			const newData: ConversationsFileV1 = {
				version: '1.0',
				conversations: [],
			};
			await Deno.writeTextFile(conversationsFilePath, JSON.stringify(newData, null, 2));
			return;
		}

		// Read the existing file
		const content = await Deno.readTextFile(conversationsFilePath);
		const data = JSON.parse(content);

		// If already in new format, we're done
		if (data.version && data.conversations) {
			logger.debug(`StorageMigration: Conversations file already in versioned format for project ${projectId}`);
			return;
		}

		// Check if it's an array (v0 format)
		if (Array.isArray(data)) {
			logger.info(`StorageMigration: Migrating conversations.json to versioned format for project ${projectId}`);

			// Create new format with the existing array as the conversations property
			const migratedData: ConversationsFileV1 = {
				version: '1.0',
				conversations: data,
			};

			// Write the migrated data back
			await Deno.writeTextFile(conversationsFilePath, JSON.stringify(migratedData, null, 2));
			logger.info(`StorageMigration: Successfully migrated conversations.json for project ${projectId}`);
		} else {
			// Unknown format, create new one
			logger.warn(`StorageMigration: Unknown format for conversations.json in project ${projectId}, resetting`);
			const migratedData: ConversationsFileV1 = {
				version: '1.0',
				conversations: [],
			};
			await Deno.writeTextFile(conversationsFilePath, JSON.stringify(migratedData, null, 2));
		}
	}

	/**
	 * Migrates conversation resource revisions to use the new URI and key format
	 * Consolidates logic from conversationMigration.utils.ts
	 */
	static async migrateConversationResources(
		projectId: ProjectId,
		projectPersistence: ProjectPersistence,
	): Promise<void> {
		try {
			const projectAdminDataDir = await getProjectAdminDataDir(projectId);
			const interactionsDir = join(projectAdminDataDir, 'conversations');
			const migrationStateFile = join(projectAdminDataDir, '.resources-migrated');

			// Check if migration state file exists
			if (await exists(migrationStateFile)) {
				try {
					const stateContent = await Deno.readTextFile(migrationStateFile);
					const state = JSON.parse(stateContent) as { version: string };

					// If already at current version, skip migration
					if (state.version === '2.0') {
						logger.debug(
							`StorageMigration: Resources already migrated to version ${state.version} for project ${projectId}, skipping`,
						);
						return;
					}
				} catch (error) {
					logger.warn(
						`StorageMigration: Error reading resource migration state file, proceeding with migration: ${
							errorMessage(error)
						}`,
					);
				}
			}

			// Ensure the directory exists
			if (!await exists(interactionsDir)) {
				logger.info(`StorageMigration: No interactions directory found for project ${projectId}`);
				// Create migration state file even if no interactions exist
				const migrationState = { version: '2.0', lastMigrated: new Date().toISOString(), migratedCount: 0 };
				await Deno.writeTextFile(migrationStateFile, JSON.stringify(migrationState, null, 2));
				return;
			}

			// Track the latest revision of each resource across all interactions
			const resourceMap = new Map<string, ResourceRevisionInfo>();
			let migratedCount = 0;

			// Process each interaction directory
			for await (const entry of Deno.readDir(interactionsDir)) {
				if (!entry.isDirectory) continue;

				const interactionId = entry.name;
				const newMetadataPath = join(interactionsDir, interactionId, 'resources_metadata.json');
				const oldMetadataPath = join(interactionsDir, interactionId, 'files_metadata.json');
				const newResourceRevisionsDir = join(interactionsDir, interactionId, 'resource_revisions');
				const oldFileRevisionsDir = join(interactionsDir, interactionId, 'file_revisions');

				// If resources_metadata.json exists, assume migration is already complete
				if (await exists(newMetadataPath)) {
					logger.debug(
						`StorageMigration: ${interactionId} already has resources_metadata.json, skipping migration`,
					);
					migratedCount++;
					continue;
				}

				// If files_metadata.json doesn't exist, nothing to migrate
				if (!await exists(oldMetadataPath)) {
					logger.debug(
						`StorageMigration: No files_metadata.json found for interaction ${interactionId}, nothing to migrate`,
					);
					continue;
				}

				// Create the new resource_revisions directory
				await ensureDir(newResourceRevisionsDir);

				try {
					// Read the old resources metadata
					const metadataContent = await Deno.readTextFile(oldMetadataPath);
					const oldMetadata = JSON.parse(metadataContent);
					const updatedMetadata: Record<string, ResourceRevisionMetadata> = {};

					logger.info(
						`StorageMigration: Migrating ${
							Object.keys(oldMetadata).length
						} resources for interaction ${interactionId}`,
					);

					// Process each resource entry from files_metadata.json
					for (const [oldKey, metadata] of Object.entries(oldMetadata)) {
						// Split the key on _rev_
						const parts = oldKey.split('_rev_');
						if (parts.length !== 2) {
							logger.warn(`StorageMigration: Invalid key format ${oldKey}, skipping`);
							continue;
						}

						const filePath = parts[0];
						const revisionId = parts[1];

						// Create new URI format
						const primaryDsConnection = projectPersistence.getPrimaryDsConnection();
						const resourceUri = primaryDsConnection!.getUriForResource(`file:./${filePath}`);
						const newKey = generateResourceRevisionKey(resourceUri, revisionId);

						// Update metadata with the URI
						const updatedResourceMetadata: ResourceRevisionMetadata = {
							...(metadata as ResourceRevisionMetadata),
							uri: resourceUri,
							type: 'file',
							contentType: (metadata as ResourceRevisionMetadata).contentType || 'text',
							messageId: revisionId,
						};

						// Store with new key
						updatedMetadata[newKey] = updatedResourceMetadata;

						// Track this resource for project-level storage
						const resourceKey = generateResourceUriKey(resourceUri);
						const existingInfo = resourceMap.get(resourceKey);

						if (!existingInfo) {
							// First time seeing this resource
							resourceMap.set(resourceKey, {
								uri: resourceUri,
								latestRevision: revisionId,
								revisions: [revisionId],
								metadata: updatedResourceMetadata,
							});
						} else {
							// Add this revision
							existingInfo.revisions.push(revisionId);

							const updatedLastModified = updatedResourceMetadata.lastModified instanceof Date
								? updatedResourceMetadata.lastModified
								: new Date(updatedResourceMetadata.lastModified);
							const existingLastModified = existingInfo.metadata.lastModified instanceof Date
								? existingInfo.metadata.lastModified
								: new Date(existingInfo.metadata.lastModified);
							// Update latest if this is newer
							if (updatedLastModified > existingLastModified) {
								existingInfo.latestRevision = revisionId;
								existingInfo.metadata = updatedResourceMetadata;
							}
						}

						// Move file from old location to new location
						const oldPath = join(oldFileRevisionsDir, oldKey);
						const newPath = join(newResourceRevisionsDir, newKey);

						if (await exists(oldPath)) {
							try {
								await Deno.rename(oldPath, newPath);
								logger.debug(`StorageMigration: Moved resource from ${oldPath} to ${newPath}`);
							} catch (moveError) {
								// If move fails, fall back to copy+delete
								logger.warn(
									`StorageMigration: Could not move file directly, falling back to copy+delete: ${
										errorMessage(moveError)
									}`,
								);
								await Deno.copyFile(oldPath, newPath);
								try {
									await Deno.remove(oldPath);
								} catch (deleteError) {
									logger.warn(
										`StorageMigration: Copied file but failed to delete original: ${
											errorMessage(deleteError)
										}`,
									);
								}
							}
						} else {
							logger.warn(`StorageMigration: Could not find original file at ${oldPath}`);
						}
					}

					// Write to the new metadata file
					await Deno.writeTextFile(newMetadataPath, JSON.stringify(updatedMetadata, null, 2));
					logger.info(
						`StorageMigration: Created resources_metadata.json with ${
							Object.keys(updatedMetadata).length
						} entries for interaction ${interactionId}`,
					);
					migratedCount++;
				} catch (error) {
					logger.error(
						`StorageMigration: Error processing interaction ${interactionId}: ${errorMessage(error)}`,
					);
					// Continue with other interactions
				}
			}

			// Store latest version of each resource at the project level
			await StorageMigration.migrateProjectResources(projectId, resourceMap, projectPersistence);

			// After migration is complete, update the migration state file
			const migrationState = {
				version: '2.0',
				lastMigrated: new Date().toISOString(),
				migratedCount: migratedCount,
			};
			await Deno.writeTextFile(migrationStateFile, JSON.stringify(migrationState, null, 2));
			logger.info(`StorageMigration: Updated resource migration state for project ${projectId}`);
		} catch (error) {
			logger.error(
				`StorageMigration: Error migrating resources for project ${projectId}: ${errorMessage(error)}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to migrate conversation resources: ${errorMessage(error)}`,
				{
					projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
	}

	/**
	 * Migrate conversations to collaborations structure
	 * Enhanced version of the function from conversationMigration.ts
	 * Handles conversation.log and conversation.jsonl file moves and renames
	 */
	static async migrateConversationsToCollaborations(projectId: ProjectId): Promise<EntityMigrationResult> {
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);
		if (!projectAdminDataDir) {
			throw new Error(`Failed to get project admin data directory for ${projectId}`);
		}

		const conversationsDir = join(projectAdminDataDir, 'conversations');
		const collaborationsDir = join(projectAdminDataDir, 'collaborations');
		const cleanupDir = join(projectAdminDataDir, 'cleanup');
		const corruptedDir = join(projectAdminDataDir, 'corrupted');
		const conversationsJsonPath = join(projectAdminDataDir, 'conversations.json');
		const collaborationsJsonPath = join(projectAdminDataDir, 'collaborations.json');

		const result: EntityMigrationResult = {
			success: true,
			version: {
				from: 3,
				to: 4,
			},
			changes: [],
			errors: [],
		};

		// Check if migration is needed
		if (await exists(collaborationsJsonPath) && await exists(collaborationsDir)) {
			// Already migrated
			return result;
		}

		if (!await exists(conversationsDir)) {
			// No conversations to migrate
			return result;
		}

		logger.info(
			`StorageMigration: Starting migration from conversations to collaborations for project ${projectId}`,
		);

		try {
			// Ensure cleanup directory exists
			await ensureDir(cleanupDir);
			await ensureDir(corruptedDir);
			await ensureDir(collaborationsDir);

			// // Read existing conversations.json if it exists
			// let conversations: InteractionMetadata[] = [];
			// if (await exists(conversationsJsonPath)) {
			// 	const content = await Deno.readTextFile(conversationsJsonPath);
			// 	const data = JSON.parse(content);
			// 	if (Array.isArray(data)) {
			// 		conversations = data;
			// 	} else if (data.version && Array.isArray(data.interactions || data.conversations)) {
			// 		conversations = data.interactions || data.conversations;
			// 	}
			// }

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
				const isEmpty = await StorageMigration.isEmptyConversationDir(conversationPath);
				if (isEmpty) {
					// Move empty directory to cleanup
					const cleanupPath = join(cleanupDir, `empty_conversation_${conversationId}`);
					await Deno.rename(conversationPath, cleanupPath);
					logger.info(`StorageMigration: Moved empty conversation directory ${conversationId} to cleanup`);
					result.changes.push({
						type: 'file_move',
						path: conversationPath,
						details: `Moved empty conversation directory ${conversationId} to cleanup`,
					});
					continue;
				}
				const isCorrupted = await StorageMigration.isCorruptedConversationDir(conversationPath);
				if (isCorrupted) {
					// Move corrupted directory to corrupted
					const corruptedPath = join(corruptedDir, `corrupted_conversation_${conversationId}`);
					await Deno.rename(conversationPath, corruptedPath);
					logger.warn(
						`StorageMigration: Moved corrupted conversation directory ${conversationId} to corrupted`,
					);
					result.changes.push({
						type: 'file_move',
						path: conversationPath,
						details: `Moved corrupted conversation directory ${conversationId} to corrupted`,
					});
					continue;
				}

				// Find corresponding metadata
				const conversationMetadataJsonPath = join(conversationsDir, conversationId, 'metadata.json');
				let conversationMetadata;
				if (await exists(conversationMetadataJsonPath)) {
					const conversationMetadataContent = await Deno.readTextFile(conversationMetadataJsonPath);
					conversationMetadata = JSON.parse(conversationMetadataContent);
				} else {
					logger.error(
						`StorageMigration: No metadata file found for conversation ${conversationId}, skipping`,
					);
				}
				//const conversationMetadata = conversations.find((c) => c.id === conversationId);
				if (!conversationMetadata) {
					logger.error(`StorageMigration: No metadata found for conversation ${conversationId}, skipping`);
					continue;
				}

				const emptyTokenUsage = {
					totalTokens: 0,
					inputTokens: 0,
					outputTokens: 0,
					cacheCreationInputTokens: undefined,
					cacheReadInputTokens: undefined,
					thoughtTokens: undefined,
					totalAllTokens: undefined,
				};

				/*
				if (!conversationMetadata.tokenUsageStats) {
					logger.warn(
						`StorageMigration: Missing tokenUsageStats in metadata for conversation ${conversationId} - setting values to 0`,
					);
					result.changes.push({
						type: 'metadata',
						path: 'metadata.json',
						details:
							`Missing tokenUsageStats in metadata for conversation ${conversationId} - setting values to 0`,
					});
				}
				if (!conversationMetadata.conversationStats) {
					logger.warn(
						`StorageMigration: Missing conversationStats in metadata for conversation ${conversationId} - setting values to 0`,
					);
					result.changes.push({
						type: 'metadata',
						path: 'metadata.json',
						details:
							`Missing conversationStats in metadata for conversation ${conversationId} - setting values to 0`,
					});
				}
				if (!conversationMetadata.conversationMetrics) {
					logger.warn(
						`StorageMigration: Missing conversationMetrics in metadata for conversation ${conversationId} - setting values to 0`,
					);
					result.changes.push({
						type: 'metadata',
						path: 'metadata.json',
						details:
							`Missing conversationMetrics in metadata for conversation ${conversationId} - setting values to 0`,
					});
				}
				const interactionMetadata: InteractionMetadata = {
					...conversationMetadata,
					tokenUsageStatsForInteraction: {
						tokenUsageInteraction: conversationMetadata.tokenUsageStats?.tokenUsageConversation || emptyTokenUsage, // rename to tokenUsageInteraction
						tokenUsageStatement: conversationMetadata.tokenUsageStats?.tokenUsageStatement || emptyTokenUsage,
						tokenUsageTurn: conversationMetadata.tokenUsageStats?.tokenUsageTurn || emptyTokenUsage,
					},
					interactionStats: {
						...conversationMetadata.conversationStats,
						interactionTurnCount: conversationMetadata.conversationStats?.conversationTurnCount || 0, // rename to interactionTurnCount
					},
					interactionMetrics: {
						...conversationMetadata.conversationMetrics,
						interactionTurnCount: conversationMetadata.conversationMetrics?.conversationTurnCount || 0, // rename to interactionTurnCount
					},
				};
				// deno-lint-ignore no-explicit-any
				delete (interactionMetadata as any).conversationStats.conversationTurnCount;
				// deno-lint-ignore no-explicit-any
				delete (interactionMetadata as any).conversationStats;
				// deno-lint-ignore no-explicit-any
				// if ((interactionMetadata as any).interactionMetrics) delete (interactionMetadata as any).interactionMetrics.conversationTurnCount;
				// deno-lint-ignore no-explicit-any
				delete (interactionMetadata as any).conversationMetrics.conversationTurnCount;
				// deno-lint-ignore no-explicit-any
				delete (interactionMetadata as any).conversationMetrics;
				 */

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

				// Create collaboration metadata with version 4
				const collaborationMetadata: CollaborationMetadata = {
					version: 4,
					id: collaborationId,
					projectId: projectId,
					title: conversationMetadata.title || 'untitled',
					type: 'project',
					collaborationParams: conversationMetadata.collaborationParams || {
						rolesModelConfig: {
							orchestrator: null,
							agent: null,
							chat: null,
						},
					},
					tokenUsageCollaboration: {
						...emptyTokenUsage,
						...(conversationMetadata.tokenUsageStatsForInteraction?.tokenUsageInteraction ||
							conversationMetadata.tokenUsageStats?.tokenUsageConversation ||
							conversationMetadata.tokenUsageConversation), // rename to tokenUsageInteraction
					},
					createdAt: conversationMetadata.createdAt,
					updatedAt: conversationMetadata.updatedAt,
					totalInteractions: 1,
					interactionIds: [conversationId],
					lastInteractionId: conversationId,
					lastInteractionMetadata: {
						id: conversationId,
						llmProviderName: conversationMetadata.llmProviderName,
						model: conversationMetadata.model,
						interactionStats: conversationMetadata.interactionStats,
						tokenUsageStatsForInteraction: {
							tokenUsageInteraction: {
								...emptyTokenUsage,
								...(
									conversationMetadata.tokenUsageStatsForInteraction?.tokenUsageInteraction ||
									conversationMetadata.tokenUsageStats?.tokenUsageConversation ||
									conversationMetadata.tokenUsageConversation
								), // rename to tokenUsageInteraction
							},
							tokenUsageStatement: {
								...emptyTokenUsage,
								...(
									conversationMetadata.tokenUsageStatsForInteraction?.tokenUsageStatement ||
									conversationMetadata.tokenUsageStats?.tokenUsageStatement ||
									conversationMetadata.tokenUsageStatement
								),
							},
							tokenUsageTurn: {
								...emptyTokenUsage,
								...(conversationMetadata.tokenUsageStatsForInteraction?.tokenUsageTurn ||
									conversationMetadata.tokenUsageStats?.tokenUsageTurn ||
									conversationMetadata.tokenUsageTurn),
							},
						},
						createdAt: conversationMetadata.createdAt,
						updatedAt: conversationMetadata.updatedAt,
					},
				};

				result.changes.push({
					type: 'metadata',
					path: 'metadata.json',
					details: `Created metadata for collaboration ${collaborationId}`,
				});

				// Save collaboration metadata
				const collaborationMetadataPath = join(collaborationDir, 'metadata.json');
				await Deno.writeTextFile(collaborationMetadataPath, JSON.stringify(collaborationMetadata, null, 2));

				collaborations.push(collaborationMetadata);

				// Handle legacy conversation.log and conversation.jsonl files
				const conversationLogPath = join(interactionDir, 'conversation.log');
				const conversationJsonlPath = join(interactionDir, 'conversation.jsonl');

				if (await exists(conversationLogPath)) {
					// Move conversation.log to collaboration directory and rename
					const collaborationLogPath = join(collaborationDir, 'collaboration.log');
					await Deno.rename(conversationLogPath, collaborationLogPath);
					result.changes.push({
						type: 'file_move',
						path: conversationLogPath,
						details: `Moved and renamed to ${collaborationLogPath}`,
					});
				}

				if (await exists(conversationJsonlPath)) {
					// Move conversation.jsonl to collaboration directory and rename
					const collaborationJsonlPath = join(collaborationDir, 'collaboration.jsonl');
					//await Deno.rename(conversationJsonlPath, collaborationJsonlPath);
					const content = await Deno.readTextFile(conversationJsonlPath);
					const transformedContent = content
						.split('\n')
						.filter((line) => line.trim())
						.map((line) => {
							const obj = JSON.parse(line);

							if (obj.conversationStats) {
								obj.interactionStats = {
									...obj.conversationStats,
									interactionTurnCount: obj.conversationStats.conversationTurnCount,
								};
								if (obj.interactionStats) delete obj.interactionStats.conversationTurnCount;
								delete obj.conversationStats;
							} else {
								obj.interactionStats = {
									statementTurnCount: 0,
									interactionTurnCount: 0,
									statementCount: 0,
								};
								// logger.warn(`StorageMigration: Missing conversationStats in log entries for conversation ${conversationId} - skipping values`);
								result.changes.push({
									type: 'metadata',
									path: 'conversation.jsonl',
									details:
										`Missing conversationStats in log entries for conversation ${conversationId} - setting values to 0`,
								});
							}

							// if (obj.tokenUsageStatsForInteraction?.tokenUsageConversation) {
							// 	obj.tokenUsageStatsForInteraction.tokenUsageInteraction = {
							// 		...obj.tokenUsageStatsForInteraction.tokenUsageConversation,
							// 	};
							// 	delete obj.tokenUsageStatsForInteraction.tokenUsageConversation;
							// } else {
							// 	obj.tokenUsageStatsForInteraction = {
							// 		...(obj.tokenUsageStatsForInteraction || {
							// 			tokenUsageTurn: emptyTokenUsage,
							// 			tokenUsageStatement: emptyTokenUsage,
							// 		}),
							// 		tokenUsageInteraction: emptyTokenUsage,
							// 	};
							// 	// logger.warn(`StorageMigration: Missing tokenUsageStatsForInteraction.tokenUsageConversation in log entries for conversation ${conversationId} - skipping values`);
							// 	result.changes.push({
							// 		type: 'metadata',
							// 		path: 'conversation.jsonl',
							// 		details:
							// 			`Missing tokenUsageStatsForInteraction.tokenUsageConversation in log entries for conversation ${conversationId} - setting values to 0`,
							// 	});
							// }

							if (obj.tokenUsageStats) {
								obj.tokenUsageStatsForInteraction = {
									...obj.tokenUsageStats,
									tokenUsageInteraction: {
										...emptyTokenUsage,
										...obj.tokenUsageStats.tokenUsageConversation,
									},
									...(obj.tokenUsageStatsForInteraction || {}),
								};
								if (obj.tokenUsageStatsForInteraction) {
									delete obj.tokenUsageStatsForInteraction.tokenUsageConversation;
								}
								if (obj.tokenUsageInteraction) delete obj.tokenUsageInteraction.tokenUsageConversation;
								if (obj.tokenUsageStats) delete obj.tokenUsageStats.tokenUsageConversation;
								delete obj.tokenUsageStats;
							} else {
								obj.tokenUsageStatsForInteraction = {
									tokenUsageTurn: { ...emptyTokenUsage, ...obj.tokenUsageTurn },
									tokenUsageStatement: {
										...emptyTokenUsage,
										...obj.tokenUsageStatement,
									},
									tokenUsageInteraction: {
										...emptyTokenUsage,
										...(obj.tokenUsageInteraction || obj.tokenUsageConversation),
									},
									...(obj.tokenUsageStatsForInteraction || {}),
								};
								if (obj.tokenUsageStatsForInteraction) {
									delete obj.tokenUsageStatsForInteraction.tokenUsageConversation;
								}
								// logger.warn(`StorageMigration: Missing tokenUsageStats.tokenUsageConversation in log entries for conversation ${conversationId} - skipping values`);
								result.changes.push({
									type: 'metadata',
									path: 'conversation.jsonl',
									details:
										`Missing tokenUsageStats.tokenUsageConversation in log entries for conversation ${conversationId} - setting values to 0`,
								});
							}
							delete obj.tokenUsageTurn;
							delete obj.tokenUsageStatement;
							delete obj.tokenUsageInteraction;
							delete obj.tokenUsageConversation;

							return JSON.stringify(obj);
						})
						.join('\n');

					await Deno.writeTextFile(collaborationJsonlPath, transformedContent);
					await Deno.remove(conversationJsonlPath);
					result.changes.push({
						type: 'file_move',
						path: conversationJsonlPath,
						details: `Moved and renamed to ${collaborationJsonlPath}`,
					});
				}

				logger.info(`StorageMigration: Migrated conversation ${conversationId} to collaboration`);
			}

			// Create collaborations.json with version 4
			const collaborationsData: CollaborationsFileV4 = {
				version: '4.0',
				collaborations: collaborations,
			};
			await Deno.writeTextFile(collaborationsJsonPath, JSON.stringify(collaborationsData, null, 2));

			// Move original conversations directory to cleanup
			if (await exists(conversationsDir)) {
				const backupConversationsPath = join(cleanupDir, 'conversations_backup');
				await Deno.rename(conversationsDir, backupConversationsPath);
				logger.info(`StorageMigration: Moved original conversations directory to cleanup`);
			}

			// Move original conversations.json to cleanup
			if (await exists(conversationsJsonPath)) {
				const backupConversationsJsonPath = join(cleanupDir, 'conversations_backup.json');
				await Deno.rename(conversationsJsonPath, backupConversationsJsonPath);
				logger.info(`StorageMigration: Moved original conversations.json to cleanup`);
			}

			logger.info(
				`StorageMigration: Successfully migrated ${collaborations.length} conversations to collaborations for project ${projectId}`,
			);

			const resultsJsonPath = join(projectAdminDataDir, 'migrate-collaborations-results.json');
			await Deno.writeTextFile(resultsJsonPath, JSON.stringify(result, null, 2));

			return result;
		} catch (error) {
			logger.error(
				`StorageMigration: Failed to migrate conversations to collaborations for project ${projectId}: ${
					errorMessage(error)
				}`,
			);
			result.success = false;
			result.errors.push({
				message:
					`Migration failed: Failed to migrate conversations to collaborations for project ${projectId}: ${
						errorMessage(error)
					}`,
				details: error,
			});
			const resultsJsonPath = join(projectAdminDataDir, 'migrate-collaborations-results.json');
			await Deno.writeTextFile(resultsJsonPath, JSON.stringify(result, null, 2));
			return result;
			//throw error;
		}
	}

	/**
	 * Copies the latest revision of each resource to the project level
	 */
	private static async migrateProjectResources(
		projectId: ProjectId,
		resourceMap: Map<string, ResourceRevisionInfo>,
		projectPersistence: ProjectPersistence,
	): Promise<void> {
		try {
			const projectAdminDataDir = await getProjectAdminDataDir(projectId);

			// Process each resource
			for (const [_resourceKey, info] of resourceMap.entries()) {
				try {
					// Skip resources with no URI
					if (!info.uri) continue;

					// Find the content of the latest revision
					const revisionId = info.latestRevision;
					const interactionsDir = join(projectAdminDataDir, 'conversations');
					let content: string | Uint8Array | null = null;

					// Look through all interactions for this revision
					for await (const entry of Deno.readDir(interactionsDir)) {
						if (!entry.isDirectory) continue;

						const interactionId = entry.name;
						const revisionKey = generateResourceRevisionKey(info.uri, revisionId);
						const revisionPath = join(interactionsDir, interactionId, 'resource_revisions', revisionKey);

						// Check if the revision exists
						if (await exists(revisionPath)) {
							// Found the revision, read it
							if (info.uri.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
								content = await Deno.readFile(revisionPath);
							} else {
								content = await Deno.readTextFile(revisionPath);
							}
							break;
						}
					}

					// If we found content, store it at the project level
					if (content) {
						const resourceMetadata: ResourceMetadata = {
							type: info.metadata.type || 'file',
							contentType: info.metadata.contentType || 'text',
							name: info.metadata.name || info.uri,
							uri: info.uri,
							mimeType: info.metadata.mimeType || 'text/plain',
							size: info.metadata.size,
							lastModified: info.metadata.lastModified
								? new Date(info.metadata.lastModified)
								: new Date(),
						};

						await projectPersistence.storeProjectResource(info.uri, content, resourceMetadata);
						logger.debug(`StorageMigration: Stored resource ${info.uri} at project level`);
					}
				} catch (error) {
					logger.error(
						`StorageMigration: Error storing resource ${info.uri} at project level: ${errorMessage(error)}`,
					);
					// Continue with other resources
				}
			}
		} catch (error) {
			logger.error(`StorageMigration: Error migrating project resources: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to migrate project resources: ${errorMessage(error)}`,
				{
					projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
	}

	// Helper methods

	private static async readMetadata(path: string): Promise<InteractionMetadata> {
		try {
			const content = await Deno.readTextFile(path);
			try {
				return JSON.parse(content);
			} catch (error) {
				throw new Error(`Invalid JSON in metadata file: ${errorMessage(error)}`);
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				throw new Error('Legacy entity: metadata.json not found');
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
			const data = JSON.parse(content);
			if (Array.isArray(data)) {
				return data;
			} else if (data.version && Array.isArray(data.conversations)) {
				return data.conversations;
			} else {
				return [];
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				return [];
			}
			throw error;
		}
	}

	/**
	 * Check if a conversation directory is empty or only contains empty resource_revisions
	 */
	private static async isEmptyConversationDir(conversationPath: string): Promise<boolean> {
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
		} catch (_error) {
			// If we can't read the directory, assume it's not empty
			return false;
		}
	}

	/**
	 * Check if a conversation directory is corrupted - has file entries but no metadata.json
	 */
	private static async isCorruptedConversationDir(conversationPath: string): Promise<boolean> {
		try {
			const hasFiles = async (dirPath: string): Promise<boolean> => {
				for await (const entry of Deno.readDir(dirPath)) {
					if (entry.isFile) return true;
					if (entry.isDirectory && await hasFiles(join(dirPath, entry.name))) return true;
				}
				return false;
			};

			const entries = Array.fromAsync(Deno.readDir(conversationPath));
			const dirEntries = await entries;

			const hasMetadata = dirEntries.some((entry) => entry.name === 'metadata.json' && entry.isFile);
			//if (hasMetadata) return false;

			const containsFiles = await hasFiles(conversationPath);

			// Corrupted if files exist anywhere in tree but no metadata.json at root
			return containsFiles && !hasMetadata;
		} catch (_error) {
			// If we can't read the directory, assume it's not corrupted
			return false;
		}
	}
}
