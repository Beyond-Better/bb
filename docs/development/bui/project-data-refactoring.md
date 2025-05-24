# BUI Refactoring Guide: Project Data Architecture

## Background: API Changes

We've refactored the `ProjectPersistence` class and related types to address several issues:

1. **Redundant Data Storage**: Previously, `ProjectPersistence` maintained both `_projectData` and `dataSourcesMap`, causing synchronization issues
2. **Unclear Type Structure**: The distinction between project configuration and project data was blurred
3. **Inconsistent Access Patterns**: Some properties required method calls while others were direct access
4. **Data Representation Issues**: No clear separation between in-memory, storage, and client formats

### Key API Changes

#### 1. Separated Concerns with Distinct Types

We now have three clear data representations, each with a specific purpose:

```typescript
// 1. In-memory representation used by API code
interface ProjectData {
  projectId: string;
  name: string;
  dataSources: DataSource[];        // Actual DataSource objects with methods
  primaryDataSource?: DataSource;   // The primary data source (computed)
  repoInfo: RepoInfoConfigSchema;
}

// 2. Serialized representation for storage
interface SerializedProjectData {
  projectId: string;
  name: string;
  dataSources: DataSourceValues[];  // Plain objects with no methods
  repoInfo: RepoInfoConfigSchema;
}

// 3. Client-side representation for BUI
interface ClientProjectData {
  projectId: string;
  name: string;
  dataSources: ClientDataSource[];  // Simplified data source objects
  primaryDataSource?: ClientDataSource;
  repoInfo: RepoInfoConfigSchema;
}

// Client-side data source representation
interface ClientDataSource {
  id: string;
  type: string;                    // "filesystem", "database", etc.
  accessMethod: string;
  name: string;
  enabled: boolean;
  isPrimary: boolean;
  priority: number;
  capabilities: string[];
  config: Record<string, unknown>; // Type-specific configuration
}
```

#### 2. ProjectPersistence Implements ProjectData

The `ProjectPersistence` class now directly implements `ProjectData`, allowing for intuitive property access:

```typescript
// Direct property access (preferred)
const projectName = project.name;
const primarySource = project.primaryDataSource;
const dataSources = project.dataSources;

// Instead of method calls (now deprecated)
// const primarySource = project.getPrimaryDataSource();
```

#### 3. Clear Type Conversion Methods

```typescript
// For API internal use (prefer direct property access)
const projectData = project.getData();

// For storage (SerializedProjectData)
const serializedData = project.toJSON();

// For BUI communication (ClientProjectData)
const clientData = project.toClientData();
```

#### 4. Combined Config and Data Type

We've added a new interface to represent the combination of project data and config:

```typescript
// Combined interface with both data and config
interface ProjectWithConfig {
  data: ProjectData;           // What the project IS
  config: ProjectConfig;       // How the project BEHAVES
}

// Serialized version for API-to-BUI communication
interface SerializedProjectWithConfig {
  data: ClientProjectData;    // Client-friendly data
  config: ProjectConfig;      // Project configuration
}
```

## BUI Refactoring Requirements

### Current Issues

The current BUI code has several issues that need to be addressed:

1. **Type Mismatches**: BUI expects properties like `primaryDataSourceRoot` directly on `ProjectConfigV2`
2. **Missing Version Properties**: The `toProject` function returns objects missing required `version` properties
3. **Confusion Between Data and Config**: No clear separation between what belongs in config vs. data

### Required Changes

#### 1. Update Project Types in BUI

Create or update types to match the new API structure:

