#!/usr/bin/env -S deno run --allow-read --allow-write

import { parse } from '@std/flags';
import { join } from '@std/path';
import { getGlobalConfigDir } from 'shared/dataDir.ts';
import InteractionPersistence from '../src/storage/interactionPersistence.ts';
import { logger } from 'shared/logger.ts';

interface ProjectRegistry {
  [key: string]: {
    name: string;
    path: string;
    type: string;
  };
}

async function getProjects(): Promise<ProjectRegistry> {
  const configDir = await getGlobalConfigDir();
  const registryPath = join(configDir, 'projects.json');
  const content = await Deno.readTextFile(registryPath);
  return JSON.parse(content);
}

async function main() {
  const flags = parse(Deno.args, {
    boolean: ['dry-run', 'force', 'help'],
    default: { 'dry-run': false, force: false, help: false },
  });

  if (flags.help) {
    console.log(`
Usage: migrate_conversations.ts [options]

Options:
  --dry-run    Show what would be migrated without making changes
  --force      Run migration even if version is current
  --help       Show this help message

Description:
  Migrates all conversations in all projects to include totalAllTokens in token usage records.
  This adds up totalTokens + cacheCreationInputTokens + cacheReadInputTokens for each record
  and updates the conversation metadata accordingly.
    `);
    Deno.exit(0);
  }

  try {
    const projects = await getProjects();
    logger.info(`Found ${Object.keys(projects).length} projects`);

    const results = {
      total: {
        projects: Object.keys(projects).length,
        conversations: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
      },
      byProject: [] as Array<{
        projectId: string;
        name: string;
        result: {
          total: number;
          migrated: number;
          skipped: number;
          failed: number;
        };
      }>,
    };

    for (const [projectId, project] of Object.entries(projects)) {
      logger.info(`Processing project: ${project.name} (${projectId})`);

      try {
        const migrationResult = await InteractionPersistence.migrateAllConversations(projectId, {
          dryRun: flags['dry-run'],
          force: flags.force,
        });

        results.total.conversations += migrationResult.total;
        results.total.migrated += migrationResult.migrated;
        results.total.skipped += migrationResult.skipped;
        results.total.failed += migrationResult.failed;

        results.byProject.push({
          projectId,
          name: project.name,
          result: {
            total: migrationResult.total,
            migrated: migrationResult.migrated,
            skipped: migrationResult.skipped,
            failed: migrationResult.failed,
          },
        });

        // Log detailed results for this project
        logger.info(`Project ${project.name} results:`, {
          total: migrationResult.total,
          migrated: migrationResult.migrated,
          skipped: migrationResult.skipped,
          failed: migrationResult.failed,
        });

        // Log any failures in detail
        const failures = migrationResult.results.filter(r => !r.result.success);
        if (failures.length > 0) {
          logger.error(`Failed migrations in ${project.name}:`, failures);
        }

      } catch (error) {
        logger.error(`Failed to process project ${project.name}:`, error);
        results.total.failed++;
      }
    }

    // Print summary
    console.log('\nMigration Summary:');
    console.log('=================');
    console.log(`Total Projects: ${results.total.projects}`);
    console.log(`Total Conversations: ${results.total.conversations}`);
    console.log(`Successfully Migrated: ${results.total.migrated}`);
    console.log(`Skipped (Already Current): ${results.total.skipped}`);
    console.log(`Failed: ${results.total.failed}`);

    if (flags['dry-run']) {
      console.log('\nThis was a dry run. No changes were made.');
    }

    // Exit with error if any migrations failed
    if (results.total.failed > 0) {
      Deno.exit(1);
    }

  } catch (error) {
    logger.error('Migration failed:', error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}