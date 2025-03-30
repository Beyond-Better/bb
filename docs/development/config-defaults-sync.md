# Config Defaults Synchronization

## Current State

The BB project currently maintains default configuration values in two places, which must be kept in sync manually:

### TypeScript Defaults
Location: `src/shared/config/v2/types.ts`
- `GlobalConfigDefaults`: Core system defaults
- `ApiConfigDefaults`: API server configuration
- `BuiConfigDefaults`: Browser UI configuration
- `CliConfigDefaults`: Command-line interface settings
- `DuiConfigDefaults`: Desktop UI configuration

### Rust Defaults
Location: `dui/src-tauri/src/config.rs`
- `impl Default for GlobalConfig`: Core system defaults
- `impl Default for ApiConfig`: API server configuration
- `impl Default for BuiConfig`: Browser UI configuration
- `impl Default for CliConfig`: Command-line interface settings
- `impl Default for DuiConfig`: Desktop UI configuration

Cross-references have been added to both files to help maintainers keep the defaults synchronized:
1. TypeScript (`src/shared/config/v2/types.ts`) - Used by API
2. Rust (`dui/src-tauri/src/config.rs`) - Used by DUI

This creates a maintenance burden as changes need to be synchronized manually between the two codebases.

## Usage Analysis

### DUI (Rust) Config Usage

The DUI uses default configuration in several critical scenarios:

1. Initial Installation:
   - When BB is first installed, DUI creates initial config file
   - Uses `GlobalConfig::default()` implementation
   - Must happen before API can start

2. Service Management:
   - DUI starts/stops API and BUI services
   - Requires basic config (hostname, ports, TLS settings)
   - Used in `start_api()` and `start_bui()`

3. Config File Creation:
   ```rust
   // In lib.rs
   fn ensure_global_config() {
       if !config_path.exists() {
           let default_config = GlobalConfig::default();
           // Save to disk...
       }
   }
   ```

### Current Limitations

1. Startup Dependencies:
   - API needs config to start
   - Config needs to exist before API starts
   - Creates circular dependency for runtime config fetching

2. Default Values:
   - Some defaults are dynamic (e.g., `myPersonsName` from environment)
   - Others are static (e.g., port numbers, hostnames)
   - TypeScript and Rust implementations may diverge

## Proposed Solutions

### Option A: Code Generation (Not Recommended)

Generate Rust code from TypeScript defaults during build.

Pros:
- Type safety in both languages
- Build-time verification
- No runtime overhead

Cons:
- Complicates local development
- Requires build step for DUI changes
- Less flexible for dynamic defaults

### Option B: Shared Config File (Partial Solution)

Move static defaults to a shared JSON/YAML file.

Pros:
- Single source of truth
- No runtime overhead
- Simple to implement

Cons:
- Loses type safety
- Can't handle dynamic defaults
- Additional file to maintain

### Option C: Runtime Sync (Not Recommended)

Have Rust fetch defaults from TypeScript at runtime.

Pros:
- Always in sync
- Handles dynamic defaults
- Single source of truth

Cons:
- Circular dependency: API needs config to start
- More complex implementation
- Runtime overhead

## Recommended Approach

Short-term: Keep current structure with improvements

1. Maintain separate defaults with better documentation:
   - Document required vs optional defaults
   - Add validation comments linking to TypeScript source
   - Create automated tests to verify sync

2. Ensure DUI defaults cover minimal requirements:
   ```rust
   impl Default for GlobalConfig {
       fn default() -> Self {
           GlobalConfig {
               version: "2.1.0".to_string(),
               defaultModels: DefaultModels {
                   orchestrator: "claude-3-7-sonnet-20250219".to_string(),
                   agent: "claude-3-7-sonnet-20250219".to_string(),
                   chat: "claude-3-haiku-20240307".to_string(),
               },
               // ... other defaults
           }
       }
   }
   ```

3. Add validation in API startup:
   - API checks config against TypeScript defaults
   - Warns about mismatches
   - Updates config if needed

Long-term: Consider hybrid approach

1. Split defaults into categories:
   - Static (shared JSON file)
   - Dynamic (language-specific)
   - Required (documented interface)

2. Create validation layer:
   - TypeScript validates full config
   - Rust validates minimal requirements
   - API updates non-critical defaults

3. Improve development workflow:
   - Add config validation to CI
   - Create config migration tools
   - Better error messages for mismatches

## Implementation Plan

1. Immediate Tasks:
   - ✓ Add missing `defaultModels` to Rust implementation
   - ✓ Document all default values in both codebases
   - ✓ Add cross-reference comments
   - Add validation tests

Key fields that must stay in sync:
   - Global Config:
     * defaultModels (orchestrator, agent, chat)
     * myPersonsName
     * myAssistantsName
   - API Config:
     * maxTurns
     * supabaseConfigUrl
     * port numbers
     * default directories
   - BUI Config:
     * kvSessionPath
     * port numbers
   - CLI Config:
     * historySize
   - DUI Config:
     * projectsDirectory
     * recentProjects

2. Future Improvements:
   - Create shared defaults file for static values
   - Add config validation to CI
   - Implement API-side config verification

3. Long-term Goals:
   - Design proper config validation layer
   - Create config migration tools
   - Improve development workflow