```typescript
// In bui/src/types/project.types.ts

// Client-side data source (from API)
export interface ClientDataSource {
  id: string;
  type: string;
  accessMethod: string;
  name: string;
  enabled: boolean;
  isPrimary: boolean;
  priority: number;
  capabilities: string[];
  config: Record<string, unknown>;
}

// Client-side project data
export interface ClientProjectData {
  projectId: string;
  name: string;
  dataSources: ClientDataSource[];
  primaryDataSource?: ClientDataSource;
  repoInfo: RepoInfoConfigSchema;
}

// Combined type for BUI use
export interface ProjectWithConfigAndData {
  // Project configuration (how it behaves)
  config: ProjectConfig;
  
  // Project data (what it is)
  data: ClientProjectData;
  
  // For backward compatibility (view layer transition)
  // DEPRECATED: Use data.x or config.x properties directly instead
  projectId: string;
  name: string;
  primaryDataSourceRoot?: string; // Computed from data.primaryDataSource
  stats?: ProjectStats;           // If available
}
```

#### 2. Create Adapter Layer

Create an adapter layer to bridge the gap between old and new structures during transition:

```typescript
// In bui/src/utils/project.adapter.ts

/**
 * Creates a backward-compatible project object from the new API response
 * @deprecated Use direct properties from data/config when possible
 */
export function adaptApiProjectResponse(apiResponse: any): ProjectWithConfigAndData {
  const { data, config } = apiResponse.project;
  
  // Extract path from primary data source if available
  const primarySource = data.primaryDataSource;
  const primaryPath = primarySource?.config?.dataSourceRoot as string || '';
  
  // Create a unified object with both direct and nested properties
  return {
    // Original objects
    data,
    config,
    
    // Compatibility properties
    projectId: data.projectId,
    name: data.name,
    primaryDataSourceRoot: primaryPath,
    // Add stats if available
    stats: (data as any).stats, 
  };
}
```

#### 3. Update API Client Layer

Update API client functions to handle the new response format:

```typescript
// In bui/src/services/api.ts

import { adaptApiProjectResponse } from '../utils/project.adapter';

export async function fetchProjects() {
  const response = await fetch('/api/v1/projects');
  const data = await response.json();
  
  // Transform API response to BUI-friendly format
  return data.projects.map(adaptApiProjectResponse);
}

export async function fetchProject(projectId: string) {
  const response = await fetch(`/api/v1/projects/${projectId}`);
  const data = await response.json();
  
  // Transform API response to BUI-friendly format
  return adaptApiProjectResponse(data);
}

export async function createProject(projectData: any) {
  // Format outgoing data for API
  const response = await fetch('/api/v1/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData),
  });
  
  const data = await response.json();
  return adaptApiProjectResponse(data);
}
```

#### 4. Update Project State Management

Update project state hooks to work with the new structure:

```typescript
// In bui/src/hooks/useProjectState.ts

export function useProjectState() {
  const projectState = useSignal<{
    isLoading: boolean;
    projects: ProjectWithConfigAndData[];
    selectedProject: ProjectWithConfigAndData | null;
    error: Error | null;
  }>({ 
    isLoading: false, 
    projects: [], 
    selectedProject: null, 
    error: null 
  });
  
  // Load projects
  const loadProjects = async () => {
    projectState.value = { ...projectState.value, isLoading: true };
    try {
      // Use updated API client
      const projects = await fetchProjects();
      projectState.value = { 
        ...projectState.value, 
        projects,
        isLoading: false 
      };
    } catch (error) {
      projectState.value = { 
        ...projectState.value, 
        error: error as Error,
        isLoading: false 
      };
    }
  };
  
  // ... other methods
  
  return { projectState, loadProjects, /* ... */ };
}
```

#### 5. Update Components

Gradually update components to work with the new structure:

```tsx
// In ProjectList.tsx

function ProjectList({ projects }) {
  return (
    <ul>
      {projects.map(project => (
        <li key={project.projectId}>
          <h3>{project.name}</h3>
          
          {/* Use adapter properties during transition */}
          <p className="text-xs truncate" title={project.primaryDataSourceRoot}>
            {project.primaryDataSourceRoot}
          </p>
          
          {/* Gradually migrate to direct data properties */}
          {project.data.primaryDataSource && (
            <p className="text-sm">
              Primary: {project.data.primaryDataSource.name}
            </p>
          )}
          
          {/* Stats (if available) */}
          {project.stats && (
            <div className="stats-container">
              <p>{project.stats.conversationCount} conversations</p>
              {/* ... */}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

## Global Config vs Project Config

The relationship between global configuration and project-specific overrides remains the same:

```typescript
// This interface structure hasn't changed
export interface ConfigValue<T> {
  global: T;          // Global default value
  project: T | null;  // Project override (null means use global)
}

