# Configuration Code Migration Examples

This document provides concrete examples of code migration patterns discovered during the CLI migration to ConfigManagerV2.

## Basic Migration Examples

### 1. Simple Config Access

```typescript
// Before
const fullConfig = await ConfigManager.fullConfig(startDir);
const { apiHostname, apiPort, apiUseTls } = fullConfig.api;

// After
const configManager = await ConfigManagerV2.getInstance();
const globalConfig = await configManager.getGlobalConfig();
const { hostname, port } = globalConfig.api;
const useTls = globalConfig.api.tls?.useTls ?? true;
```

### 2. Config Updates

```typescript
// Before
await configManager.setGlobalConfigValue('api.apiUseTls', 'true');
await configManager.setProjectConfigValue('api.apiUseTls', 'true', startDir);

// After
await configManager.updateGlobalConfig({
  api: {
    ...globalConfig.api,
    tls: { ...globalConfig.api.tls, useTls: true }
  }
});
await configManager.updateProjectConfig(projectId, {
  api: {
    ...projectConfig.api,
    tls: { ...projectConfig.api.tls, useTls: true }
  }
});
```

## Complex Migration Examples

### 1. TLS Configuration

```typescript
// Before
const certFileName = config.api.tlsCertFile || 'localhost.pem';
const keyFileName = config.api.tlsKeyFile || 'localhost-key.pem';
const rootCert = config.api.tlsRootCaPem ||
  await readFromBbDir(startDir, config.api.tlsRootCaFile || 'rootCA.pem');

// After
const certFileName = config.api.tls?.certFile || 'localhost.pem';
const keyFileName = config.api.tls?.keyFile || 'localhost-key.pem';
const rootCert = config.api.tls?.rootCaPem ||
  await readFromBbDir(startDir, config.api.tls?.rootCaFile || 'rootCA.pem');
```

### 2. LLM Key Management

```typescript
// Before
if (!config.api?.anthropicApiKey && !projectConfig.api?.anthropicApiKey) {
  throw new Error('Anthropic API key not configured');
}

// After
if (!config.api?.llmKeys?.anthropic && !projectConfig.api?.llmKeys?.anthropic) {
  throw new Error('Anthropic API key not configured');
}
```

## Function Migration Examples

### 1. Config Initialization

```typescript
// Before
async function init(): Promise<void> {
  const fullConfig = await ConfigManager.fullConfig(startDir);
  const projectConfig = await ConfigManager.projectConfig(startDir);
  // Use configs
}

// After
async function init(): Promise<void> {
  const configManager = await ConfigManagerV2.getInstance();
  const globalConfig = await configManager.getGlobalConfig();
  const projectConfig = await configManager.getProjectConfig(projectId);
  // Use configs
}
```

### 2. Config Validation

```typescript
// Before
function validateConfig(config: unknown): boolean {
  return config?.api?.apiHostname && 
         typeof config.api.apiPort === 'number' &&
         typeof config.api.apiUseTls === 'boolean';
}

// After
function validateConfig(config: unknown): boolean {
  return config?.api?.hostname && 
         typeof config.api.port === 'number' &&
         typeof config.api.tls?.useTls === 'boolean';
}
```

## Error Handling Examples

### 1. Optional Properties

```typescript
// Before
const port = config.api?.apiPort ?? 3162;
const useTls = typeof config.api?.apiUseTls !== 'undefined' 
  ? config.api.apiUseTls 
  : true;

// After
const port = config.api?.port ?? 3162;
const useTls = typeof config.api?.tls?.useTls !== 'undefined'
  ? config.api.tls.useTls
  : true;
```

### 2. Nested Updates

```typescript
// Before
await configManager.setGlobalConfigValue('api.apiUseTls', 'false');
await configManager.setGlobalConfigValue('api.apiPort', '3162');

// After
const globalConfig = await configManager.getGlobalConfig();
await configManager.updateGlobalConfig({
  api: {
    ...globalConfig.api,
    port: 3162,
    tls: {
      ...globalConfig.api.tls,
      useTls: false
    }
  }
});
```

## Testing Examples

### 1. Config Mocks

```typescript
// Before
const mockConfig = {
  api: {
    apiHostname: 'localhost',
    apiPort: 3162,
    apiUseTls: true
  }
};

// After
const mockConfig = {
  api: {
    hostname: 'localhost',
    port: 3162,
    tls: {
      useTls: true,
      certFile: 'localhost.pem',
      keyFile: 'localhost-key.pem'
    }
  }
};
```

### 2. Test Cases

```typescript
// Before
Deno.test('config validation', async () => {
  const config = await ConfigManager.fullConfig(testDir);
  assertEquals(typeof config.api.apiPort, 'number');
  assertEquals(typeof config.api.apiUseTls, 'boolean');
});

// After
Deno.test('config validation', async () => {
  const configManager = await ConfigManagerV2.getInstance();
  const config = await configManager.getGlobalConfig();
  assertEquals(typeof config.api.port, 'number');
  assertEquals(typeof config.api.tls?.useTls, 'boolean');
});
```