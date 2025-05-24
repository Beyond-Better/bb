# Data Source Architecture Implementation Plan

## Overview

This document outlines a detailed plan for implementing the new data source architecture described in the [Component Architecture](./component-architecture.md) and [Architecture Diagrams](./architecture-diagrams.md) documents. The plan is divided into phases, each focusing on a specific aspect of the system, allowing for incremental development and testing.

## Phase 1: Core Interfaces and Base Classes

### Conversation 1: Core Interfaces

**Tasks:**
1. Create interfaces for the core components:
   - `DataSourceProvider` interface
   - `DataSourceConnection` interface
   - `ResourceAccessor` interface
   - Authentication-related interfaces
2. Define type definitions for resource operations (load, list, search, etc.)
3. Create utility types for resource metadata and results

**Files to create:**
- `api/src/dataSources/interfaces/dataSourceProvider.ts`
- `api/src/dataSources/interfaces/dataSourceConnection.ts`
- `api/src/dataSources/interfaces/resourceAccessor.ts`
- `api/src/dataSources/interfaces/authentication.ts`
- `api/src/dataSources/types/resourceTypes.ts`

### Conversation 2: Abstract Base Classes

**Tasks:**
1. Implement abstract base classes:
   - `BaseDataSourceProvider` abstract class
   - `BBDataSourceProvider` abstract class
   - `MCPDataSourceProvider` abstract class
   - `BaseResourceAccessor` abstract class
   - `BBResourceAccessor` abstract class
   - `MCPResourceAccessor` abstract class
2. Implement `DataSourceConnection` concrete class (no inheritance needed)

**Files to create:**
- `api/src/dataSources/base/baseDataSourceProvider.ts`
- `api/src/dataSources/base/bbDataSourceProvider.ts`
- `api/src/dataSources/base/mcpDataSourceProvider.ts`
- `api/src/dataSources/base/baseResourceAccessor.ts`
- `api/src/dataSources/base/bbResourceAccessor.ts`
- `api/src/dataSources/base/mcpResourceAccessor.ts`
- `api/src/dataSources/dataSourceConnection.ts`

### Conversation 3: Registry and Factory

**Tasks:**
1. Implement `DataSourceRegistry` singleton class
2. Implement `DataSourceFactory` singleton class
3. Create utility functions for URI handling

**Files to create:**
- `api/src/dataSources/dataSourceRegistry.ts`
- `api/src/dataSources/dataSourceFactory.ts`
- `api/src/dataSources/utils/dataSourceUri.ts`

## Phase 2: Filesystem Implementation

### Conversation 4: Filesystem Provider and Accessor

**Tasks:**
1. Implement `FilesystemProvider` class
2. Implement `FilesystemAccessor` class
3. Create filesystem-specific utility functions

**Files to create:**
- `api/src/dataSources/filesystem/filesystemProvider.ts`
- `api/src/dataSources/filesystem/filesystemAccessor.ts`
- `api/src/dataSources/filesystem/filesystemUtils.ts`

### Conversation 5: Filesystem Operations

**Tasks:**
1. Implement resource operations for FilesystemAccessor:
   - `loadResource`
   - `listResources`
   - `searchResources`
   - `writeResource`
   - `moveResource`
   - `deleteResource`
2. Create file-based tests for the filesystem implementation

**Files to modify:**
- `api/src/dataSources/filesystem/filesystemAccessor.ts`

**Files to create:**
- `api/tests/dataSources/filesystem/filesystemAccessor.test.ts`
- `api/tests/dataSources/filesystem/fixtures/` (test files)

## Phase 3: MCP Integration

### Conversation 6: MCP Provider and Accessor

**Tasks:**
1. Implement `GenericMCPProvider` class
2. Implement `GenericMCPAccessor` class
3. Update MCPManager integration

**Files to create:**
- `api/src/dataSources/mcp/genericMCPProvider.ts`
- `api/src/dataSources/mcp/genericMCPAccessor.ts`

**Files to modify:**
- `api/src/mcp/mcpManager.ts` (add methods for resource operations)

### Conversation 7: MCP Resource Operations

**Tasks:**
1. Implement resource operations for GenericMCPAccessor:
   - `loadResource`
   - `listResources`
   - `searchResources` (if supported)
   - `writeResource` (if supported)
   - `moveResource` (if supported)
   - `deleteResource` (if supported)
2. Create MCP-specific tests

**Files to modify:**
- `api/src/dataSources/mcp/genericMCPAccessor.ts`

**Files to create:**
- `api/tests/dataSources/mcp/genericMCPAccessor.test.ts`

## Phase 4: ResourceManager Updates

### Conversation 8: ResourceManager Refactoring

**Tasks:**
1. Update `ResourceManager` to use the new architecture
2. Move existing file-specific logic to the Filesystem accessor
3. Update resource URI handling

**Files to modify:**
- `api/src/resources/resourceManager.ts`

### Conversation 9: Resource Operation Delegation

**Tasks:**
1. Implement delegation logic in ResourceManager
2. Add support for accessMethod-specific behavior
3. Update error handling

**Files to modify:**
- `api/src/resources/resourceManager.ts`
- `api/src/errors/error.ts` (add new error types)

