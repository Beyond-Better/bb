# Data Source Component Architecture

## Overview

This document outlines the proposed architecture for BB's data source system, separating the currently conflated responsibilities into distinct components with clear boundaries. The goal is to create a modular, extensible system that can support multiple data source types (filesystem, Notion, etc.) while maintaining a consistent interface for the rest of the application.

## Top-Level Access Method Distinction

A fundamental architectural boundary exists between two categories of data sources:

1. **BB-managed data sources** (`accessMethod: 'bb'`):
   - Directly controlled by BB's internal code
   - Full access to all operations and capabilities
   - Examples: filesystem, internal Notion integration
   - BB has complete control over implementation

2. **MCP-managed data sources** (`accessMethod: 'mcp'`):
   - Delegated to external Model Context Protocol servers
   - Limited to capabilities defined by the MCP server
   - Examples: Supabase, external services
   - Operations must be proxied through MCPManager

This distinction is a top-level concern that affects all components in the architecture. Each component must be aware of whether it's dealing with a BB-managed or MCP-managed data source, as this fundamentally changes how operations are performed and what capabilities are available.

## Current Issues

The current implementation in `projectPersistence.ts` and related files mixes several concerns:

1. **Type Definition and Instance Configuration**: The `DataSource` class serves both as a type definition and as a container for specific instance configurations.

2. **Registry and Operations**: Data source type registration is mixed with operational capabilities.

3. **Connection and Access**: Configuration for connecting to a data source is combined with methods for accessing resources.

4. **Project Management and Data Source Management**: The `ProjectPersistence` class handles both project metadata and data source configurations.

5. **Access Method Handling**: The 'bb' vs 'mcp' distinction is not consistently enforced across the architecture.

## Core Components

### 1. DataSourceProvider

**Purpose**: Define the capabilities and characteristics of a type of data source.

**Responsibilities**:
- Define the type of data source (filesystem, Notion, etc.)
- Declare the access method ('bb' or 'mcp')
- Declare supported capabilities (read, write, search, etc.)
- Specify configuration requirements
- Provide factory methods for creating ResourceAccessors

**Structure**:
```typescript
interface DataSourceProvider {
  readonly id: string; // Unique identifier (e.g., 'filesystem', 'notion')
  readonly accessMethod: 'bb' | 'mcp'; // Fundamental distinction
  readonly name: string; // Human-readable name
  readonly description: string; // Descriptive text
  readonly capabilities: string[]; // Supported operations
  readonly requiredConfigFields: string[]; // Required configuration fields
  readonly authType: DataSourceAuthMethod;

  // Factory method to create ResourceAccessor instances
  createAccessor(connection: DataSourceConnection): ResourceAccessor;
  
  // Validate connection configuration
  validateConfig(config: Record<string, unknown>): boolean;
  validateAuth(auth: DataSourceAuth): boolean;
}
```

**Implementation**:
- **Abstract classes**: 
  - `BaseDataSourceProvider` with common functionality
  - `BBDataSourceProvider` for BB-managed sources 
  - `MCPDataSourceProvider` for MCP-managed sources
- **Concrete classes**: One per data source type (e.g., `FilesystemProvider`, `NotionProvider`)

### 2. DataSourceConnection

**Purpose**: Represent a specific configured instance of a data source.

**Responsibilities**:
- Store connection details (paths, credentials, etc.)
- Associate with a specific DataSourceProvider
- Track connection state (enabled, primary, etc.)
- Handle serialization for persistence

**Structure**:
```typescript
interface DataSourceConnection {
  readonly id: string; // Unique identifier
  readonly providerType: string; // Reference to DataSourceProvider
  readonly accessMethod: 'bb' | 'mcp'; // Inherited from provider
  name: string; // Human-readable name
  config: Record<string, unknown>; // Provider-specific configuration
  auth?: AuthConfig; // Authentication details
  enabled: boolean; // Whether this connection is active
  isPrimary: boolean; // Whether this is the primary data source
  priority: number; // Priority for ordering

  // Serialization methods
  toJSON(): DataSourceConnectionValues;
  getForSystemPrompt(): DataSourceConnectionSystemPrompt;
}
```

**Implementation**:
- **Single class**: `DataSourceConnection` with generic config object
- No subclasses needed, as provider-specific details are stored in the config object
- Authentication is handled by a separate AuthConfig interface
- Access method is determined by the associated provider

### 3. DataSourceRegistry

**Purpose**: Manage available data source providers and create connections.

**Responsibilities**:
- Register and discover DataSourceProviders
- Create new DataSourceConnections
- Look up providers by ID
- Initialize provider implementations
- Maintain separate registries for BB and MCP providers

