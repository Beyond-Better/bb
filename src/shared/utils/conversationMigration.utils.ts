import { ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import { logger } from 'shared/logger.ts';
import { getProjectAdminDataDir } from 'shared/projectPath.ts';
import { generateResourceRevisionKey, generateResourceUriKey } from 'shared/dataSource.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import type { FileHandlingErrorOptions, ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import type { InteractionMetadata } from 'shared/types.ts';
import type { ResourceMetadata, ResourceRevisionMetadata } from 'shared/types/dataSourceResource.ts';
import type ProjectPersistence from 'api/storage/projectPersistence.ts';

/**
 * Versioned format for conversations.json file
 */
export interface ConversationsFileV1 {
	version: string;
	conversations: InteractionMetadata[];
}

/**
 * Versioned format for conversations.json file
 */
export interface InteractionsFileV2 {
	version: string;
	interactions: InteractionMetadata[];
}

/**
 * Interface for tracking conversation migration state
 */
export interface ConversationsMigrationState {
	version: string; // Current migration version
	lastMigrated: string; // ISO timestamp
	migratedCount: number; // Number of conversations migrated
}

/**
 * Current version of the conversation migrations
 * This should match the version used in the conversations.json file
 */
export const CURRENT_MIGRATION_VERSION = '2.0';

/**
 * Map of migration locks to prevent concurrent migrations
 */
const migrationLocks = new Map<string, boolean>();

/**
 * Map of in-progress migrations to allow waiting for completion
 */
const migrationPromises = new Map<string, Promise<void>>();

/**
 * Migrates the conversations.json file format from v0 (array) to v1 (object with version and conversations array)
 * Similar to how projectRegistry handles migration
 */
export async function migrateConversationsFileIfNeeded(projectId: string): Promise<void> {
	// Check if migration is already in progress
	if (migrationPromises.has(projectId)) {
		// Wait for the existing migration to complete
		return migrationPromises.get(projectId)!;
	}

	// Acquire lock for this projectId
	if (migrationLocks.get(projectId)) {
		// Another call is in the process of setting up the migration
		// Wait a tick and check again for the promise
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (migrationPromises.has(projectId)) {
			return migrationPromises.get(projectId)!;
		}
	}

	// Set lock
	migrationLocks.set(projectId, true);

	try {
		// Create new migration promise
		const migrationPromise = (async () => {
			try {
				const projectAdminDataDir = await getProjectAdminDataDir(projectId);
				const conversationsFilePath = join(projectAdminDataDir, 'conversations.json');

				// If the file doesn't exist, create it with the new format
				if (!await exists(conversationsFilePath)) {
					logger.info(`ConversationMigration: Creating new conversations.json file for project ${projectId}`);
					await ensureDir(dirname(conversationsFilePath));
					const newData: ConversationsFileV1 = {
						version: CURRENT_MIGRATION_VERSION,
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
					logger.info(
						`ConversationMigration: Conversations file already in v1 format for project ${projectId}`,
					);
					return;
				}

				// Check if it's an array (v0 format)
				if (Array.isArray(data)) {
					logger.info(
						`ConversationMigration: Migrating conversations.json to v1 format for project ${projectId}`,
					);

					// Create new format with the existing array as the conversations property
					const migratedData: ConversationsFileV1 = {
						version: CURRENT_MIGRATION_VERSION,
						conversations: data,
					};

					// Write the migrated data back
					await Deno.writeTextFile(conversationsFilePath, JSON.stringify(migratedData, null, 2));
					logger.info(
						`ConversationMigration: Successfully migrated conversations.json to v1 format for project ${projectId}`,
					);
				} else {
					// Unknown format
					logger.warn(`ConversationMigration: Unknown format for conversations.json in project ${projectId}`);

					// Create new format with empty conversations array
					const migratedData: ConversationsFileV1 = {
						version: CURRENT_MIGRATION_VERSION,
						conversations: [],
					};

					// Write the new data back
					await Deno.writeTextFile(conversationsFilePath, JSON.stringify(migratedData, null, 2));
					logger.warn(
						`ConversationMigration: Reset conversations.json to v1 format for project ${projectId}`,
					);
				}
			} catch (error) {
				logger.error(
					`ConversationMigration: Error migrating conversations.json for project ${projectId}: ${
						(error as Error).message
					}`,
				);
				throw createError(
					ErrorType.FileHandling,
					`Failed to migrate conversations.json: ${(error as Error).message}`,
					{
						filePath: `projects/${projectId}/data/conversations.json`,
						operation: 'write',
					} as FileHandlingErrorOptions,
				);
			} finally {
				// Clean up the promise reference when done
				migrationPromises.delete(projectId);
			}
		})();

		// Store the promise
		migrationPromises.set(projectId, migrationPromise);

		// Return the promise so caller waits for completion
		return migrationPromise;
	} finally {
		// Release lock
		migrationLocks.delete(projectId);
	}
}

/**
 * Interface for tracking resource revisions
 */
interface ResourceRevisionInfo {
	uri: string;
	latestRevision: string;
	revisions: string[];
	metadata: ResourceRevisionMetadata;
}

/**
 * Migrates conversation resource revisions to use the new URI and key format
 * This function implements a simplified migration approach:
 * 1. If resources_metadata.json exists, migration is considered complete
 * 2. If only files_metadata.json exists, perform migration
 * 3. For each resource in files_metadata.json, convert to new format
 * 4. Move files from file_revisions to resource_revisions
 */
export async function migrateConversationResources(
	projectId: string,
	projectPersistence: ProjectPersistence,
): Promise<void> {
	try {
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);
		const interactionsDir = join(projectAdminDataDir, 'conversations');
		const migrationStateFile = join(projectAdminDataDir, '.conversations-migrated');

		// Check if migration state file exists
		if (await exists(migrationStateFile)) {
			try {
				const stateContent = await Deno.readTextFile(migrationStateFile);
				const state = JSON.parse(stateContent) as ConversationsMigrationState;

				// If already at current version, skip migration
				if (state.version === CURRENT_MIGRATION_VERSION) {
					logger.info(
						`ConversationMigration: Conversations already migrated to version ${state.version} for project ${projectId}, skipping`,
					);
					return;
				}

				logger.info(
					`ConversationMigration: Previous migration was to version ${state.version}, current is ${CURRENT_MIGRATION_VERSION}, proceeding with migration`,
				);
			} catch (error) {
				logger.warn(
					`ConversationMigration: Error reading migration state file, will proceed with migration: ${
						errorMessage(error)
					}`,
				);
				// Continue with migration if file is corrupted
			}
		}

		// Ensure the directory exists
		if (!await exists(interactionsDir)) {
			logger.info(`ConversationMigration: No collaborations directory found for project ${projectId}`);

			// Create migration state file even if no collaborations exist
			const migrationState: ConversationsMigrationState = {
				version: CURRENT_MIGRATION_VERSION,
				lastMigrated: new Date().toISOString(),
				migratedCount: 0,
			};
			await Deno.writeTextFile(migrationStateFile, JSON.stringify(migrationState, null, 2));
			return;
		}

		// Track the latest revision of each resource across all conversations
		const resourceMap = new Map<string, ResourceRevisionInfo>();
		let migratedCount = 0;

		// Process each conversation directory
		for await (const entry of Deno.readDir(interactionsDir)) {
			if (!entry.isDirectory) continue;

			const conversationId = entry.name;
			const newMetadataPath = join(interactionsDir, conversationId, 'resources_metadata.json');
			const oldMetadataPath = join(interactionsDir, conversationId, 'files_metadata.json');
			const newResourceRevisionsDir = join(interactionsDir, conversationId, 'resource_revisions');
			const oldFileRevisionsDir = join(interactionsDir, conversationId, 'file_revisions');

			// If resources_metadata.json exists, assume migration is already complete for this conversation
			if (await exists(newMetadataPath)) {
				logger.info(
					`ConversationMigration: ${conversationId} already has resources_metadata.json, skipping migration`,
				);
				migratedCount++;
				continue;
			}

			// If files_metadata.json doesn't exist, nothing to migrate
			if (!await exists(oldMetadataPath)) {
				logger.info(
					`ConversationMigration: No files_metadata.json found for conversation ${conversationId}, nothing to migrate`,
				);
				continue;
			}

			// Create the new resource_revisions directory if it doesn't exist
			await ensureDir(newResourceRevisionsDir);

			try {
				// Read the old resources metadata
				const metadataContent = await Deno.readTextFile(oldMetadataPath);
				const oldMetadata = JSON.parse(metadataContent);
				const updatedMetadata: Record<string, ResourceRevisionMetadata> = {};

				logger.info(
					`ConversationMigration: Migrating ${
						Object.keys(oldMetadata).length
					} resources for conversation ${conversationId}`,
				);

				// Process each resource entry from files_metadata.json
				for (const [oldKey, metadata] of Object.entries(oldMetadata)) {
					// Split the key on _rev_
					const parts = oldKey.split('_rev_');
					if (parts.length !== 2) {
						logger.warn(`ConversationMigration: Invalid key format ${oldKey}, skipping`);
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
						// Create directory if it doesn't exist
						await ensureDir(dirname(newPath));

						try {
							// Try to move the file
							await Deno.rename(oldPath, newPath);
							logger.info(`ConversationMigration: Moved resource from ${oldPath} to ${newPath}`);
						} catch (moveError) {
							// If move fails (e.g., across filesystems), fall back to copy+delete
							logger.warn(
								`ConversationMigration: Could not move file directly, falling back to copy+delete: ${
									errorMessage(moveError)
								}`,
							);
							await Deno.copyFile(oldPath, newPath);
							try {
								await Deno.remove(oldPath);
								logger.info(
									`ConversationMigration: Copied and deleted resource from ${oldPath} to ${newPath}`,
								);
							} catch (deleteError) {
								logger.warn(
									`ConversationMigration: Copied file but failed to delete original: ${
										errorMessage(deleteError)
									}`,
								);
							}
						}
					} else {
						logger.warn(`ConversationMigration: Could not find original file at ${oldPath}`);
					}
				}

				// Write to the new metadata file
				await Deno.writeTextFile(newMetadataPath, JSON.stringify(updatedMetadata, null, 2));
				logger.info(
					`ConversationMigration: Created resources_metadata.json with ${
						Object.keys(updatedMetadata).length
					} entries for conversation ${conversationId}`,
				);
				migratedCount++;
			} catch (error) {
				logger.error(
					`ConversationMigration: Error processing conversation ${conversationId}: ${
						(error as Error).message
					}`,
				);
				// Continue with other conversations
			}
		}

		// Store latest version of each resource at the project level
		await migrateProjectResources(projectId, resourceMap, projectPersistence);

		// After migration is complete, update the migration state file
		const migrationState: ConversationsMigrationState = {
			version: CURRENT_MIGRATION_VERSION,
			lastMigrated: new Date().toISOString(),
			migratedCount: migratedCount,
		};
		await Deno.writeTextFile(migrationStateFile, JSON.stringify(migrationState, null, 2));
		logger.info(`ConversationMigration: Updated migration state for project ${projectId}`);
	} catch (error) {
		logger.error(
			`ConversationMigration: Error migrating resources for project ${projectId}: ${(error as Error).message}`,
		);
		throw createError(
			ErrorType.ProjectHandling,
			`Failed to migrate conversation resources: ${(error as Error).message}`,
			{
				projectId,
			} as ProjectHandlingErrorOptions,
		);
	}
}

/**
 * Copies the latest revision of each resource to the project level
 * Simplified to only look in the new resource_revisions directories
 */
async function migrateProjectResources(
	projectId: string,
	resourceMap: Map<string, ResourceRevisionInfo>,
	projectPersistence: ProjectPersistence,
): Promise<void> {
	try {
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);

		// Process each resource
		for (const [resourceKey, info] of resourceMap.entries()) {
			try {
				// Skip resources with no URI (shouldn't happen)
				if (!info.uri) continue;

				// Find the content of the latest revision
				const revisionId = info.latestRevision;
				const interactionsDir = join(projectAdminDataDir, 'collaborations');
				let content: string | Uint8Array | null = null;

				// Look through all conversations for this revision
				for await (const entry of Deno.readDir(interactionsDir)) {
					if (!entry.isDirectory) continue;

					const collaborationId = entry.name;
					const revisionKey = generateResourceRevisionKey(info.uri, revisionId);
					const revisionPath = join(interactionsDir, conversationId, 'resource_revisions', revisionKey);

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
						lastModified: info.metadata.lastModified ? new Date(info.metadata.lastModified) : new Date(),
					};

					await projectPersistence.storeProjectResource(info.uri, content, resourceMetadata);
					logger.info(`ConversationMigration: Stored resource ${info.uri} at project level`);
				}
			} catch (error) {
				logger.error(
					`ConversationMigration: Error storing resource ${info.uri} at project level: ${
						(error as Error).message
					}`,
				);
				// Continue with other resources
			}
		}
	} catch (error) {
		logger.error(`ConversationMigration: Error migrating project resources: ${(error as Error).message}`);
		throw createError(
			ErrorType.ProjectHandling,
			`Failed to migrate project resources: ${(error as Error).message}`,
			{
				projectId,
			} as ProjectHandlingErrorOptions,
		);
	}
}
