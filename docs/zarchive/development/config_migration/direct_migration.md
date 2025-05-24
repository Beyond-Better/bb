# Direct Migration Guide

This guide provides step-by-step instructions for migrating individual files to use ConfigManagerV2, based on lessons learned from the CLI migration.

## Step 1: Update Imports

```typescript
// Remove old import
import { ConfigManager } from 'shared/configManager.ts';

// Add new import
import { getConfigManager } from 'shared/config/configManager.ts';

// Add types if needed
import type { ProjectType } from 'shared/config/types.ts';
```

## Step 2: Update Instance Creation

```typescript
// Old pattern
const configManager = await ConfigManager.getInstance();

// New pattern
const configManager = await getConfigManager();

// For static methods
// Old
const config = await ConfigManager.fullConfig(startDir);

// New
const configManager = await getConfigManager();
const config = await configManager.getGlobalConfig();
```

## Step 3: Update Property Access

1. Server Properties
```typescript
// Old
config.api.apiHostname
config.api.apiPort
config.api.apiUseTls

// New
config.api.hostname
config.api.port
config.api.tls.useTls
```

2. TLS Properties
```typescript
// Old
config.api.tlsCertFile
config.api.tlsKeyFile
config.api.tlsRootCaFile

// New
config.api.tls.certFile
config.api.tls.keyFile
config.api.tls.rootCaFile
```

3. LLM Properties
```typescript
// Old
config.api.anthropicApiKey
config.api.openaiApiKey
config.api.voyageaiApiKey

// New
config.api.llmKeys.anthropic
config.api.llmKeys.openai
config.api.llmKeys.voyageai
```

## Step 4: Update Method Calls

1. Configuration Updates
```typescript
// Old
await configManager.setGlobalConfigValue('api.apiUseTls', 'true');

// New
await configManager.updateGlobalConfig({
  api: {
    ...globalConfig.api,
    tls: { ...globalConfig.api.tls, useTls: true }
  }
});
```

2. Project Configuration
```typescript
// Old
await configManager.setProjectConfigValue('key', 'value', startDir);

// New
await configManager.updateProjectConfig(startDir, {
  key: value
});
```

## Step 5: Fix Variable Scoping

1. Move Instance Creation Up
```typescript
// Bad
if (condition) {
  const configManager = await getConfigManager();
  // Use configManager
}

// Good
const configManager = await getConfigManager();
if (condition) {
  // Use configManager
}
```

2. Avoid Redeclaration
```typescript
// Bad
let config: unknown;
if (global) {
  const configManager = await getConfigManager();
  config = await configManager.getGlobalConfig();
}

// Good
const configManager = await getConfigManager();
let config: unknown;
if (global) {
  config = await configManager.getGlobalConfig();
}
```

## Step 6: Add Type Annotations

```typescript
// Add ts-ignore where needed

// Use type assertions when necessary
const config = await configManager.getGlobalConfig() as GlobalConfig;

// Import and use specific types
import type { ProjectType, GlobalConfig } from 'shared/config/types.ts';
```

## Common Issues and Solutions

1. Property Access
   - Always use optional chaining with tls object
   - Check for undefined values
   - Provide default values

2. Method Parameters
   - Update object structure for updateConfig methods
   - Include parent objects in updates
   - Preserve existing values with spread operator

3. Error Handling
   - Check for undefined configs
   - Handle missing properties
   - Provide fallback values

4. Testing
   - Update test fixtures
   - Add new test cases
   - Verify error conditions

## Verification Steps

1. Run Type Check
```bash
deno task tool:check-types-project
```

2. Run Tests
```bash
deno task tool:test
```

3. Manual Testing
   - Start server
   - Test functionality
   - Check error cases
   - Verify logging