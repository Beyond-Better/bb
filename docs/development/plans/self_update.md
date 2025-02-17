# Self-Update and API Upgrade Features

This document describes BB's self-update functionality and API upgrade endpoints.

## Self-Update Function

The self-update functionality allows BB to update itself and its components based on the installation location and permissions.

### Installation Locations

BB supports two installation locations:

1. System-wide Installation (`/usr/local/bin`):
   - Requires sudo/admin privileges for updates
   - Cannot support automatic upgrades via API
   - Must use manual upgrade process

2. User-local Installation (`~/.bb/bin`):
   - No privileged access required
   - Supports automatic upgrades
   - Default for new installations
   - Recommended for most users

### Update Process

The self-update process:
1. Checks current installation location
2. Verifies required permissions
3. Downloads appropriate release for OS/architecture
4. Safely replaces executables
5. Handles file permissions
6. Manages API restart if needed

## API Upgrade Endpoint

### REST Endpoint
```typescript
// POST /v1/upgrade
interface UpgradeRequest {
  checkOnly?: boolean;    // Only check for updates
  force?: boolean;        // Force upgrade even if up to date
}

interface UpgradeResponse {
  available: boolean;     // Update available
  currentVersion: string; // Installed version
  latestVersion: string;  // Available version
  needsRestart: boolean;  // API restart required
  requiresSudo: boolean;  // Privileged access needed
}
```

### WebSocket Messages
```typescript
interface UpgradeStatus {
  type: 'upgrade_status';
  status: 'downloading' | 'installing' | 'restarting' | 'complete' | 'error';
  progress?: number;      // Download/install progress
  error?: string;        // Error message if failed
  requiresSudo?: boolean; // Privileged access needed
}
```

## CLI Upgrade Command

```bash
# Check for updates
bb upgrade --check

# Perform upgrade
bb upgrade

# Force upgrade
bb upgrade --force
```

## Security Considerations

1. Download Verification:
   - Package signatures verified
   - Checksums validated
   - Source authenticity confirmed

2. Installation Safety:
   - Atomic updates
   - Backup of current version
   - Rollback capability
   - Safe privilege escalation

3. Permission Management:
   - Minimum required permissions
   - Clear sudo requirement messaging
   - Protected resource access
   - Safe privilege handling