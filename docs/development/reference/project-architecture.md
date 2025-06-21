# BB Project Architecture

## Overview

This document explains the architecture of BB's project management system, focusing on the clear separation of responsibilities between different components. The system has been redesigned to address issues with circular dependencies and responsibility conflation.

## Key Components

### Main Components

BB's project management system consists of four main components, each with a specific responsibility:

| Component | Responsibility | Storage Location |
|-----------|----------------|------------------|
| **ProjectRegistry** | Maps project IDs to filesystem paths | `~/.bb/projects.json` |
| **ConfigManager** | Manages app configuration (global and per-project overrides) | `~/.bb/config.yaml` and `~/.bb/projects/{id}/config.yaml` |
| **ProjectPersistence** | Manages a single project's data | `~/.bb/projects/{id}/project.json` |
| **ProjectPersistenceManager** | Manages all projects and serves as a factory for ProjectPersistence instances | N/A (coordinates the other components) |

### Dependencies

The dependency hierarchy is designed to prevent circular dependencies:

- **ProjectPersistenceManager** depends on ProjectRegistry and ConfigManager
- **ProjectPersistence** depends on ProjectRegistry and ConfigManager
- **ConfigManager** does not depend on either ProjectPersistenceManager or ProjectPersistence
- **ProjectRegistry** doesn't depend on any of the other components

```
                        (Other components use this as the main interface)
                                        |
                                        v
               ProjectPersistenceManager -----> ProjectPersistence 
                   /       \                         |  \
                  /         \                        |   \
                 /           \                       |    \
                v             v                       v     v
          ProjectRegistry    ConfigManager     ProjectRegistry ConfigManager
```

## App Configuration vs Project Data

### App Configuration (Managed by ConfigManager)

App configuration defines **how the application behaves** when working with projects:

- Stored in: `~/.bb/config.yaml` (global) and `~/.bb/projects/{id}/config.yaml` (project overrides)
- Global defaults are defined in `GlobalConfigDefaults`
- Project-specific overrides can be set for any app config setting
- Examples of app configuration settings:
  - API/BUI server ports and TLS settings
  - Log levels and file paths
  - UI preferences
  - LLM provider API keys
  - Tool configurations

#### Configuration Structure

```typescript
interface AppConfig {
  version: ConfigVersion;
  myPersonsName: string;
  myAssistantsName: string;
  defaultModels: DefaultModels;
  noBrowser: boolean;
  llmGuidelinesFile?: string;
  
  // Component-specific configurations
  api: ApiConfig;
  bui: BuiConfig;
  cli: CliConfig;
  dui: DuiConfig;
}

// Global configuration extends AppConfig
interface GlobalConfig extends AppConfig {
  bbExeName: string;
  bbApiExeName: string;
}

// Project-specific configuration overrides extends AppConfig with projectId
interface ProjectConfig extends AppConfig {
  projectId: string;
}
```

### Project Data (Managed by ProjectPersistence)

Project data defines **what the project is** - its intrinsic properties:

- Stored in: `~/.bb/projects/{id}/project.json`
- Contains the project structure, data sources, and metadata
- Doesn't include behavioral settings (those belong in app config)
- Examples of project data:
  - Project ID and name
  - Data sources (structure and paths)
  - Repository information

#### Project Data Structure

BB uses three distinct types for representing project data in different contexts:

```typescript
// 1. In-memory representation used by API code
// ProjectPersistence directly implements this interface
interface ProjectData {
  projectId: string;
  name: string;
  dataSources: DataSource[];        // Actual DataSource objects with methods
  primaryDataSource?: DataSource;   // The primary data source (computed)
  repoInfo: RepoInfoConfigSchema;
  // Additional intrinsic project properties
}

// 2. Serialized representation for storage
interface SerializedProjectData {
  projectId: string;
  name: string;
  dataSources: DataSourceValues[];  // Plain objects with no methods
  repoInfo: RepoInfoConfigSchema;
  // Additional serializable properties
}

// 3. Client-side representation for BUI
interface ClientProjectData {
  projectId: string;
  name: string;
  dataSources: ClientDataSource[];  // Simplified data source objects
  primaryDataSource?: ClientDataSource;
  repoInfo: RepoInfoConfigSchema;
}
```

