# Storage Migration System

## Overview

The BB storage migration system manages the evolution of data structures and file formats across the entire persistence stack. It provides a unified, versioned approach to migrating projects, collaborations, interactions, and resources from older formats to newer ones.

## Current Architecture

### Unified Storage Version

The storage system uses **Version 4** as the current unified version across all storage-related data files:

- **Projects**: Project metadata and structure
- **Collaborations**: Collaboration metadata and configuration  
- **Interactions**: Individual interaction data and metadata
- **Resources**: File revisions and resource metadata

> **Note**: The config system maintains separate versioning (currently v2) and is not part of storage migrations.

### Storage Migration Manager

All migrations are handled by the `StorageMigration` class in `api/src/storage/storageMigration.ts`:

```typescript
export class StorageMigration {
  // Main entry point - called once at API startup
  static async migrateAllProjectsAtStartup(): Promise<void>
  
  // Per-project migration - designed for future per-project import feature
  static async migrateProjectStorage(projectId: ProjectId): Promise<void>
  
  // Project-level migration operations
  static async migrateProjectInteractions(projectDataDir: string): Promise<void>
  static async migrateInteractionThroughVersions(interactionDir: string): Promise<void>
  
  // Version-specific migrations
  static async migrateV1toV2(interactionDir: string): Promise<void>
  static async migrateV2toV3(interactionDir: string): Promise<void>
  static async migrateV3toV4(interactionDir: string): Promise<void>
}
```

## Migration Timeline and Process

### When Migrations Run

**Primary Migration**: At API startup via `StorageMigration.migrateAllProjectsAtStartup()`
- Runs once when the API server starts
- Migrates all projects found in the registry
- Continues startup even if individual project migrations fail

**Future Enhancement**: Per-project migrations for imported projects
- Designed but not yet implemented
- Will allow migrating individual projects on-demand

### Migration State Tracking

Each project maintains a migration state file at `{projectAdminDataDir}/.storage-migration-state`:

```json
{
  "version": 4,
  "lastMigrated": "2025-06-21T09:30:00.000Z", 
  "migratedCount": 42
}
```

## Version History and Changes

### Version 1 → Version 2
**Purpose**: Basic versioning introduction
- Added version metadata to interaction files
- Minimal structural changes

### Version 2 → Version 3  
**Purpose**: Token usage enhancements
- Added `totalAllTokens` calculation to token usage records
- Enhanced token usage analysis with cache metrics
- Updated interaction metadata with comprehensive token statistics

**Key Changes**:
- Token usage records now include `totalAllTokens` field
- Interaction metadata includes detailed `tokenUsageStats`
- Backward compatibility maintained for existing records

### Version 3 → Version 4
**Purpose**: Conversation → Collaboration migration
- **Major structural change**: Split conversations into collaborations and interactions
- **File relocations**: Move conversation logs to collaboration level
- **Naming updates**: Reflect new collaboration-centric terminology

**Key Changes**:
- `conversations/` directory → `collaborations/` directory structure
- Each collaboration contains `interactions/` subdirectory
- `conversation.log` → `collaboration.log` (moved to collaboration directory)
- `conversation.jsonl` → `collaboration.jsonl` (moved to collaboration directory)
- `conversations.json` → `collaborations.json` with new schema
- All JSON files versioned as `"4.0"`

## File Structure Evolution

### Before Migration (≤ Version 3)
```
project/
├── conversations.json
└── conversations/
    ├── {conversationId}/
    │   ├── metadata.json
    │   ├── messages.jsonl
    │   ├── conversation.log
    │   ├── conversation.jsonl
    │   └── resource_revisions/
    └── ...
```

### After Migration (Version 4)
```
project/
├── collaborations.json
├── collaborations/
│   ├── {collaborationId}/
│   │   ├── metadata.json
│   │   ├── collaboration.log          # Moved from interaction level
│   │   ├── collaboration.jsonl        # Moved from interaction level  
│   │   └── interactions/
│   │       ├── interactions.json
│   │       └── {interactionId}/
│   │           ├── metadata.json
│   │           ├── messages.jsonl
│   │           └── resource_revisions/
│   └── ...
└── cleanup/                           # Backup of migrated files
    ├── conversations_backup/
    └── conversations_backup.json
```

## JSON Schema Changes

### Collaborations File (Version 4)
```json
{
  "version": "4.0",
  "collaborations": [
    {
      "id": "collaboration-id",
      "version": 4,
      "title": "Collaboration Title",
      "type": "project",
      "collaborationParams": {
        "rolesModelConfig": {
          "orchestrator": null,
          "agent": null, 
          "chat": null
        }
      },
      "totalInteractions": 1,
      "interactionIds": ["interaction-id"],
      "lastInteractionId": "interaction-id",
      "lastInteractionMetadata": { ... }
    }
  ]
}
```

### Interactions File (Version 4)
```json
{
  "version": "4.0", 
  "interactions": [
    {
      "id": "interaction-id",
      "version": 4,
      "llmProviderName": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "tokenUsageStats": {
        "tokenUsageInteraction": {
          "inputTokens": 1000,
          "outputTokens": 500,
          "totalTokens": 1500,
          "thoughtTokens": 100,
          "totalAllTokens": 1600
        }
      }
    }
  ]
}
```

