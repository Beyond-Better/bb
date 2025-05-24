# ProjectPersistence Usage Guide

## Introduction

This guide explains the different ways to use the `ProjectPersistence` class in both API and BUI contexts. The refactored design provides a clean separation between in-memory usage (API) and serialized forms (storage and BUI communication).

## Data Types Overview

### 1. ProjectPersistence (API In-Memory)
- Full class implementation with methods and properties
- Implements the `ProjectData` interface
- Used by API code directly

### 2. SerializedProjectData (Storage)
- Pure data objects with no methods
- Used for persistence to disk

### 3. ClientProjectData (BUI Communication)
- Plain objects suitable for JSON serialization
- Used for API-to-BUI communication

## API Usage Patterns

### Direct Property Access

Since `ProjectPersistence` now implements the `ProjectData` interface, API code can access properties directly:

```typescript
// Get a project instance
const projectPersistenceManager = await getProjectPersistenceManager();
const project = await projectPersistenceManager.getProject(projectId);

// Direct property access (preferred)
const projectName = project.name;
const primarySource = project.primaryDataSource;
const dataSources = project.dataSources;

// Instead of (legacy approach)
const projectData = project.getData();
const projectName = projectData.name;
```

### Managing Data Sources

Working with data sources is now more intuitive:

```typescript
// Get all data sources
const sources = project.dataSources;

// Get primary data source
const primarySource = project.primaryDataSource;

// Add a new data source
const newSource = DataSource.createFileSystem('fs-extra', '/path/to/source');
project.registerDataSource(newSource);

// Set a primary data source
project.setPrimaryDataSource('fs-extra');
```

### Updating Project Properties

```typescript
// Update project name
await project.setName('New Project Name');

// Update repository info
await project.setRepoInfo({ tokenLimit: 2048 });

// Alternatively, use the update method for multiple properties
await project.update({
  name: 'New Project Name',
  repoInfo: { tokenLimit: 2048 }
});
```

## BUI Communication

### Serializing for API Responses

To send project data to the BUI:

```typescript
// In a route handler
export const getProject = async ({ params, response }) => {
  try {
    const { id: projectId } = params;
    const project = await projectPersistenceManager.getProject(projectId);
    
    if (!project) {
      response.status = 404;
      response.body = { error: 'Project not found' };
      return;
    }

    // Convert to client-friendly format
    const clientData = project.toClientData();
    
    // Enhance with config information if needed
    const configManager = await getConfigManager();
    const globalConfig = await configManager.getGlobalConfig();
    const projectConfig = await configManager.loadProjectConfig(projectId);
    
    const enhancedProject = enhanceProjectWithSources(
      clientData, // Use client data instead of ProjectData
      projectConfig,
      globalConfig,
      project.primaryDataSource?.getDataSourceRoot() || ''
    );

    response.status = 200;
    response.body = { project: enhancedProject };
  } catch (error) {
    // Error handling
  }
};
```

### Applying BUI Changes to the Server

```typescript
// In an update route handler
export const updateProject = async ({ params, request, response }) => {
  try {
    const { id: projectId } = params;
    const body = await request.body.json();
    
    const project = await projectPersistenceManager.getProject(projectId);
    if (!project) {
      response.status = 404;
      response.body = { error: 'Project not found' };
      return;
    }

    // Update project properties
    if (body.name) {
      await project.setName(body.name);
    }
    
    // Update data sources if needed
    if (body.dataSources) {
      // More complex logic for updating data sources
      // ...
    }
    
    // Apply client updates
    await project.applyClientUpdates(body);
    
    // Return updated project in client format
    const clientData = project.toClientData();
    
    // Enhance with config info
    // ...

    response.status = 200;
    response.body = { project: enhancedClientData };
  } catch (error) {
    // Error handling
  }
};
```

## Updating Route Handlers

The current route handlers in `api/src/routes/api/project.handlers.ts` need modifications to work with the refactored `ProjectPersistence` class:

### Changes to `listProjects` Handler

