# BUI Migration Plan

## Overview

This document outlines the plan for migrating the Browser User Interface (BUI) components to use ConfigManagerV2, incorporating lessons learned from both CLI and API migrations.

## Components to Migrate

1. Server Configuration
   - bui/src/fresh.config.ts

2. State Management
   - bui/src/hooks/useChatState.ts

3. UI Components
   - bui/src/islands/Chat.tsx

4. Utilities
   - bui/src/utils/websocketManager.utils.ts

## Migration Patterns

1. Property Access Updates
```typescript
// Update TLS properties
config.bui.tlsCertFile → config.bui.tls.certFile
config.bui.tlsKeyFile → config.bui.tls.keyFile
config.bui.tlsRootCaFile → config.bui.tls.rootCaFile

// Update server properties
config.bui.buiHostname → config.bui.hostname
config.bui.buiPort → config.bui.port
config.bui.buiUseTls → config.bui.tls.useTls

// Update API connection properties
config.api.apiHostname → config.api.hostname
config.api.apiPort → config.api.port
config.api.apiUseTls → config.api.tls.useTls
```

2. Method Updates
```typescript
// Configuration updates
await ConfigManager.fullConfig() → await configManager.getGlobalConfig()
await ConfigManager.projectConfig() → await configManager.getProjectConfig()

// Instance creation
const configManager = await getConfigManager();
```

3. URL Generation
```typescript
// Update URL construction
const apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}`;
```

## Migration Steps

1. Server Configuration (fresh.config.ts)
   - Update ConfigManagerV2 import
   - Update property access patterns
   - Test server startup
   - Verify TLS configuration

2. State Management (useChatState.ts)
   - Update config access in hooks
   - Update WebSocket URL generation
   - Test state management
   - Verify error handling

3. UI Components (Chat.tsx)
   - Update config property access
   - Update URL parameter handling
   - Test UI interactions
   - Verify error states

4. Utilities (websocketManager.utils.ts)
   - Update WebSocket configuration
   - Update URL generation
   - Test connection handling
   - Verify reconnection logic

## Testing Strategy

1. Component Tests
   - Test each component in isolation
   - Verify config property access
   - Check error handling
   - Test URL generation

2. Integration Tests
   - Test WebSocket connections
   - Verify API communication
   - Check state management
   - Test TLS handling

3. UI Tests
   - Test chat functionality
   - Verify config display
   - Check error messages
   - Test reconnection UI

## Rollback Plan

1. Keep backup of each modified file
2. Test each component before deployment
3. Have git revert commands ready
4. Document any state management changes

## Success Criteria

1. All BUI components using ConfigManagerV2
2. All tests passing
3. No v1 config patterns remaining
4. WebSocket connections working
5. UI displaying correct config
6. Error handling working properly
7. Performance metrics unchanged or improved

## Dependencies

1. API Server Migration
   - API endpoints using v2 config
   - WebSocket handlers updated
   - Error responses standardized

2. CLI Integration
   - URL parameter generation
   - Config validation
   - Error handling