## Developer Guide

### Adding New Migrations

1. **Update Version Constant**:
   ```typescript
   export const CURRENT_STORAGE_VERSION = 5; // Increment
   ```

2. **Create Migration Method**:
   ```typescript
   private static async migrateV4toV5(interactionDir: string): Promise<EntityMigrationResult> {
     // Implementation
   }
   ```

3. **Update Version Switch**:
   ```typescript
   case 4: {
     return [await StorageMigration.migrateV4toV5(interactionDir)];
   }
   ```

4. **Test Migration**:
   - Create test cases in `api/tests/storage/conversationMigration.test.ts`
   - Test both forward migration and idempotency
   - Verify backward compatibility

### Migration Best Practices

**Incremental Migrations**: Always migrate through intermediate versions
```typescript
// ✅ Good: Step-by-step migration
case 1: {
  const v2 = await migrateV1toV2(dir);
  const v3 = await migrateV2toV3(dir); 
  const v4 = await migrateV3toV4(dir);
  return [v2, v3, v4];
}

// ❌ Bad: Skip versions
case 1: {
  return [await migrateV1toV4(dir)]; // Don't skip versions
}
```

**Idempotent Operations**: Migrations should be safe to run multiple times
```typescript
if (metadata.version === targetVersion) {
  result.version.from = targetVersion;
  return result; // Already migrated
}
```

**Error Handling**: Continue processing even if individual migrations fail
```typescript
try {
  await migrateEntity(entityId);
  result.migrated++;
} catch (error) {
  result.failed++;
  logger.error(`Migration failed for ${entityId}: ${error.message}`);
  // Continue with other entities
}
```

**Backup Strategy**: Move old files to cleanup directory instead of deleting
```typescript
const cleanupDir = join(projectAdminDataDir, 'cleanup');
await Deno.rename(oldPath, join(cleanupDir, 'backup_file'));
```

### Testing Migrations

Create comprehensive test cases covering:

1. **Forward Migration**: Version N → Version N+1
2. **Idempotency**: Running migration twice produces same result  
3. **Data Integrity**: All data preserved during migration
4. **Error Recovery**: Graceful handling of corrupted files
5. **File Operations**: Proper file moves, renames, and cleanup

Example test structure:
```typescript
Deno.test('StorageMigration.migrateV3toV4', async (t) => {
  await t.step('migrates conversation files to collaboration structure', async () => {
    // Setup test data
    // Run migration  
    // Verify results
  });
  
  await t.step('handles missing files gracefully', async () => {
    // Test error conditions
  });
  
  await t.step('is idempotent', async () => {
    // Run migration twice, verify same result
  });
});
```

## Troubleshooting

### Common Issues

**Migration State Conflicts**:
- **Symptom**: Migration runs every startup despite being completed
- **Solution**: Check `.storage-migration-state` file format and version number
- **Prevention**: Always update migration state atomically

**File Permission Errors**:
- **Symptom**: `Permission denied` during file operations
- **Solution**: Verify BB has write access to project directories
- **Prevention**: Use proper error handling with fallback to copy+delete operations

**Corrupted Metadata Files**:
- **Symptom**: `JSON.parse` errors during migration
- **Solution**: Check for truncated or invalid JSON in metadata files
- **Prevention**: Use atomic file writes and validate JSON before parsing

**Missing Dependencies**:
- **Symptom**: Migration fails due to missing project data
- **Solution**: Ensure project registry is properly initialized before migration
- **Prevention**: Verify all dependencies in startup sequence

### Recovery Procedures

**Reset Migration State**:
```bash
# Force re-migration of specific project
rm {projectAdminDataDir}/.storage-migration-state

# Or reset specific migration tracking
rm {projectAdminDataDir}/.resources-migrated
```

**Manual File Recovery**:
```bash
# Restore from cleanup directory if needed
cp -r {projectAdminDataDir}/cleanup/conversations_backup {projectAdminDataDir}/conversations
cp {projectAdminDataDir}/cleanup/conversations_backup.json {projectAdminDataDir}/conversations.json
```

**Debug Migration Issues**:
```typescript
// Enable detailed migration logging
logger.setLevel('debug');
await StorageMigration.migrateProjectStorage(projectId);
```

## Future Enhancements

### Planned Features

1. **Per-Project Import Migrations**: Support for migrating individual imported projects
2. **Cross-Storage Backend Support**: Migration support for PostgreSQL/pglite storage
3. **Parallel Migration Processing**: Concurrent migration of multiple projects
4. **Migration Rollback**: Ability to revert to previous storage versions
5. **Migration Validation**: Post-migration integrity checks and validation

### Design Considerations

**Storage Backend Abstraction**: Future migrations should work across different storage backends (JSON files, PostgreSQL, etc.)

**Performance Optimization**: Large projects may require streaming or chunked migration approaches

**Data Consistency**: Ensure ACID properties during complex multi-file migrations

**Monitoring and Metrics**: Track migration performance and success rates for operational insights