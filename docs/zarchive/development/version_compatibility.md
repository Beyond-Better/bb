# Version Compatibility Implementation

This document outlines the implementation plan for version compatibility features across BB's API, CLI, and BUI components.

## Overview

BB consists of multiple components that need to maintain version compatibility:
- API server (bb-api)
- CLI tool (bb)
- Browser UI (BUI)
- Future Desktop UI (DUI)

The version compatibility system ensures that all components work together correctly and provides upgrade mechanisms when needed.

## Installation and Upgrade Considerations

### Installation Locations

BB supports two installation locations with different security and upgrade implications:

1. System-wide Installation (/usr/local/bin):
   - Traditional installation requiring sudo
   - Already in system PATH
   - Requires privileged access for updates
   - Cannot support automatic upgrades via API
   - Legacy default location

2. User-local Installation (~/.bb/bin):
   - New recommended installation location
   - No privileged access required
   - Supports automatic upgrades
   - Requires PATH configuration
   - Default for DUI-based installations

### Hybrid Approach

To support both new and existing users, BB implements a hybrid approach:

1. New Installations:
   - Offer both installation options during setup
   - Default to ~/.bb/bin for DUI installations
   - Allow explicit choice for CLI installations
   - Provide PATH setup assistance

2. Existing Installations:
   - Detect installation location
   - Adapt upgrade behavior accordingly
   - Provide migration path
   - Preserve user settings

3. Upgrade Behavior:
   - System-wide: Require manual sudo upgrade
   - User-local: Support automatic upgrades
   - Clear user messaging about requirements
   - Safe fallback mechanisms

### Migration Support

The `bb migrate` command will assist users in transitioning:
```typescript
interface MigrationOptions {
  targetLocation: 'user' | 'system';
  updatePath: boolean;
  removeOldInstall: boolean;
}
```

Migration process:
1. Backup current installation
2. Install in new location
3. Update shell PATH if requested
4. Remove old installation if confirmed
5. Preserve all settings and data

## Components

### 1. Version Management

#### Central Version Source
- Single source of truth: `version.ts` in project root
- Used by all components during build/packaging
- Format: semantic versioning (major.minor.patch)

#### Version Exposure
- API: Include version in collaborationReady response
- BUI: Display version in:
  - Help dialog "Version Information" section
  - Small muted text in top-right corner
- CLI: Show version in:
  - `bb --version` output
  - `bb upgrade` information

### 2. Self-Update Function

Location: `src/shared/utils/selfUpdate.ts`

```typescript
interface UpdateResult {
  success: boolean;
  error?: string;
  newVersion?: string;
  needsRestart?: boolean;
  requiresSudo?: boolean;
}

interface UpdateOptions {
  checkOnly?: boolean;
  force?: boolean;
  targetLocation?: 'user' | 'system';
}

async function selfUpdate(options?: UpdateOptions): Promise<UpdateResult> {
  // 1. Check installation location
  // 2. Verify permissions
  // 3. Check current version against GitHub releases
  // 4. Download appropriate release for OS/architecture
  // 5. Extract and replace executables
  // 6. Handle permissions and file locks
  // 7. Return result with restart/sudo requirements
}
```

### 3. API Upgrade Endpoint

#### REST Endpoint
```typescript
// New endpoint in apiRouter.ts
.post('/v1/upgrade', initiateUpgrade)
```

#### WebSocket Messages
```typescript
interface UpgradeStatus {
  type: 'upgrade_status';
  status: 'downloading' | 'installing' | 'restarting' | 'complete' | 'error';
  progress?: number;
  error?: string;
  requiresSudo?: boolean;
  installLocation?: 'user' | 'system';
}
```

### 4. BUI Version Compatibility

#### Version Check
- Compare local version with API version on connection
- Use @std/semver for version comparison
- Show warning if versions don't match
- Allow usage with warning unless major version mismatch

#### UI Components
```typescript
// New version components
interface VersionInfo {
  current: string;
  required: string;
  compatible: boolean;
  installLocation: 'user' | 'system';
  canAutoUpdate: boolean;
}

// Add to HelpDialog sections
const VERSION_SECTION: HelpSection = {
  title: 'Version Information',
  content: VersionInfoComponent
}
```

