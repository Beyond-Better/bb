# Configuration Migration Issues & Workarounds

This document tracks issues encountered during the CLI migration and their solutions, to help guide the remaining migrations.

## Type System Issues

### 1. Property Access Types
**Issue:** TypeScript doesn't recognize new property structure.
```typescript
// Error: Property 'hostname' does not exist on type 'ApiConfig'
const hostname = config.api.hostname;
```

**Workaround:** Use type assertions or optional chaining:
```typescript
const hostname = (config.api as any).hostname;
// or
const hostname = config.api?.hostname;
```

## Variable Scoping Issues

### 1. Redeclaration in Conditionals
**Issue:** Multiple configManager declarations in different scopes.
```typescript
if (global) {
  const configManager = await ConfigManagerV2.getInstance();
  // Use configManager
} else {
  const configManager = await ConfigManagerV2.getInstance();
  // Use configManager
}
```

**Solution:** Move declaration to parent scope:
```typescript
const configManager = await ConfigManagerV2.getInstance();
if (global) {
  // Use configManager
} else {
  // Use configManager
}
```

### 2. Async Access in Loops
**Issue:** Creating multiple instances in async loops.
```typescript
for (const item of items) {
  const configManager = await ConfigManagerV2.getInstance();
  // Use configManager
}
```

**Solution:** Move instance creation outside loop:
```typescript
const configManager = await ConfigManagerV2.getInstance();
for (const item of items) {
  // Use configManager
}
```

## Property Migration Issues

### 1. Nested Property Updates
**Issue:** Losing existing values during updates.
```typescript
// Bad: Overwrites other tls properties
await configManager.updateGlobalConfig({
  api: {
    tls: { useTls: true }
  }
});
```

**Solution:** Use spread operator to preserve values:
```typescript
await configManager.updateGlobalConfig({
  api: {
    ...globalConfig.api,
    tls: {
      ...globalConfig.api.tls,
      useTls: true
    }
  }
});
```

### 2. Default Values
**Issue:** Undefined values when accessing new structure.
```typescript
// Can throw if tls object doesn't exist
const useTls = config.api.tls.useTls;
```

**Solution:** Use optional chaining and defaults:
```typescript
const useTls = config.api?.tls?.useTls ?? true;
```

## Method Migration Issues

### 1. Parameter Structure
**Issue:** Method parameter changes breaking existing code.
```typescript
// Old: Single value update
await setGlobalConfigValue('key', 'value');

// New: Requires object structure
await updateGlobalConfig({ key: value });
```

**Solution:** Create helper functions if needed:
```typescript
function setConfigValue(key: string, value: unknown) {
  return configManager.updateGlobalConfig({
    [key]: value
  });
}
```

### 2. Project Config Updates
**Issue:** Project config updates requiring full path.
```typescript
// Error: Project path required
await configManager.updateProjectConfig({ key: value });
```

**Solution:** Always provide project ID:
```typescript
await configManager.updateProjectConfig(projectId, { key: value });
```

## Testing Issues

### 1. Mock Data Structure
**Issue:** Test mocks using old structure.
```typescript
const mockConfig = {
  api: {
    apiHostname: 'localhost'  // Old structure
  }
};
```

**Solution:** Update mock data:
```typescript
const mockConfig = {
  api: {
    hostname: 'localhost',    // New structure
    tls: {
      useTls: true
    }
  }
};
```

### 2. Assertion Updates
**Issue:** Test assertions checking old properties.
```typescript
assertEquals(config.api.apiHostname, 'localhost');
```

**Solution:** Update assertions:
```typescript
assertEquals(config.api.hostname, 'localhost');
assertEquals(config.api.tls?.useTls, true);
```

## Documentation Issues

### 1. Type Documentation
**Issue:** Incomplete or outdated type documentation.

**Solution:** Add detailed type documentation:
```typescript
/**
 * Server configuration with TLS support
 * @property hostname - Server hostname (e.g., 'localhost')
 * @property port - Server port number
 * @property tls - TLS configuration object
 */
interface ServerConfig {
  hostname: string;
  port: number;
  tls: TlsConfig;
}
```

### 2. Migration Examples
**Issue:** Lack of clear migration examples.

**Solution:** Add before/after examples in documentation:
```typescript
// Before migration:
const config = await ConfigManager.fullConfig(startDir);
const { apiHostname } = config.api;

// After migration:
const configManager = await ConfigManagerV2.getInstance();
const config = await configManager.getGlobalConfig();
const { hostname } = config.api;
```