Each type serves a specific purpose:
- `ProjectData`: Used directly by API code, with full class instances
- `SerializedProjectData`: Used for persistence to disk
- `ClientProjectData`: Used for API-to-BUI communication

## Registry vs Project Data

### Project Registry (Minimal Path Mapping)

- **Purpose**: Provide a quick and efficient way to map between project IDs and filesystem paths
- **Storage**: Simple JSON file at `~/.bb/projects.json`
- **Interface**: Only store the minimal information needed for path mapping
- **Usage**: Should not be used directly except by ProjectPersistence

#### Registry Structure

```typescript
interface ProjectsFileV1 {
  version: string;
  projects: {
    [projectId: string]: StoredProjectV1;
  };
}

interface StoredProjectV1 {
  name: string;
  dataSourcePaths?: string[]; // Array of paths for filesystem datasources
}
```

### Project Data (Complete Project Information)

- **Purpose**: Store all intrinsic properties that define what a project is
- **Storage**: JSON file at `~/.bb/projects/{id}/project.json`
- **Interface**: Rich data model with complete project structure
- **Usage**: Access through ProjectPersistence

### ProjectPersistence Implementation

`ProjectPersistence` now directly implements the `ProjectData` interface, allowing for more intuitive access to project properties:

```typescript
// ProjectPersistence implements ProjectData, providing direct property access
class ProjectPersistence implements ProjectData {
  // Core properties from ProjectData interface
  readonly projectId: string;
  get name(): string { /* implementation */ }
  get dataSources(): DataSource[] { /* implementation */ }
  get primaryDataSource(): DataSource | undefined { /* implementation */ }
  get repoInfo(): RepoInfoConfigSchema { /* implementation */ }
  
  // Methods for property manipulation
  async setName(name: string): Promise<void> { /* implementation */ }
  async setRepoInfo(repoInfo: RepoInfoConfigSchema): Promise<void> { /* implementation */ }
  
  // Format conversion methods
  getData(): ProjectData { /* for backward compatibility */ }
  toJSON(): SerializedProjectData { /* for serialization */ }
  toClientData(): ClientProjectData { /* for BUI communication */ }
  
  // Other methods...
}
```

This implementation pattern provides several benefits:

1. More intuitive API through direct property access
2. Better type checking and IDE autocompletion
3. Clear separation between in-memory, serialized, and client formats
4. Simplified route handlers with less code

## Development Guidelines

### When to Use Each Component

1. **Use ProjectPersistenceManager for:**
   - Creating new projects
   - Listing all projects
   - Finding projects by path
   - Getting ProjectPersistence instances for specific projects
   - Operations that span multiple projects

2. **Use ProjectPersistence for:**
   - Getting data for a specific project
   - Updating a specific project's structure
   - Deleting a specific project
   - Listing uploaded files for a specific project

3. **Use ConfigManager for:**
   - Getting and updating application settings
   - Accessing tool configurations
   - Managing global defaults
   - Getting project-specific app config overrides

4. **Avoid using ProjectRegistry directly:**
   - Instead, always use ProjectPersistenceManager as the interface

### Example Code

