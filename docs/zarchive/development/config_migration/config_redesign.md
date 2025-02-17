# Configuration System Redesign

## Design Patterns Emerged from CLI Migration

### 1. Instance Management

The singleton pattern with explicit instance creation has proven effective:
```typescript
// Single source of truth
const configManager = await ConfigManagerV2.getInstance();

// Avoid multiple instances
// Bad: Creating multiple instances
const config1 = await ConfigManagerV2.getInstance();
const config2 = await ConfigManagerV2.getInstance();

// Good: Share single instance
const configManager = await ConfigManagerV2.getInstance();
const globalConfig = await configManager.getGlobalConfig();
const projectConfig = await configManager.getProjectConfig(projectId);
```

### 2. Property Organization

Grouping related properties under namespaced objects:
```typescript
// Before: Flat structure with prefixes
api: {
  apiHostname: string;
  apiPort: number;
  apiUseTls: boolean;
  tlsCertFile: string;
  tlsKeyFile: string;
}

// After: Nested structure with clear domains
api: {
  hostname: string;
  port: number;
  tls: {
    useTls: boolean;
    certFile: string;
    keyFile: string;
  }
  llmKeys: {
    anthropic: string;
    openai: string;
    voyageai: string;
  }
}
```

### 3. Update Patterns

Atomic updates that preserve existing values:
```typescript
// Before: Individual property updates
await setGlobalConfigValue('api.apiUseTls', 'true');
await setGlobalConfigValue('api.apiPort', '3162');

// After: Structured updates preserving state
await updateGlobalConfig({
  api: {
    ...globalConfig.api,
    port: 3162,
    tls: {
      ...globalConfig.api.tls,
      useTls: true
    }
  }
});
```

### 4. Error Handling

Consistent error handling with optional chaining:
```typescript
// Before: Multiple undefined checks
const useTls = config.api && config.api.apiUseTls !== undefined 
  ? config.api.apiUseTls 
  : true;

// After: Optional chaining with defaults
const useTls = config.api?.tls?.useTls ?? true;
```

## Architectural Decisions

### 1. Configuration Hierarchy

```typescript
interface GlobalConfig {
  version: string;
  api: ApiConfig;
  bui: BuiConfig;
  cli: CliConfig;
  dui: DuiConfig;
}

interface ProjectConfig {
  projectId: string;
  version: string;
  name: string;
  type: ProjectType;
  settings?: {
    api?: Partial<ApiConfig>;
    bui?: Partial<BuiConfig>;
    cli?: Partial<CliConfig>;
    dui?: Partial<DuiConfig>;
  }
}
```

### 2. Component Isolation

Each component (API, BUI, CLI, DUI) has its own configuration namespace:
```typescript
interface ApiConfig {
  hostname: string;
  port: number;
  tls: TlsConfig;
  llmKeys: LlmKeysConfig;
}

interface BuiConfig {
  hostname: string;
  port: number;
  tls: TlsConfig;
}
```

### 3. Type Safety

Strong typing with optional properties where appropriate:
```typescript
interface TlsConfig {
  useTls: boolean;
  certFile?: string;
  keyFile?: string;
  rootCaFile?: string;
  certPem?: string;
  keyPem?: string;
  rootCaPem?: string;
}
```

### 4. Migration Support

Temporary type assertions to handle transition:
```typescript
const config = await configManager.getGlobalConfig();
```

## Implementation Guidelines

### 1. Instance Creation
- Create ConfigManagerV2 instance at component initialization
- Pass instance to dependent components
- Avoid creating multiple instances

### 2. Property Access
- Use optional chaining for nested properties
- Provide default values for optional properties
- Use type assertions where necessary

### 3. Updates
- Preserve existing values with spread operator
- Update entire objects rather than individual properties
- Validate updates before applying

### 4. Error Handling
- Check for undefined values
- Provide sensible defaults
- Use type guards where appropriate

## Migration Strategy

### 1. Component Order
1. Core Configuration (✓ Complete)
2. CLI Components (✓ Complete)
3. API Server (In Progress)
4. BUI Components (Planned)

### 2. Testing Approach
- Update tests with new patterns
- Add migration-specific tests
- Verify error conditions
- Test component interactions

### 3. Documentation
- Update API documentation
- Add migration guides
- Document patterns and examples
- Track progress and changes

## Future Considerations

### 1. Type Definitions
- Remove temporary type assertions
- Add comprehensive type checking
- Improve type inference

### 2. Validation
- Add runtime validation
- Implement schema validation
- Add migration validation

### 3. Performance
- Monitor instance creation
- Track update performance
- Optimize property access