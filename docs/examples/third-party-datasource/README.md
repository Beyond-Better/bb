# Third-Party DataSource Example

This example demonstrates how to create a custom third-party datasource for BB.

## Directory Structure

```
plugins/
└── myCustom.datasource/
    ├── info.json          # Metadata about the datasource
    └── provider.ts        # DataSourceProvider implementation
```

## Configuration

To enable third-party datasources, add the plugins directory to your global configuration:

```yaml
api:
  userPluginDirectories:
    - "./plugins"          # Relative to global config directory
    - "/path/to/global/plugins"  # Absolute paths also supported
```

**Note:** Third-party datasources are loaded globally and available to all projects. This makes them reusable across different projects and easier to manage.

## Example Files

### info.json

```json
{
  "name": "mycustom",
  "providerClass": "MyCustomProvider",
  "version": "1.0.0",
  "author": "Your Name",
  "license": "MIT",
  "description": "Custom datasource for my specific needs",
  "productVariants": ["opensource", "saas"],
  "enabled": true,
  "capabilities": ["read", "list", "search"],
  "requiredDependencies": ["MY_API_KEY"]
}
```

### provider.ts

```typescript
import { BBDataSourceProvider } from 'api/dataSources/base/bbDataSourceProvider.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';

export class MyCustomProvider extends BBDataSourceProvider {
  constructor() {
    super(
      'mycustom',           // Provider ID
      'My Custom Source',   // Human-readable name
      'Custom data source', // Description
      ['apiEndpoint'],      // Required config fields
      'apiKey'             // Auth method
    );
  }

  createAccessor(connection: DataSourceConnection): ResourceAccessor {
    // Implementation specific to your datasource
    return new MyCustomAccessor(connection);
  }

  validateConfig(config: Record<string, unknown>): boolean {
    // Validate your custom configuration
    return typeof config.apiEndpoint === 'string' && config.apiEndpoint !== '';
  }
}
```

## Product Variant Support

The `productVariants` field controls which BB versions can load your datasource:

- `["opensource"]` - Only open-source version
- `["saas"]` - Only SaaS version  
- `["opensource", "saas"]` - Both versions

## Loading Priority

Third-party datasources can override built-in datasources by using the same `name`. The system will:

1. Load built-in datasources first
2. Load third-party datasources from configured directories
3. Replace built-in datasources with third-party versions if they have the same name
4. Log when replacements occur

## Error Handling

If a third-party datasource fails to load:
- An error is logged with details
- Other datasources continue to load normally
- The system remains functional with available datasources