**Structure**:
```typescript
class DataSourceRegistry {
  // Register a provider
  registerProvider(provider: DataSourceProvider): void;
  
  // Get provider by ID
  getProvider(providerType: string, accessMethod?: 'bb' | 'mcp'): DataSourceProvider | undefined;
  
  // Get all registered providers
  getAllProviders(): DataSourceProvider[];
  
  // Get providers by access method
  getProvidersByAccessMethod(accessMethod: 'bb' | 'mcp'): DataSourceProvider[];
  
  // Get providers by capability
  getProvidersByCapability(capability: string): DataSourceProvider[];
  
  // Create a new connection for a provider
  createConnection(providerType: string, name: string, config: Record<string, unknown>): DataSourceConnection;
  
  // Register MCP servers as providers
  registerMCPServers(): Promise<void>;
}
```

**Implementation**:
- Singleton class with provider registration
- Separate internal maps for BB and MCP providers
- No subclasses needed

### 4. ResourceAccessor

**Purpose**: Provide access to resources within a data source.

**Responsibilities**:
- Load resources from the data source
- List available resources
- Search for resources based on criteria
- Modify resources (if supported by the provider)
- Handle provider-specific resource formats and operations
- Route operations appropriately based on access method

**Structure**:
```typescript
interface ResourceAccessor {
  // Core connection reference
  readonly connection: DataSourceConnection;
  readonly accessMethod: 'bb' | 'mcp'; // Inherited from connection
  
  // Core operations (required for all data sources)
  loadResource(resourceUri: string, options?: ResourceLoadOptions): Promise<ResourceLoadResult>;
  listResources(options?: ResourceListOptions): Promise<ResourceListResult>;
  
  // Optional operations (implemented based on provider capabilities)
  searchResources?(query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;
  writeResource?(resourceUri: string, content: string | Uint8Array, options?: ResourceWriteOptions): Promise<ResourceWriteResult>;
  moveResource?(sourceUri: string, destinationUri: string, options?: ResourceMoveOptions): Promise<ResourceMoveResult>;
  deleteResource?(resourceUri: string, options?: ResourceDeleteOptions): Promise<ResourceDeleteResult>;
  
  // Capability check
  hasCapability(capability: string): boolean;
}
```

**Implementation**:
- **Abstract classes**: 
  - `BaseResourceAccessor` with common functionality
  - `BBResourceAccessor` for BB-managed sources
  - `MCPResourceAccessor` for MCP-managed sources
- **Concrete classes**: One per data source type (e.g., `FilesystemAccessor`, `NotionAccessor`)
- Provider-specific implementations handle the unique aspects of each data source

### 5. DataSourceFactory

**Purpose**: Create and initialize appropriate ResourceAccessor implementations.

**Responsibilities**:
- Create ResourceAccessor instances for DataSourceConnections
- Cache accessor instances for reuse
- Handle initialization and cleanup
- Route to appropriate implementation based on access method

**Structure**:
```typescript
class DataSourceFactory {
  // Get an accessor for a connection (creates or returns cached instance)
  getAccessor(connection: DataSourceConnection): ResourceAccessor;
  
  // Get appropriate BB-managed accessor
  private getBBAccessor(connection: DataSourceConnection): ResourceAccessor;
  
  // Get appropriate MCP-managed accessor
  private getMCPAccessor(connection: DataSourceConnection): ResourceAccessor;
  
  // Clear cache (useful for testing)
  clearCache(): void;
}
```

**Implementation**:
- Singleton class with accessor caching
- Separate cache maps for BB and MCP accessors
- No subclasses needed

## Authentication Model

Authentication is a cross-cutting concern that affects multiple components:

```typescript
type AuthMethod = 'none' | 'apiKey' | 'oauth2' | 'basic' | 'bearer' | 'custom';

interface AuthConfig {
  method: AuthMethod;
  apiKey?: string;
  credentials?: Record<string, unknown>;
  tokenData?: {
    expiresAt: number;
    refreshToken?: string;
    scope?: string;
  };
}
```

- **DataSourceProvider**: Defines authentication requirements
- **DataSourceConnection**: Stores authentication details
- **ResourceAccessor**: Uses authentication when accessing resources

Authentication handling differs between BB and MCP data sources:

1. **BB-managed sources**:
   - Auth credentials are stored directly in the DataSourceConnection
   - Accessors use credentials directly for operations
   - BB handles token refresh and credential management

2. **MCP-managed sources**:
   - Auth credentials may be proxied through MCP server
   - Authentication is delegated to MCPManager
   - Auth state is managed by the MCP server

## Component Interactions

### Initialization Flow

1. **Startup**:
   - DataSourceRegistry initializes
   - Built-in BB providers are registered (Filesystem, Notion, etc.)
   - MCP servers are discovered and registered as providers

2. **Project Loading**:
   - ProjectPersistence loads project data
   - DataSourceConnections are deserialized from project data
   - DataSourceFactory creates appropriate ResourceAccessors based on access method

### Resource Access Flow

1. **Request Resource**:
   - Application code requests a resource via ResourceManager
   - ResourceManager gets the appropriate ResourceAccessor from DataSourceFactory
   - ResourceAccessor handles the request based on access method:
     - For BB sources: Direct implementation
     - For MCP sources: Delegate to MCPManager
   - Resource is returned to the application