## Phase 5: Notion Implementation

### Conversation 10: Notion Client

**Tasks:**
1. Implement Notion API client wrapper
2. Add authentication handling
3. Implement content conversion utils (notion → markdown)

**Files to create:**
- `api/src/dataSources/notion/notionClient.ts`
- `api/src/dataSources/notion/notionAuth.ts`
- `api/src/dataSources/notion/notionToMarkdown.ts`

### Conversation 11: Notion Provider and Accessor

**Tasks:**
1. Implement `NotionProvider` class
2. Implement `NotionAccessor` class
3. Create Notion-specific utility functions

**Files to create:**
- `api/src/dataSources/notion/notionProvider.ts`
- `api/src/dataSources/notion/notionAccessor.ts`
- `api/src/dataSources/notion/notionUtils.ts`

### Conversation 12: Notion Operations

**Tasks:**
1. Implement resource operations for NotionAccessor:
   - `loadResource`
   - `listResources`
   - `searchResources`
   - `writeResource`
   - `moveResource`
   - `deleteResource`
2. Create Notion-specific tests

**Files to modify:**
- `api/src/dataSources/notion/notionAccessor.ts`

**Files to create:**
- `api/tests/dataSources/notion/notionAccessor.test.ts`
- `api/tests/dataSources/notion/fixtures/` (test data)

## Phase 6: ProjectPersistence Integration

### Conversation 13: ProjectPersistence Refactoring

**Tasks:**
1. Update `ProjectPersistence` to use the new architecture
2. Modify data source handling logic
3. Update serialization/deserialization

**Files to modify:**
- `api/src/storage/projectPersistence.ts`

### Conversation 14: ProjectPersistence Operations

**Tasks:**
1. Implement data source management methods
2. Update registry integration
3. Add support for new provider types

**Files to modify:**
- `api/src/storage/projectPersistence.ts`

## Phase 7: Tool Updates

### Conversation 15: Tool Base Updates

**Tasks:**
1. Update tool base classes to work with multiple data source types
2. Create utility functions for tool operations

**Files to modify:**
- `api/src/llms/llmTool.ts`
- `api/src/llms/tools/toolUtils.ts` (create if needed)

### Conversation 16: Search and Resource Tools

**Tasks:**
1. Rename and update file-specific tools:
   - `searchProject.tool` → Support multiple data source types
   - `rewriteFile.tool` → `rewriteResource.tool`
   - `searchAndReplace.tool` → Support multiple resource types
   - `moveFiles.tool` → `moveResources.tool`
2. Update tool input schemas and documentation

**Files to modify/create:**
- `api/src/llms/tools/searchProject.tool/tool.ts`
- `api/src/llms/tools/rewriteResource.tool/tool.ts` (renamed)
- `api/src/llms/tools/searchAndReplace.tool/tool.ts`
- `api/src/llms/tools/moveResources.tool/tool.ts` (renamed)

### Conversation 17: Other Tools Updates

**Tasks:**
1. Update remaining file-specific tools to work with the new architecture
2. Update tool input schemas and documentation

**Files to modify:**
- Other tool files that need updating

## Phase 8: API and UI Updates

### Conversation 18: API Endpoints

**Tasks:**
1. Update API endpoints to work with the new architecture
2. Add Notion-specific endpoints if needed

**Files to modify:**
- `api/src/controllers/projectController.ts`
- `api/src/controllers/dataSourceController.ts` (create if needed)

### Conversation 19: Configuration UI

**Tasks:**
1. Update UI components for data source configuration
2. Add Notion-specific configuration UI

**Files to modify:**
- BUI-specific files (to be determined)

## Phase 9: Testing and Documentation

### Conversation 20: Integration Tests

**Tasks:**
1. Create integration tests for the entire data source system
2. Test interactions between components

**Files to create:**
- `api/tests/integration/dataSources/datasourceIntegration.test.ts`

### Conversation 21: Documentation

**Tasks:**
1. Update user documentation for new data source types
2. Create developer documentation for the architecture

**Files to create/modify:**
- `docs/datasources.md`
- `docs/developers/datasources.md`

## Dependencies

### External Libraries

- `@notionhq/client`: Official Notion SDK
- `@std-uritemplate/std-uritemplate`: URI template handling

### Internal Dependencies

- Update `import_map.json` to include new module paths
- Update `deno.jsonc` to include new dependencies

## Migration Strategy

The implementation plan follows a phased approach that allows for incremental development without breaking existing functionality:

1. Build new components alongside existing code
2. Update ResourceManager to use new components while maintaining compatibility
3. Gradually update tools to use the new architecture
4. Finally update ProjectPersistence to fully adopt the new structure

At each phase, ensure that existing functionality continues to work correctly while the new architecture is being integrated.

## Testing Strategy

1. **Unit Tests**: Test each component in isolation
2. **Integration Tests**: Test interactions between components
3. **End-to-End Tests**: Test the entire system with real data sources
4. **Migration Tests**: Ensure backward compatibility during migration

## Rollback Plan

In case of issues during implementation:

1. Each phase has clear boundaries, allowing rollback to previous phases
2. The architecture maintains backward compatibility, allowing selective rollback of components
3. Feature flags can be used to enable/disable new functionality in production