```typescript
// CORRECT: Use ProjectPersistenceManager for multi-project operations
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';

// Creating a new project
const projectPersistenceManager = await getProjectPersistenceManager();
const newProject = await projectPersistenceManager.createProject({
  name: "My Project",
  dataSources: [{ /* data source config */ }],
});

// Getting a ProjectPersistence instance for a specific project
const project = await projectPersistenceManager.getProject(projectId);
if (project) {
  // Direct property access (ProjectPersistence implements ProjectData)
  const projectName = project.name;
  const primarySource = project.primaryDataSource;
  const dataSources = project.dataSources;
  
  // Getting legacy project data (backward compatibility)
  const projectData = project.getData();
  
  // Updating project data
  await project.update({
    name: "Updated Project Name"
  });
  
  // Converting to different formats
  const serializedData = project.toJSON();         // For storage (SerializedProjectData)
  const clientData = project.toClientData();       // For BUI (ClientProjectData)
}

// Listing all projects
const allProjects = await projectPersistenceManager.listProjects();

// Finding a project by path
const foundProject = await projectPersistenceManager.findProjectByPath("/path/to/project");

// CORRECT: Use ConfigManager for application settings
const configManager = await getConfigManager();

// Getting merged config (global + project overrides)
const projectConfig = await configManager.getProjectConfig(projectId);

// Getting just the project-specific overrides
const projectOverrides = await configManager.getProjectAppConfigOverrides(projectId);

// INCORRECT: Don't use ProjectRegistry directly
// const registry = await getProjectRegistry();
// const project = await registry.getProject(projectId);
```

## Data Source Management

Each `ProjectPersistence` instance directly manages its own data sources, eliminating the need for a separate `DataSourceManager` class. This architecture change provides several benefits:

1. **Simplified Responsibility Chain**:
   - ProjectPersistence directly handles data source operations
   - No need to navigate through ProjectEditor to reach DataSourceManager
   - Clearer ownership of data source lifecycle

2. **Consistent Storage**:
   - Data sources are stored as part of project data in `project.json`
   - Registry paths and data sources stay in sync automatically

3. **Improved API**:
   - Direct access to data source methods via ProjectPersistence
   - Getters and setters for key project properties
   - Strongly typed interface for data source operations

### Using Data Sources

```typescript
// Get a project instance
const project = await projectPersistenceManager.getProject(projectId);

// Direct access to data sources via properties
const primaryDataSource = project.primaryDataSource;   // Direct property access
const allDataSources = project.dataSources;           // All data sources

// Access data sources via methods (still available)
const enabledDataSources = project.getAllEnabledDataSources();
const { dataSources, notFound } = project.resolveDataSources(['filesystem-local', 'database-prod']);

// Modify data sources
project.registerFileSystemDataSource('new-source', '/path/to/files');
project.setPrimaryDataSource('new-source');
project.updateDataSource('new-source', { enabled: true, priority: 50 });

// Persistence operations
await project.saveData();   // Save changes to disk
```

### Converting Between Formats

```typescript
// When sending to BUI
const clientData = project.toClientData();
response.body = { project: clientData };

// When storing to disk
const serializedData = project.toJSON();
const jsonString = JSON.stringify(serializedData);

// Creating from serialized data
const loadedProject = await ProjectPersistence.fromSerialized(serializedData);
```

## Instance-Per-Entity Pattern

The BB system follows an "instance-per-entity" pattern for persistence classes, which is now consistently applied across the project:

### Examples in the Codebase

1. **ProjectPersistence**:
   - Each instance manages one project
   - Created via ProjectPersistenceManager
   - Focused on operations for a specific projectId

2. **InteractionPersistence**:
   - Each instance manages one conversation
   - Similar lifecycle and responsibility pattern
   - Focused on operations for a specific collaborationId

3. **ProjectEditor**:
   - Each instance manages edits for one project
   - Created via ProjectEditorManager
   - Similar factory pattern and caching mechanism

### Benefits of This Pattern

- **Clear Responsibilities**: Each instance knows exactly what entity it's responsible for
- **Simplified Logic**: Methods don't need entity IDs as parameters since they're bound to the instance
- **Consistent Interface**: Similar patterns across different entity types
- **Memory Efficiency**: Instances can be created and disposed as needed
- **Concurrency Control**: Managers can implement locks for operations on the same entity

## Storage and Migration

During the transition to this new architecture, the system handles both old and new storage formats:

1. **Legacy Projects**:
   - Project data was stored in `config.yaml`
   - ProjectPersistence will automatically migrate to new format