```typescript
export const listProjects = async ({ response }) => {
  try {
    const rootPath = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
    const configManager = await getConfigManager();
    const globalConfig = await configManager.getGlobalConfig();
    
    // Get projects as ProjectPersistence instances
    const projectInstances = await projectPersistenceManager.listProjects();

    // Convert to client data and enhance with config
    const projects = await Promise.all(projectInstances.map(async (project) => {
      let projectConfig = {};
      try {
        projectConfig = await configManager.loadProjectConfig(project.projectId);
      } catch (_e) {
        // Handle error
      }
      
      // Get primary data source path
      const primarySource = project.primaryDataSource;
      const workingRoot = primarySource?.getDataSourceRoot() || '.';
      
      // Convert to client format before enhancing
      const clientData = project.toClientData();
      
      return enhanceProjectWithSources(
        clientData,
        projectConfig,
        globalConfig,
        toUnixPath(relative(rootPath, workingRoot))
      );
    }));

    response.status = 200;
    response.body = { projects };
  } catch (error) {
    // Error handling
  }
};
```

### Changes to `getProject` Handler

```typescript
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

    const rootPath = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
    const configManager = await getConfigManager();
    const globalConfig = await configManager.getGlobalConfig();
    const projectConfig = await configManager.loadProjectConfig(projectId);

    // Get primary data source path
    const primarySource = project.primaryDataSource;
    const primaryPath = primarySource?.getDataSourceRoot() || '';
    
    // Convert to client format before enhancing
    const clientData = project.toClientData();

    const enhancedProject = enhanceProjectWithSources(
      clientData,
      projectConfig,
      globalConfig,
      primaryPath ? toUnixPath(relative(rootPath, primaryPath)) : ''
    );

    response.status = 200;
    response.body = { project: enhancedProject };
  } catch (error) {
    // Error handling
  }
};
```

### Changes to `createProject` Handler

```typescript
export const createProject = async ({ request, response }) => {
  try {
    const body = await request.body.json();
    const { name, path, type } = body;
    const rootPath = body.rootPath || Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

    if (!name || !path || !type) {
      response.status = 400;
      response.body = { error: 'Missing required fields' };
      return;
    }

    // Create project data
    const projectData = {
      name,
      dataSources: [
        // Include data sources from path
        DataSource.createPrimaryFileSystem('primary', join(rootPath, path))
      ],
      repoInfo: { tokenLimit: 1024 }
    };

    // Create project
    const projectId = await projectPersistenceManager.createProject(projectData);
    
    // Get the created project
    const project = await projectPersistenceManager.getProject(projectId);

    // Update project config values
    // ... (existing configuration update code)
    
    // Return the client data with config info
    const clientData = project.toClientData();
    
    // ... (enhance with config)

    response.status = 200;
    response.body = { project: enhancedClientData };
  } catch (error) {
    // Error handling
  }
};
```

## Data Persistence

### Saving to Disk

```typescript
// Save project changes
await project.saveData();
```

### Loading from Disk

```typescript
// Create a new project instance
const project = new ProjectPersistence(projectId);
await project.init(); // Loads data from disk automatically
```

### Creating from Serialized Data

```typescript
// Create a project from serialized data
const serializedData = JSON.parse(await Deno.readTextFile('project.json'));
const project = await ProjectPersistence.fromSerialized(serializedData);
```

## Type Conversion Summary

| From | To | Method |
|------|------|--------|
| ProjectPersistence | ProjectData | `project.getData()` |
| ProjectPersistence | SerializedProjectData | `project.toJSON()` |
| ProjectPersistence | ClientProjectData | `project.toClientData()` |
| SerializedProjectData | ProjectPersistence | `ProjectPersistence.fromSerialized(data)` |
| ClientProjectData | ProjectPersistence | `project.applyClientUpdates(clientData)` |

## Best Practices

1. **In API Code:**
   - Use `ProjectPersistence` instances directly when possible
   - Access properties through the interface implementation: `project.name`, `project.primaryDataSource`
   - Use methods for operations: `project.setName()`, `project.update()`

2. **For API Responses:**
   - Convert to client format with `project.toClientData()`
   - Enhance with config information if needed
   - Never send the raw `ProjectPersistence` instance

3. **For Storage:**
   - Use `project.saveData()` to persist changes
   - Use `project.init()` to load data from disk

4. **For BUI Updates:**
   - Use `project.applyClientUpdates(clientData)` to apply changes from the BUI
   - Validate client data before applying updates

By following these patterns, your code will be more maintainable, type-safe, and will properly separate concerns between in-memory usage and serialization.