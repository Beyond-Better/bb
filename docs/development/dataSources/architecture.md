# Data Source Architecture

## Overview

This document outlines the architecture for BB's data source system, which enables the application to work with multiple types of data sources beyond the filesystem. The design focuses on modularity, extensibility, and consistent interfaces across different data source types.

## Key Components

### 1. Data Source Interface

We define a formal interface (`IDataSource`) that all data source implementations must follow. This ensures consistency across different data source types and simplifies integration with the rest of the application.

```typescript
// api/src/dataSources/dataSource.interface.ts
import type { DataSource } from 'api/resources/dataSource.ts';
import type { ResourceMetadata, LoadDatasourceResult } from 'shared/types/dataSourceResource.ts';
import type { FileLoadOptions } from 'api/utils/fileHandling.ts';

export interface IDataSource {
  // Core properties
  dataSource: DataSource;
  
  // Core methods (required for all data sources)
  loadResource(resourceUri: string, options?: FileLoadOptions): 
    Promise<{content: string | Uint8Array; metadata: ResourceMetadata; truncated?: boolean}>;
  
  listResources(options?: {
    path?: string;
    depth?: number;
    pageSize?: number;
    pageToken?: string;
  }): Promise<LoadDatasourceResult>;
  
  // Optional methods (implemented based on capabilities)
  searchResources?(query: string, options?: any): Promise<any>;
  writeResource?(resourceUri: string, content: string | Uint8Array, options?: any): Promise<any>;
  renameResource?(sourceUri: string, destUri: string, options?: any): Promise<any>;
  moveResource?(sourceUri: string, destUri: string, options?: any): Promise<any>;
  deleteResource?(resourceUri: string, options?: any): Promise<any>;
}
```

### 2. Base Data Source Class

An abstract base class (`BaseDataSource`) provides common functionality and default implementations for optional methods. It also handles capability checking and error generation.

```typescript
// api/src/dataSources/baseDataSource.ts
import { DataSource } from 'api/resources/dataSource.ts';
import { IDataSource } from './dataSource.interface.ts';
import type { ResourceMetadata, LoadDatasourceResult } from 'shared/types/dataSourceResource.ts';
import type { FileLoadOptions } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';

export abstract class BaseDataSource implements IDataSource {
  dataSource: DataSource;
  
  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }
  
  abstract loadResource(resourceUri: string, options?: FileLoadOptions): 
    Promise<{content: string | Uint8Array; metadata: ResourceMetadata; truncated?: boolean}>;
    
  abstract listResources(options?: {
    path?: string;
    depth?: number;
    pageSize?: number;
    pageToken?: string;
  }): Promise<LoadDatasourceResult>;
  
  // Methods that match capabilities
  hasCapability(capability: string): boolean {
    return this.dataSource.capabilities.includes(capability);
  }
  
  // Method stubs with error handling for optional methods
  searchResources(_query: string, _options?: any): Promise<any> {
    if (!this.hasCapability('search')) {
      throw createError(ErrorType.DataSourceHandling, 
        `Data source ${this.dataSource.name} does not support search capability`, 
        { name: 'search-resources', dataSourceIds: [this.dataSource.id] });
    }
    throw new Error('Method not implemented');
  }
  
  // Additional method stubs for other capabilities...
}
```

### 3. Data Source Implementations

Specific implementations for each data source type:

#### Filesystem Data Source

Moves existing filesystem-specific code from ResourceManager into a dedicated class.

```typescript
// api/src/dataSources/filesystem/filesystemDataSource.ts
import { BaseDataSource } from '../baseDataSource.ts';
// (Implementation details)
```

#### Notion Data Source

Integrates with Notion API to provide access to Notion pages, databases, and blocks.

```typescript
// api/src/dataSources/notion/notionDataSource.ts
import { BaseDataSource } from '../baseDataSource.ts';
import { NotionClient } from './notionClient.ts';
// (Implementation details)
```

### 4. Data Source Factory

A factory class responsible for creating and caching data source implementations.

```typescript
// api/src/dataSources/dataSourceFactory.ts
import { DataSource } from 'api/resources/dataSource.ts';
import { IDataSource } from './dataSource.interface.ts';
// (Implementation details)
```

### 5. ResourceManager Refactoring

Updates to ResourceManager to delegate operations to the appropriate data source implementation.

## Authentication

We'll leverage the existing `DataSourceAuth` structure in `dataSource.ts` to handle authentication across different data source types:

```typescript
// From existing dataSource.ts
export type DataSourceAuthMethod =
  | 'none'     // No authentication required
  | 'apiKey'   // Simple API key
  | 'oauth2'   // OAuth 2.0 
  | 'basic'    // Basic auth (username/password)
  | 'bearer'   // Bearer token
  | 'custom';  // Custom auth method

export interface DataSourceAuth {
  method: DataSourceAuthMethod;
  apiKey?: string; // For apiKey auth (simple implementation)
  credentialRefs?: string[];
  // Future fields for other auth methods
}
```

## Content Handling

- **Text Resources**: Return as string content
- **Binary Resources**: Return as Uint8Array content
- **Notion Pages and Blocks**: Convert to Markdown as the standard format
- **Notion Databases**: Return as JSON for structured data

## URI Format

Consistent URI format across data sources:

- **Filesystem**: `file:./{path}`
- **Notion**: `notion://{resourceType}/{resourceId}`
  - Example: `notion://page/123456789`
  - Example: `notion://database/123456789`
  - Example: `notion://block/123456789`

## Pagination

Standardize pagination across all data sources:

```typescript
export interface PaginationInfo {
  nextPageToken?: string;
  totalCount?: number;
  pageSize?: number;
  currentPage?: number;
}
```

## Error Handling

We'll extend the existing error types to include data source specific errors, leveraging the existing error system.

## Implementation Plan

### Phase 1: Core Structure

1. Create the base interface and abstract class
2. Implement the DataSourceFactory
3. Extract Filesystem implementation from current ResourceManager code

### Phase 2: Notion Implementation

1. Create Notion client wrapper
2. Implement NotionDataSource class
3. Create Notion to Markdown converter
4. Add necessary error types

### Phase 3: ResourceManager Refactoring

1. Update ResourceManager to use DataSourceFactory
2. Ensure backward compatibility
3. Add tests for the new architecture

### Phase 4: Tool Updates

1. Refactor file-specific tools to work with any resource:
   - `rewrite_file` → `rewrite_resource`
   - `search_project` → `search_resources`
   - `move_files` → `move_resources`
   - etc.

2. Update tool implementations to delegate to the proper data source

## Testing Strategy

1. Unit tests for each data source implementation
2. Integration tests for ResourceManager with multiple data sources
3. End-to-end tests for the entire workflow

## Dependencies

- Notion SDK: `@notionhq/client`
- Standard URI Template: `@std-uritemplate/std-uritemplate`