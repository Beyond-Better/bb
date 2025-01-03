# BB Authentication Design Discussion

## Problem Statement
BB needs to support user authentication via Supabase, allowing access to Supabase features (edge functions, storage, database). The architecture involves three components: BUI (browser), API (local service), and CLI (command line), all needing to interact with Supabase securely.

## Options Considered

### 1. Dual Session Approach
Initial design considered maintaining separate Supabase sessions for BUI and API.

Pros:
- Clear separation of concerns
- Independent session management

Cons:
- Complex session management
- Requires two auth flows
- Difficult to support social auth
- Poor user experience

### 2. BUI as Primary Auth
Consider letting BUI handle all Supabase interaction.

Pros:
- Simpler auth flow
- Direct browser integration

Cons:
- API needs separate auth
- Token sharing security concerns
- Complex token refresh handling

### 3. API as Auth Authority (Chosen Solution)
Make API responsible for all Supabase interaction, with BUI and CLI as clients.

Pros:
- Single source of truth for auth
- Centralized session management
- Cleaner architecture
- Simpler token refresh handling
- Works with all auth methods

Cons:
- API must be running for auth
- Requires secure client-API communication
- More complex initial setup

## Key Decisions

### 0. Configuration Management
- BUI serves as source of truth for Supabase configuration
- Already has supabase url and anon key in globalConfig/bui
- API fetches config from cloud BUI endpoint with retry mechanism:
  * Configurable number of retry attempts
  * Configurable delay between retries
  * Clear logging of fetch attempts
  * Graceful fallback to localMode if config unavailable
- localMode allows API to run without Supabase features
  * Useful for development and testing
  * Limited functionality but still operational
  * No auth requirements in localMode
- BUI serves as source of truth for Supabase configuration
- Already has supabase url and anon key in globalConfig/bui
- API fetches config from cloud BUI endpoint
- Retries on failure before giving up
- Config only needed at API startup
- Fails gracefully to localMode if config unavailable
- Centralized configuration in cloud-hosted BUI

### 1. API as Supabase Authority
- API manages Supabase session using supabase-ssr
- API handles token refresh
- API stores session in Deno KV
- Initially single-user design with multi-user possible later

### 2. Client-API Security
- Shared secret approach for client authentication
- Consistent auth across HTTP and WebSocket
- Simple but effective for localhost communication
- Works for both BUI and CLI

### 3. Auth Flow
- BUI initiates auth process
- Social auth redirects handled by BUI
- API manages Supabase session
- Secure client-API connection established before auth flow

## Challenges Identified

### 1. Social Auth Flow
- Need to handle browser-based auth flow
- Redirects must go through BUI
- Balance between BUI handling and API control

### 2. Session Storage
- Implement localStorage interface over Deno KV
- Session refresh mechanism
- Future multi-user considerations

### 3. Security
- Secure distribution of client-API shared secrets
- Protection against unauthorized access
- Secure websocket communication

## Future Considerations

### 1. Multi-User Support
- Session storage design
- User isolation
- Auth state management

### 2. CLI Integration
- Support both local and authenticated modes
- Consistent auth experience with BUI
- Secure credential handling

### 3. DUI Integration
- Currently deprioritized
- BUI in webview handles auth
- DUI focuses on API control

## Implementation Strategy
- Phase 1: BUI-API auth flow
- Phase 2: CLI integration
- Phase 3: Multi-user support (if needed)

## Open Questions
1. Exact social auth flow implementation details
2. Best practices for shared secret distribution
3. Session refresh optimization
4. Multi-user storage schema