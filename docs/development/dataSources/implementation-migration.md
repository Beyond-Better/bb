# Data Source Architecture: Implementation and Migration

## Overview

This document outlines the implementation and migration strategy for the new data source architecture. The architecture separates the currently conflated responsibilities into distinct components with clear boundaries, allowing for greater modularity, extensibility, and separation of concerns.

## Architecture Summary

The new architecture consists of these core components:

1. **DataSourceProvider**: Defines capabilities and characteristics of a data source type
   - `BBDataSourceProvider` for BB-managed sources
   - `MCPDataSourceProvider` for MCP-managed sources

2. **DataSourceConnection**: Represents a specific configured instance of a data source

3. **ResourceAccessor**: Provides access to resources in a data source
   - `BBResourceAccessor` for direct implementation
   - `MCPResourceAccessor` for delegated implementation via MCPManager

4. **DataSourceRegistry**: Manages available providers and connection creation

5. **DataSourceFactory**: Creates and caches ResourceAccessor instances

## Clean Swap Migration Strategy

We've implemented a clean swap approach to transition from the legacy system to the new architecture. This approach involves:

1. **Direct Replacement**: Creating a new implementation of ResourceManager (`resourceManager.new.ts`) that replaces the legacy implementation entirely rather than a gradual migration with feature flags and dual functionality.

2. **Consistent Interface**: Maintaining the same public API in the new ResourceManager to ensure seamless integration with existing code.

3. **Internal Redirection**: Routing all resource operations through the new architecture internally while maintaining the same external interface.

4. **Comprehensive Testing**: Thorough testing of the new implementation before deployment to ensure reliability.

## Implementation Status

The following components have been implemented:

- ✅ Core interfaces and abstract classes
- ✅ BB-managed filesystem components
- ✅ MCP-managed integration components
- ✅ Registry and factory components
- ✅ ResourceManager implementation
- ✅ Test suite for the new ResourceManager

## Testing Strategy

We've implemented a comprehensive testing strategy to ensure the reliability of the new architecture:

1. **Unit Tests**: Each component has unit tests to verify its behavior in isolation.

2. **Integration Tests**: The ResourceManager tests ensure proper interaction between components.

3. **Test Coverage**: Tests cover the core functionality and edge cases for each operation:
   - Loading resources
   - Listing resources
   - Searching resources
   - Writing resources
   - Moving resources
   - Deleting resources

## Migration Steps

To migrate to the new architecture:

1. **Verify Tests Pass**: Run `deno task test:resources` to ensure all tests for the new ResourceManager pass.

2. **Rename Files**: Rename `resourceManager.new.ts` to `resourceManager.ts` to replace the legacy implementation.

3. **Update Imports**: If any paths have changed, update imports in dependent files.

4. **Run System Tests**: Run system tests to verify that the entire application works with the new implementation.

5. **Deploy**: Deploy the changes to production.

## Benefits of the New Architecture

1. **Clear Separation of Concerns**: Each component has a single responsibility.

2. **Extensibility**: Adding new data source types is much easier.

3. **Consistent Interface**: All data sources expose the same set of operations.

4. **Access Method Distinction**: Clear separation between BB-managed and MCP-managed data sources.

5. **Better Resource Management**: Explicit accessor lifecycle and proper cleanup.

## Potential Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Integration issues with existing code | High | Maintain the same public API and do thorough testing |
| Performance regression | Medium | Implement caching in DataSourceFactory |
| MCP integration complexities | Medium | Special handling for MCP resources in ResourceManager |
| Change in error reporting | Low | Maintain consistent error types and messages |

## Rollback Plan

If issues are encountered after deployment:

1. Keep the old implementation (`resourceManager.orig.ts`).

2. Revert changes by renaming the original file back to `resourceManager.ts`.

3. Restart the service to use the original implementation.

## Next Steps

1. **Implement Remaining Data Source Types**: Add support for additional BB-managed data sources such as Notion.

2. **MCP Server Discovery**: Improve MCP server registration for data sources.

3. **User Interface**: Update the UI to leverage the capabilities of the new architecture.

4. **Documentation**: Provide comprehensive documentation for adding new data source types.

## Conclusion

The clean swap approach provides a clear path to upgrading our data source architecture while minimizing risk. By maintaining the same public API while completely reimplementing the internals, we can improve the architecture without causing disruption to dependent code.