### 5. CLI Upgrade Command

Location: `cli/src/commands/upgrade.ts`

```typescript
// New upgrade command
const upgrade = new Command()
  .name('upgrade')
  .description('Upgrade BB to the latest version')
  .option('--check', 'Check for updates without installing')
  .option('--force', 'Force upgrade even if already up to date')
  .option('--migrate-to <location:string>', 'Migrate installation to user or system location', {
    choices: ['user', 'system']
  })
  .action(async (options) => {
    // 1. Check installation location
    // 2. Verify permissions
    // 3. Handle migration if requested
    // 4. Call self-update function
    // 5. Restart API if running
    // 6. Show results to user
  });
```

## Implementation Steps

1. Core Updates
   - ✅ Create version management system
   - ✅ Add version to collaborationReady response
   - ✅ Implement version comparison logic
   - ⏳ Add installation location detection
   - ⏳ Create selfUpdate.ts utility

2. API Changes
   - ✅ Add version info to responses
   - ⏳ Add upgrade endpoint
   - ⏳ Add WebSocket upgrade status messages
   - ⏳ Implement safe restart mechanism
   - ⏳ Handle installation location constraints

3. BUI Updates
   - ✅ Add version display components
   - ✅ Implement version check on connection
   - ✅ Add version mismatch warnings
   - ✅ Show upgrade availability and requirements
   - ✅ Update Help dialog

4. CLI Changes
   - ⏳ Create upgrade command
   - ⏳ Add migration command
   - ⏳ Integrate with self-update utility
   - ⏳ Add API restart handling
   - ⏳ Implement permission checks

## Testing Requirements

1. Version Management
   - Version parsing and comparison
   - Version display in all components
   - Version mismatch detection
   - Installation location detection

2. Upgrade Process
   - Successful upgrade path for both locations
   - Failed upgrade handling
   - Partial upgrade recovery
   - Permission handling
   - File lock handling
   - Migration testing

3. Component Communication
   - Version check during connection
   - Upgrade status messages
   - API restart coordination
   - Permission requirement messaging

4. Error Handling
   - Network failures
   - Invalid versions
   - Incomplete downloads
   - Failed installations
   - Permission denied scenarios
   - Migration failures

## Security Considerations

1. Download Verification
   - Verify package signatures
   - Validate checksums
   - Check download sources

2. Installation Safety
   - Backup current version
   - Atomic updates
   - Rollback capability
   - Handle both privileged and unprivileged operations

3. Permission Management
   - Minimum required permissions
   - Secure file operations
   - Protected resource access
   - Clear sudo requirement messaging
   - Safe privilege escalation

## Future Considerations

1. Desktop UI Integration
   - Add version compatibility to DUI
   - Implement upgrade UI in DUI
   - Handle native app updates
   - Default to user-local installation
   - Provide migration assistant

2. Advanced Features
   - Automatic update checks
   - Scheduled updates
   - Update notifications
   - Beta version support
   - Installation location preferences

3. Enterprise Support
   - Version policy enforcement
   - Update restrictions
   - Network proxy support
   - Offline updates
   - Custom installation locations
   - Mass deployment options


### Completed
1. BUI Version Infrastructure
   - Created signal-based version management (useVersion.ts hook)
   - Added version info to WebSocket response types
   - Implemented version info handling in WebSocket manager
   - Added version display components
   - Updated Help dialog with version section

2. Component Integration
   - Added version info to collaborationReady response
   - Integrated version handling in useChatState
   - Connected WebSocket manager to version system
   - Implemented version compatibility checks

### In Progress
1. API Changes
   - Adding version info to API responses
   - Implementing upgrade endpoint
   - Adding WebSocket upgrade status messages

2. Installation Location Support
   - Implementing location detection
   - Adding permission checks
   - Handling upgrade constraints

### Next Steps
1. Immediate Tasks
   - Complete API upgrade endpoint implementation
   - Add installation location detection
   - Implement CLI upgrade command
   - Add tests for version components

2. Future Work
   - Implement migration command
   - Add automatic update checks
   - Create upgrade UI in DUI
   - Add enterprise deployment options

