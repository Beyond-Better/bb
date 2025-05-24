# API Server Migration Plan

## Overview

Based on lessons learned from the CLI migration, this document outlines the plan for migrating the API server components to use ConfigManagerV2.

## Components to Migrate

1. Core Server
   - api/src/main.ts
   - api/src/editor/projectEditor.ts

2. LLM Integration
   - api/src/llms/llmToolManager.ts
   - api/src/llms/providers/baseLLM.ts
   - api/src/llms/providers/anthropicLLM.ts
   - api/src/llms/providers/openAILLM.ts

3. API Routes
   - api/src/routes/api/doctor.handlers.ts
   - api/src/routes/api/logEntryFormatter.handlers.ts
   - api/src/routes/api/project.handlers.ts
   - api/src/routes/api/status.handlers.ts
   - api/src/routes/api/upgrade.handlers.ts

## Migration Patterns

1. Property Access Updates
```typescript
// Update TLS properties
config.api.tlsCertFile → config.api.tls.certFile
config.api.tlsKeyFile → config.api.tls.keyFile
config.api.tlsRootCaFile → config.api.tls.rootCaFile

// Update server properties
config.api.apiHostname → config.api.hostname
config.api.apiPort → config.api.port
config.api.apiUseTls → config.api.tls.useTls

// Update LLM keys
config.api.anthropicApiKey → config.api.llmKeys.anthropic
config.api.openaiApiKey → config.api.llmKeys.openai
config.api.voyageaiApiKey → config.api.llmKeys.voyageai
```

2. Method Updates
```typescript
// Configuration updates
await configManager.setGlobalConfigValue() → await configManager.updateGlobalConfig()
await configManager.setProjectConfigValue() → await configManager.updateProjectConfig()

// Config retrieval
await ConfigManager.fullConfig() → await configManager.getGlobalConfig()
await ConfigManager.projectConfig() → await configManager.getProjectConfig()
```

3. Instance Creation
```typescript
// Add import
import { getConfigManager } from 'shared/config/configManager.ts';

// Update instance creation
const configManager = await getConfigManager();
```

## Migration Steps

1. Core Server Components
   - Update main.ts first as it sets up the configuration for other components
   - Update projectEditor.ts as it's a key dependency for many other components
   - Test server startup and basic operations

2. LLM Integration
   - Update base LLM class first
   - Update provider implementations
   - Test each provider's functionality
   - Verify prompt caching and token usage

3. API Routes
   - Update route handlers
   - Test each endpoint's functionality
   - Verify error handling

## Testing Strategy

1. Component Tests
   - Run existing tests after each component update
   - Add new tests for v2 config patterns
   - Verify error cases

2. Integration Tests
   - Test API endpoints with new config
   - Verify LLM interactions
   - Check project operations

3. System Tests
   - Start server with new config
   - Run through key workflows
   - Verify logging and monitoring

## Rollback Plan

1. Keep backup of each modified file
2. Test each component in isolation
3. Have git revert commands ready
4. Document any data migration needed

## Success Criteria

1. All API components using ConfigManagerV2
2. All tests passing
3. No v1 config patterns remaining
4. Error handling verified
5. Performance metrics unchanged or improved