// Example of config property structure
interface ProjectWithSources {
  // ... other properties
  myPersonsName: ConfigValue<string | undefined>;
  myAssistantsName: ConfigValue<string | undefined>;
  api: {
    maxTurns: ConfigValue<number | undefined>;
    // ... other API settings
  };
}
```

When displaying config values in the UI, you should check if a project override exists:

```tsx
function ConfigDisplay({ config }) {
  // Helper function to get effective value
  const getEffectiveValue = (configValue) => {
    return configValue.project !== null ? configValue.project : configValue.global;
  };
  
  return (
    <div>
      <p>Person's Name: {getEffectiveValue(config.myPersonsName)}</p>
      <p>Assistant's Name: {getEffectiveValue(config.myAssistantsName)}</p>
      <p>Max Turns: {getEffectiveValue(config.api.maxTurns)}</p>
      
      {/* Show override indicators */}
      {config.myPersonsName.project !== null && (
        <span className="override-indicator">Customized</span>
      )}
    </div>
  );
}
```

## Working with Data Sources

### Accessing Project Data Sources

```tsx
function DataSourcesList({ project }) {
  // Get all data sources from project data
  const dataSources = project.data.dataSources;
  
  // Primary data source is available directly
  const primarySource = project.data.primaryDataSource;
  
  return (
    <div>
      <h3>Data Sources</h3>
      
      {/* Show primary source first */}
      {primarySource && (
        <div className="primary-source">
          <h4>{primarySource.name} (Primary)</h4>
          <p>Type: {primarySource.type}</p>
          <p>Path: {primarySource.config.dataSourceRoot}</p>
        </div>
      )}
      
      {/* List all data sources */}
      <ul>
        {dataSources.map(source => (
          <li key={source.id} className={source.enabled ? 'enabled' : 'disabled'}>
            <h5>{source.name}</h5>
            <p>Type: {source.type}</p>
            {source.type === 'filesystem' && (
              <p>Path: {source.config.dataSourceRoot}</p>
            )}
            <p>Capabilities: {source.capabilities.join(', ')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Editing Data Sources

```tsx
function EditProjectForm({ project, onSave }) {
  // For initial form state, extract from project
  const [formState, setFormState] = useState({
    name: project.data.name,
    primarySourcePath: project.data.primaryDataSource?.config.dataSourceRoot || '',
    // Other form fields...
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prepare data for API
    const updatedProject = {
      name: formState.name,
      path: formState.primarySourcePath,
      type: 'local', // Or get from form
      // Other fields...
    };
    
    await onSave(updatedProject);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Project Name</label>
        <input 
          value={formState.name} 
          onChange={e => setFormState({...formState, name: e.target.value})}
        />
      </div>
      
      <div>
        <label>Project Path</label>
        <input 
          value={formState.primarySourcePath} 
          onChange={e => setFormState({...formState, primarySourcePath: e.target.value})}
        />
      </div>
      
      {/* Other form fields */}
      
      <button type="submit">Save Changes</button>
    </form>
  );
}
```

## Migration Strategy

1. **Introduce new types** without removing old ones
2. **Add adapter functions** to convert between old and new formats
3. **Update API client layer** to use the new structure
4. **Gradually update components** to use the new properties
5. **Add deprecated comments** to old usage patterns
6. **Clean up legacy code** once everything is migrated

## Recommended Migration Order

1. **Types**: First update all type definitions (minimal risk)
2. **API Layer**: Update API client to adapt response data
3. **State Management**: Update hooks that manage project state
4. **Common Utils**: Add helper functions for working with the new structure
5. **Components**: Gradually update UI components (largest task)

