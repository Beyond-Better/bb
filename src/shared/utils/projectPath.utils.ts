import { join } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import { getGlobalConfigDir } from './dataDir.utils.ts';
import { getProjectRegistry, type StoredProjectV0 } from 'shared/projectRegistry.ts';
import { logger } from 'shared/logger.ts';

/**
 * Gets the path to the project directory within the global config directory.
 * This is where project-specific data will be stored in the new structure.
 * Format: ${globalRoot}/projects/${projectId}/
 */
export async function getProjectAdminDir(projectId: string): Promise<string> {
	const customProjectAdminDir = Deno.env.get('BB_PROJECT_ADMIN_DIR'); // used for testing - don't rely on it for other purposes
	if (customProjectAdminDir) {
		if (!Deno.env.get('BB_UNIT_TESTS')) {
			logger.warn(`ProjectPath: CUSTOM PROJECT_ADMIN_DIR - USE ONLY FOR TESTING: ${customProjectAdminDir}`);
		}
		await ensureDir(customProjectAdminDir);
		return customProjectAdminDir;
	}

	const globalConfigDir = await getGlobalConfigDir();
	const projectDir = join(globalConfigDir, 'projects', projectId);
	await ensureDir(projectDir);
	return projectDir;
}

/**
 * Gets the path to the project data directory within the global config directory.
 * Format: ${globalRoot}/projects/${projectId}/data/
 */
export async function getProjectAdminDataDir(projectId: string): Promise<string> {
	const projectDir = await getProjectAdminDir(projectId);
	const dataDir = join(projectDir, 'data');
	await ensureDir(dataDir);
	return dataDir;
}

/**
 * Gets the path to the project configuration file within the global config directory.
 * Format: ${globalRoot}/projects/${projectId}/config.yaml
 */
export async function getProjectAdminConfigPath(projectId: string): Promise<string> {
	const projectDir = await getProjectAdminDir(projectId);
	return join(projectDir, 'config.yaml');
}

/**
 * Checks if a project has been migrated to the new structure
 * by checking if the global project directory exists and has the necessary files.
 */
export async function isProjectMigrated(projectId: string): Promise<boolean> {
	const globalConfigDir = await getGlobalConfigDir();
	const projectDir = join(globalConfigDir, 'projects', projectId);
	const configPath = join(projectDir, 'config.yaml');

	return await exists(configPath);
}

/**
 * Migrates a project's files from old structure to new structure
 * This moves:
 * - config.yaml from ${projectRoot}/.bb/config.yaml to ${globalRoot}/projects/${projectId}/config.yaml
 * - data from ${projectRoot}/.bb/data to ${globalRoot}/projects/${projectId}/data
 */
// Store in-progress migrations
const migrationPromises = new Map<string, Promise<void>>();
const migrationLock = new Map<string, boolean>();
export async function migrateProjectFiles(projectId: string): Promise<void> {
	// Check if migration is already in progress
	if (migrationPromises.has(projectId)) {
		// Wait for the existing migration to complete
		return migrationPromises.get(projectId)!;
	}

	// Acquire lock for this projectId
	if (migrationLock.get(projectId)) {
		// Another call is in the process of setting up the migration
		// Wait a tick and check again for the promise
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (migrationPromises.has(projectId)) {
			return migrationPromises.get(projectId)!;
		}
	}

	// Set lock
	migrationLock.set(projectId, true);

	try {
		// Create new migration promise
		const migrationPromise = (async () => {
			try {
				const registry = await getProjectRegistry();
				const project = await registry.getProject(projectId);

				if (!project) {
					logger.error(`ProjectPath: Migration failed: Project ${projectId} not found in registry`);
					return;
				}

				const projectRoot = (project as unknown as StoredProjectV0).path ||
					(project.dataSourcePaths ? project.dataSourcePaths[0] : undefined);
				if (!projectRoot) throw new Error('ProjectPath: No filesystem data sources in project');

				const oldConfigPath = join(projectRoot, '.bb', 'config.yaml');
				const oldStatementHistoryPath = join(projectRoot, '.bb', 'statement_history.json');
				const oldMigrationsPath = join(projectRoot, '.bb', 'statement_history.json');
				const oldDataDir = join(projectRoot, '.bb', 'data');
				const oldToolsDir = join(projectRoot, '.bb', 'tools');

				const projectAdminDir = await getProjectAdminDir(projectId);
				const newConfigPath = join(projectAdminDir, 'config.yaml');
				const newStatementHistoryPath = join(projectAdminDir, 'statement_history.json');
				const newMigrationsPath = join(projectAdminDir, 'statement_history.json');
				const newDataDir = join(projectAdminDir, 'data');
				const newToolsDir = join(projectAdminDir, 'tools');

				// Check if migration is needed
				if (await isProjectMigrated(projectId)) {
					logger.info(`ProjectPath: Project ${projectId} already migrated to new structure`);
					return;
				}

				// Ensure the new directories exist
				await ensureDir(projectAdminDir);
				await ensureDir(newDataDir);

				// Copy config file
				if (await exists(oldConfigPath)) {
					await Deno.copyFile(oldConfigPath, newConfigPath);
					logger.info(`ProjectPath: Migrated config.yaml for project ${projectId}`);
				}

				// Copy statement_history file
				if (await exists(oldStatementHistoryPath)) {
					await Deno.copyFile(oldStatementHistoryPath, newStatementHistoryPath);
					logger.info(`ProjectPath: Migrated statement_history.json for project ${projectId}`);
				}

				// Copy migrations file
				if (await exists(oldMigrationsPath)) {
					await Deno.copyFile(oldMigrationsPath, newMigrationsPath);
					logger.info(`ProjectPath: Migrated migrations.json for project ${projectId}`);
				}

				// Copy data directory
				if (await exists(oldDataDir)) {
					// Use recursive copy function to copy the entire directory
					await copyDirectory(oldDataDir, newDataDir);
					logger.info(`ProjectPath: Migrated data directory for project ${projectId}`);
				}

				// Copy tools directory
				if (await exists(oldToolsDir)) {
					// Use recursive copy function to copy the entire directory
					await copyDirectory(oldToolsDir, newToolsDir);
					logger.info(`ProjectPath: Migrated tools directory for project ${projectId}`);
				}

				// Mark as migrated
				await Deno.writeTextFile(join(projectAdminDir, '.migrated'), new Date().toISOString());
				logger.info(`ProjectPath: Completed migration for project ${projectId}`);
			} catch (error) {
				logger.error(`ProjectPath: Error migrating project ${projectId}: ${(error as Error).message}`);
				throw error;
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
		migrationLock.delete(projectId);
	}
}

/**
 * Recursively copies a directory and its contents
 */
async function copyDirectory(source: string, destination: string): Promise<void> {
	await ensureDir(destination);

	for await (const entry of Deno.readDir(source)) {
		const sourcePath = join(source, entry.name);
		const destPath = join(destination, entry.name);

		if (entry.isDirectory) {
			await copyDirectory(sourcePath, destPath);
		} else {
			await Deno.copyFile(sourcePath, destPath);
		}
	}
}