### Configuration Flow

1. **Add Data Source**:
   - User selects a DataSourceProvider type
   - UI collects required configuration based on provider
   - New DataSourceConnection is created and stored
   - DataSourceFactory creates a ResourceAccessor for the new connection

## ProjectPersistence Refactoring

The current `ProjectPersistence` class should be refactored to:

1. **Delegate data source management** to the new components
2. **Use DataSourceConnections** for serialization
3. **Use ResourceAccessors** for resource operations
4. **Focus on project-level concerns** rather than data source details
5. **Clearly separate BB and MCP data sources** in its internal handling

## Implementation Details

### Access Method Hierarchy

The class hierarchy reflects the access method distinction:

```
DataSourceProvider (interface)
├── BBDataSourceProvider (abstract)
│   ├── FilesystemProvider
│   ├── NotionProvider
│   └── ... (other BB providers)
└── MCPDataSourceProvider (abstract)
    └── GenericMCPProvider

ResourceAccessor (interface)
├── BBResourceAccessor (abstract)
│   ├── FilesystemAccessor
│   ├── NotionAccessor
│   └── ... (other BB accessors)
└── MCPResourceAccessor (abstract)
    └── GenericMCPAccessor
```

### Subclassing Requirements

1. **DataSourceProvider**: Requires subclasses for each type
   - BB-managed: `FilesystemProvider`, `NotionProvider`, etc.
   - MCP-managed: `GenericMCPProvider` with specific server IDs

2. **DataSourceConnection**: Single class with generic config
   - No subclasses needed
   - Provider-specific details in config object
   - Validation handled by the associated provider

3. **DataSourceRegistry**: Single class, no subclasses

4. **ResourceAccessor**: Requires subclasses for each type
   - BB-managed: `FilesystemAccessor`, `NotionAccessor`, etc.
   - MCP-managed: `GenericMCPAccessor` with delegation to MCPManager

5. **DataSourceFactory**: Single class, no subclasses

### Migration Strategy

1. **Create new components** without modifying existing code
2. **Update ResourceManager** to use the new components
3. **Update ProjectPersistence** to delegate to new components
4. **Update tools** to work with the new architecture
5. **Update UI** to work with the new components

## Configuration Examples

### BB-managed Notion Data Source

```typescript
// Provider registration
const notionProvider = new NotionProvider(); // accessMethod: 'bb'
dataSourceRegistry.registerProvider(notionProvider);

// Connection creation
const notionConnection = dataSourceRegistry.createConnection('notion', 'My Notion Workspace', {
  workspaceId: '123456789',
});

// Authentication configuration
notionConnection.auth = {
  method: 'apiKey',
  apiKey: 'secret_XXXXXXX',
};

// Accessor creation
const notionAccessor = dataSourceFactory.getAccessor(notionConnection);

// Resource access - direct implementation
const page = await notionAccessor.loadResource('notion://page/abc123');
```

### MCP-managed Supabase Data Source

```typescript
// Provider registration - happens automatically via registerMCPServers()
// MCP server 'supabase-prod' becomes a provider with accessMethod: 'mcp'

// Connection creation
const supabaseConnection = dataSourceRegistry.createConnection('supabase-prod', 'Production DB', {
  projectId: '123456789',
});

// Authentication configuration
supabaseConnection.auth = {
  method: 'apiKey',
  apiKey: 'sb_XXXXXXX',
};

// Accessor creation
const supabaseAccessor = dataSourceFactory.getAccessor(supabaseConnection);

// Resource access - delegates to MCPManager
const data = await supabaseAccessor.loadResource('supabase://public?query=SELECT%20*%20FROM%20users');
```

## Benefits of New Architecture

1. **Clear Separation of Concerns**:
   - Types vs. instances
   - Configuration vs. operations
   - Registry vs. access
   - BB-managed vs. MCP-managed

2. **Consistent Interface**:
   - Uniform access pattern across all data source types
   - Capability-based feature detection
   - Access method distinction handled internally

3. **Extensibility**:
   - Easy to add new data source types
   - Simple to add new operations to existing types
   - Clear path for adding new MCP servers

4. **Improved Testing**:
   - Components can be tested in isolation
   - Mock implementations are simpler to create
   - Clear boundaries for mocking MCP interactions

5. **Better Resource Management**:
   - Explicit accessor lifecycle
   - Proper cleanup of resources
   - Clearer error handling based on access method

## Implementation Plan

1. Create base interfaces and abstract classes, with clear BB/MCP distinction
2. Implement filesystem components (provider, accessor)
3. Implement MCP adapter components
4. Update ResourceManager to use new components
5. Implement Notion components (provider, accessor)
6. Update ProjectPersistence to use new components
7. Update tools to work with new architecture

This modular approach allows for incremental implementation and testing while maintaining backward compatibility throughout the transition period.