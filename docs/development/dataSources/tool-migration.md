# Data Source Terminology Migration Guide

## Terminology Decisions

| Context | Term to Use | Notes |
|---------|-------------|-------|
| **LLM Tool Parameters** | `dataSourceId` | For input parameters in tool schemas |
| **LLM Responses** | `data source` | Natural language references to a data source |
| **Method Parameters** | `dataSourceIds` | When accepting IDs that could be names/types/IDs |
| **Internal Variables** | `dsConnection` | When working with connection objects |
| **Internal Methods** | `getDsConnectionsById` | Renamed from `getDataSources` |
| **Provider Type** | `providerType` | The type of provider (filesystem, notion) |
| **BB Response (Internal)** | `dsConnectionId`, `dsConnectionName`, `providerType` | For formatters and UI |
| **Unique Identifiers** | `id` | Random/unique strings like `ds-${random-alphanum}` |

## Terminology By Context

### For LLM Tool Input Schemas
```typescript
{
  dataSourceId: {
    type: 'string',
    description: "Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
  }
}
```

### For Internal Method Parameters
```typescript
getDsConnectionsById(projectEditor: ProjectEditor, dataSourceIds?: string[]) {
  // Implementation
}
```

### For Internal Variables
```typescript
const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
const dsAccessor = dataSourceFactory.getAccessor(dsConnectionToUse);
```

### For BB Response (Formatters/UI)
```typescript
const bbResponse = {
  data: {
    resourcesAdded: resourcesSuccess.map((f) => f.name),
    resourcesError: resourcesError.map((f) => f.name),
    dsConnectionId: dsConnectionToUse.id,
    dsConnectionName: dsConnectionToUse.name,
    dsProviderType: dsConnectionToUse.providerType,
  },
};
```

### For LLM Response Messages
```typescript
const dataSourceStatus = `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.providerType}]`;
```

## Search and Replace Patterns

### LLM Tool Parameters

```
// Find
dataSource: {
  type: 'string',
  description: "Data source name to operate on. Defaults to the primary data source if omitted. Examples: 'filesystem-local', 'database-prod'."
}

// Replace
dataSourceId: {
  type: 'string',
  description: "Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase')."
}
```

### Input Destructuring

```
// Find
const { dataSource = undefined } = toolInput as LLMToolSomeInput;

// Replace
const { dataSourceId = undefined } = toolInput as LLMToolSomeInput;
```

### Method Calls

```
// Find
const { primaryDataSource, dataSources, notFound } = this.getDataSources(
  projectEditor,
  dataSource ? [dataSource] : undefined,
);

// Replace
const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
  projectEditor,
  dataSourceId ? [dataSourceId] : undefined,
);
```

### Variable Usage

```
// Find
const dataSourceToUse = dataSources[0] || primaryDataSource;

// Replace
const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
```

### BB Response Properties

```
// Find
const bbResponse = {
  data: {
    // ...other properties
    dataSourceName: dataSourceToUse.name,
    dataSourceType: dataSourceToUse.type,
    dataSourceId: dataSourceToUse.id,
  },
};

// Replace
const bbResponse = {
  data: {
    // ...other properties
    dsConnectionName: dsConnectionToUse.name,
    dsProviderType: dsConnectionToUse.providerType,
    dsConnectionId: dsConnectionToUse.id,
  },
};
```

### Tool Response Messages

```
// Find
const dataSourceStatus = `Data source: ${dataSourceToUse.name} [${dataSourceToUse.type}]`;

// Replace
const dataSourceStatus = `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.providerType}]`;
```

## Complete Example: Before and After

### Before:
```typescript
export default class LLMToolExample extends LLMTool {
  get inputSchema(): LLMToolInputSchema {
    return {
      properties: {
        dataSource: {
          type: 'string',
          description: "Data source name to operate on. Defaults to the primary data source if omitted. Examples: 'filesystem-local', 'database-prod'.",
        },
        // Other properties...
      },
    };
  }

  async runTool(interaction, toolUse, projectEditor) {
    const { dataSource = undefined } = toolInput as LLMToolExampleInput;
    
    const { primaryDataSource, dataSources, notFound } = this.getDataSources(
      projectEditor,
      dataSource ? [dataSource] : undefined,
    );
    
    const dataSourceToUse = dataSources[0] || primaryDataSource;
    
    // Tool implementation...
    
    const bbResponse = {
      data: {
        dataSourceName: dataSourceToUse.name,
        dataSourceType: dataSourceToUse.type,
        dataSourceId: dataSourceToUse.id,
      },
    };
    
    const dataSourceStatus = `Data source: ${dataSourceToUse.name} [${dataSourceToUse.type}]`;
    
    return { toolResults, toolResponse, bbResponse };
  }
}
```

### After:
```typescript
export default class LLMToolExample extends LLMTool {
  get inputSchema(): LLMToolInputSchema {
    return {
      properties: {
        dataSourceId: {
          type: 'string',
          description: "Data source ID to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
        },
        // Other properties...
      },
    };
  }

  async runTool(interaction, toolUse, projectEditor) {
    const { dataSourceId = undefined } = toolInput as LLMToolExampleInput;
    
    const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
      projectEditor,
      dataSourceId ? [dataSourceId] : undefined,
    );
    
    const dsConnectionToUse = dsConnections[0] || primaryDsConnection;
    
    // Tool implementation...
    
    const bbResponse = {
      data: {
        dsConnectionId: dsConnectionToUse.id,
        dsConnectionName: dsConnectionToUse.name,
        dsProviderType: dsConnectionToUse.providerType,
      },
    };
    
    const dataSourceStatus = `Data source: ${dsConnectionToUse.name} [${dsConnectionToUse.providerType}]`;
    
    return { toolResults, toolResponse, bbResponse };
  }
}
```

## Quick Reference Checklist

When updating tools, ensure:

1. ✅ Tool input schema uses `dataSourceId` parameter 
2. ✅ Input destructuring uses `dataSourceId` variable
3. ✅ Method calls reference `getDsConnectionsById` instead of `getDataSources`
4. ✅ Variables use `dsConnection` naming (e.g., `dsConnectionToUse`, `primaryDsConnection`)
5. ✅ BB response uses internal terminology (`dsConnectionId`, `dsConnectionName`, `providerType`)
6. ✅ LLM responses use user-friendly "data source" terminology
7. ✅ Type references use `providerType` not `type` or `id` for provider types

Refer back to this guide whenever you're unsure about terminology choices during the migration.