2. **New Projects**:
   - App configuration in `config.yaml`
   - Project data in `project.json`

## API Route Handler Best Practices

When working with `ProjectPersistence` instances in API route handlers, follow these patterns:

```typescript
// GET endpoint example
export const getProject = async ({ params, response }) => {
  try {
    const { id: projectId } = params;
    
    // Get project as ProjectPersistence instance
    const project = await projectPersistenceManager.getProject(projectId);
    if (!project) {
      response.status = 404;
      response.body = { error: 'Project not found' };
      return;
    }
    
    // Convert to client-friendly format for API response
    const clientData = project.toClientData();
    
    // Enhance with additional information if needed
    const configManager = await getConfigManager();
    const globalConfig = await configManager.getGlobalConfig();
    const projectConfig = await configManager.loadProjectConfig(projectId);
    
    const enhancedData = {
      ...clientData,
      // Add additional properties...
    };
    
    response.status = 200;
    response.body = { project: enhancedData };
  } catch (error) {
    // Error handling...
  }
};

// Update endpoint example
export const updateProject = async ({ params, request, response }) => {
  try {
    const { id: projectId } = params;
    const body = await request.body.json();
    
    // Get project as ProjectPersistence instance
    const project = await projectPersistenceManager.getProject(projectId);
    if (!project) {
      response.status = 404;
      response.body = { error: 'Project not found' };
      return;
    }
    
    // Update properties directly
    if (body.name !== project.name) {
      await project.setName(body.name);
    }
    
    // For more complex updates
    await project.update({
      // Properties to update...
    });
    
    // Return updated client data
    const clientData = project.toClientData();
    
    response.status = 200;
    response.body = { project: clientData };
  } catch (error) {
    // Error handling...
  }
};
```

Key points to remember:

1. Always use `projectPersistenceManager.getProject()` to get instances
2. Use direct property access for reading properties (`project.name`, `project.primaryDataSource`)
3. Use setter methods for updating individual properties (`project.setName()`)
4. Use `update()` method for batch updates
5. Always convert to client format with `toClientData()` before sending in API responses
6. Make sure to properly handle cases where the project doesn't exist

## Common Pitfalls

1. **Circular Dependencies**:
   - Avoid creating dependencies from ConfigManager or ProjectRegistry to ProjectPersistenceManager/ProjectPersistence
   - Always follow the dependency hierarchy shown above

2. **Mixing Responsibilities**:
   - Don't put behavioral settings in ProjectData
   - Don't put project structure info in AppConfig
   - Don't make ProjectPersistence handle multi-project operations
   - Don't make ProjectPersistenceManager handle single-project details

3. **Direct Access**:
   - Don't access ProjectRegistry directly except from ProjectPersistenceManager/ProjectPersistence
   - Don't create ProjectPersistence instances directly; get them from ProjectPersistenceManager

4. **State Management**:
   - Be aware that ProjectPersistence instances may cache project data
   - If you modify project data outside of the normal flow, call releaseProject on ProjectPersistenceManager

5. **Data Format Confusion**:
   - Don't mix the different data formats in inappropriate contexts:
     * `ProjectData`: For direct in-memory API operations (ProjectPersistence implements this)
     * `SerializedProjectData`: For disk storage only
     * `ClientProjectData`: For API responses to BUI
   - Always convert between formats using the appropriate methods:
     * `getData()`: Returns a ProjectData snapshot (use rarely, prefer direct property access)
     * `toJSON()`: Converts to SerializedProjectData for storage
     * `toClientData()`: Converts to ClientProjectData for API responses
   - Don't manually convert between these formats - use the built-in conversion methods

6. **Property Access**:
   - Use direct property access (`project.name`, `project.primaryDataSource`) instead of getter methods where available
   - Use setter methods (`setName()`, `setRepoInfo()`) rather than directly modifying properties
   - Use `update()` for batch updates rather than multiple setter calls