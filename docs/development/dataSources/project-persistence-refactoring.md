# ProjectPersistence Refactoring

## Overview

This document outlines the refactoring of the `ProjectPersistence` class to use the new data source architecture. The refactoring maintains the same public interface while internally using the new components, allowing for a smooth transition with minimal disruption to existing code.

## Goals

1. **Leverage New Architecture**: Use the new data source components (providers, connections, accessors) internally
2. **Maintain API Compatibility**: Keep the same public interface to avoid breaking dependent code
3. **Bridge Legacy and New Systems**: Support both legacy DataSource objects and new DataSourceConnection objects
4. **Improve Modularity**: Separate concerns more clearly within the implementation
5. **Enable New Features**: Provide foundation for supporting additional data source types

## Key Changes

### Internal Structure

1. **Dual Storage**:
   - Maintains `dataSourcesMap` for legacy DataSource objects
   - Adds `connectionMap` for new DataSourceConnection objects
   - Keeps both maps in sync

2. **Component Integration**:
   - Uses DataSourceRegistry for provider management
   - Uses DataSourceFactory for accessor creation
   - Creates connections from legacy data sources when possible

3. **Method Updates**:
   - `registerDataSource()` now handles both DataSource and DataSourceConnection objects
   - `registerFileSystemDataSource()` uses providers to create connections
   - Data source operations update both legacy and new objects when applicable

## Migration Path

### Phase 1: Side-by-Side Implementation

The refactored implementation (`projectPersistence.new.ts`) will exist alongside the original implementation (`projectPersistence.ts`). This allows for thorough testing before switching.

### Phase 2: Rename and Replace

Once testing confirms the refactored implementation works correctly, the files will be renamed:
1. `projectPersistence.ts` → `projectPersistence.orig.ts` (backup)
2. `projectPersistence.new.ts` → `projectPersistence.ts` (active)

This approach allows for easy rollback if issues are discovered after deployment.

### Phase 3: Dependency Updates

After renaming, any imports that directly reference the class (rather than the default export) will need to be updated:

```typescript
// Before
import { ProjectPersistence } from 'api/storage/projectPersistence.ts';

// After
import { ProjectPersistenceNew as ProjectPersistence } from 'api/storage/projectPersistence.ts';
```

However, code using the default export won't need changes:

```typescript
// No change needed
import ProjectPersistence from 'api/storage/projectPersistence.ts';
```

## Using the Refactored Implementation

### Working with Data Sources

The refactored implementation maintains the same API for working with data sources:

```typescript
// Create a project persistence instance
const projectPersistence = new ProjectPersistence(projectId);
await projectPersistence.init();

// Register a filesystem data source
const fsDataSourceId = await projectPersistence.registerFileSystemDataSource(
  'My Filesystem',
  '/path/to/directory'
);

// Get a data source
const dataSource = projectPersistence.getDataSource(fsDataSourceId);

// Update a data source
await projectPersistence.updateDataSource(fsDataSourceId, {
  name: 'Updated Name',
  priority: 50
});

// Remove a data source
await projectPersistence.removeDataSource(fsDataSourceId);
```

### Creating Data Sources from Providers

To take advantage of the new architecture, you can register data sources using providers:

```typescript
// Get the data source registry
const registry = await getDataSourceRegistry();

// Create a connection using a provider
const connection = registry.createConnection(
  'notion',  // Provider ID
  'My Notion Workspace',
  { workspaceId: 'workspace-123' },
  {
    auth: {
      method: 'apiKey',
      apiKey: 'secret_key'
    }
  }
);

// Register the connection with project persistence
await projectPersistence.registerDataSource(connection);
```

## New Capabilities

The refactored implementation enables several new capabilities:

1. **Provider-Based Creation**: Data sources can be created using providers, ensuring proper configuration
2. **Enhanced Type Safety**: Better typing for data source operations
3. **Support for New Data Source Types**: Easily add support for new types like Notion
4. **Accessor Integration**: Direct integration with ResourceAccessors for resource operations

## Testing

A comprehensive test suite has been created for the refactored implementation:

```bash
deno test api/tests/storage/projectPersistence.new.test.ts
```

The tests verify all core functionality:
- Initialization and basic properties
- Data source registration (filesystem, primary)
- Data source operations (update, remove, enable/disable)
- Primary data source management
- Data source resolution
- Project resource handling

## Potential Issues

1. **Performance**: The refactored implementation maintains two sets of objects (legacy and new), which could impact performance. This is a temporary situation until a full migration to the new architecture is complete.

2. **Memory Usage**: Due to the dual storage approach, memory usage may be slightly higher.

3. **Edge Cases**: There might be edge cases where the behavior differs slightly between the old and new implementations. Thorough testing should catch most of these.

## Future Directions

1. **Full Migration**: Eventually remove support for legacy DataSource objects
2. **Enhanced Data Source Management**: Improve the UI for managing different data source types
3. **Resource Operations**: Add more resource operations directly to ProjectPersistence
4. **Configuration UI**: Create specialized configuration UI for different data source types

## Conclusion

The ProjectPersistence refactoring is a critical step in the evolution of the data source architecture. By maintaining backward compatibility while introducing new capabilities, it provides a smooth transition path to the more modular, extensible system.