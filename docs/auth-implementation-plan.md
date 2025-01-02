# BB Authentication Implementation Plan

This plan focuses on implementing the API-centered authentication solution, starting with the BUI-API flow. The implementation will be done in phases, with each phase building on the previous one.

## Overview
This implementation plan details the steps to implement Supabase authentication in BB, with the API acting as the auth authority. The BUI initiates auth flows and the API manages the Supabase session. Implementation is divided into phases, starting with basic infrastructure and building up to a complete auth solution.

## Implementation Summary
1. Phase 1: Infrastructure
   - Fetch Supabase config from cloud BUI
   - Implement Deno KV storage for sessions
   - Setup retry mechanism with configurable settings

2. Phase 2: Auth Flow
   - Implement core auth functionality
   - Handle social auth providers
   - Manage session refresh

3. Phase 3: Refinements
   - Comprehensive error handling
   - Auth state management
   - Recovery procedures

Note: Secure BUI-API communication channel will be implemented separately.

This implementation plan details the steps to implement Supabase authentication in BB, with the API acting as the auth authority. The BUI initiates auth flows and the API manages the Supabase session. Implementation is divided into phases, starting with basic infrastructure and building up to a complete auth solution.

## Phase 1: Basic Infrastructure

### 1.0 Types and Interfaces

1. Shared Types (src/shared/types/auth.ts)
```typescript
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthError {
  code: string;
  message: string;
}
```

2. API Types (api/src/types/auth.ts)
```typescript
import type { AuthUser } from '../../../src/shared/types/auth.ts';

export interface Session {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface StoredSession extends Session {
  created_at: number;
  last_accessed: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
```

### 1.1 Supabase Configuration
Implement configuration fetching from cloud BUI to API. This provides the Supabase URL and anon key needed for auth.
1. Add BUI endpoint for Supabase config
   ```typescript
   // In BUI routes
   router.get('/api/config/supabase', (ctx) => {
     ctx.response.body = {
       url: globalConfig.bui.supabaseUrl,
       anonKey: globalConfig.bui.supabaseAnonKey
     };
   });
   ```

2. Update API initialization with retry logic
   ```typescript
   class ApiServer {
     // Config values with defaults
     private get maxRetries(): number {
       return this.config.get('supabase.configFetch.maxRetries', 3);
     }

     private get retryDelay(): number {
       return this.config.get('supabase.configFetch.retryDelay', 5000); // 5 seconds
     }
      // 5 seconds

     async initialize(options: { localMode?: boolean } = {}) {
       if (!options.localMode) {
         const config = await this.fetchSupabaseConfig();
         if (!config) {
           throw new Error('Failed to get Supabase configuration from BUI');
         }

         // Initialize Supabase client with config
         this.supabaseClient = createClient(config.url, config.anonKey, {
           auth: { /* ... */ }
         });
       }
     }

     private async fetchSupabaseConfig() {
       // Use BB's logger for consistent error reporting
       for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
         try {
           logger.info(`Fetching Supabase config from BUI (attempt ${attempt}/${this.maxRetries)`);
           
           const response = await fetch('https://bb.dev/api/config/supabase');
           if (!response.ok) {
             throw new Error(`HTTP ${response.status}: ${response.statusText}`);
           }
           
           const config = await response.json();
           logger.info('Successfully fetched Supabase config from BUI');
           return config;
           
         } catch (error) {
           logger.error(
             `Failed to fetch Supabase config (attempt ${attempt}/${this.MAX_RETRIES}):`,
             error
           );
           
           if (attempt === this.MAX_RETRIES) {
             logger.error('Max retry attempts reached. API will not start unless in localMode.');
             return null;
           }
           
           logger.info(`Retrying in ${this.retryDelay/1000} seconds...`);
           await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
         }
       }
     } 
   }
   ```

   Notes:
   - Retries 3 times with 5-second delay
   - Fails API startup after max retries
   - Skips config fetch in localMode
   - Config only fetched at startup


### 1.2 Config Validation

1. Implement config validation
```typescript
function validateSupabaseConfig(config: unknown): config is SupabaseConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config: must be an object');
  }

  const { url, anonKey } = config as Record<string, unknown>;

  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Invalid config: url must be a non-empty string');
  }

  if (typeof anonKey !== 'string' || !anonKey.trim()) {
    throw new Error('Invalid config: anonKey must be a non-empty string');
  }

  try {
    new URL(url);
  } catch {
    throw new Error('Invalid config: url must be a valid URL');
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(anonKey)) {
    throw new Error('Invalid config: anonKey contains invalid characters');
  }

  return true;
}
```

### 1.3 Error Handling

1. Define Error Types
```typescript
class ConfigFetchError extends Error {
  constructor(message: string, public readonly attempt: number) {
    super(`Failed to fetch Supabase config (attempt ${attempt}): ${message}`);
    this.name = 'ConfigFetchError';
  }
}

class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

interface AuthErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

2. Error Handling Strategy
- Config Fetch Errors (Fatal)
  * Max retries reached: API fails to start
  * Invalid config data: API fails to start
  * Network timeout: Retry with backoff, then fail

- Session Token Errors (Non-Fatal)
  * Invalid/expired token: Trigger re-authentication
  * Storage access failure: Trigger re-authentication

### 1.4 Session Storage
Note: This phase will be implemented in a separate plan focused on secure BUI-API communication.
1. Generate shared secret during API installation
   - Add to API config structure
   - Store in appropriate config location
   - Make available to BUI config

2. Implement API authentication middleware
   ```typescript
   // Add middleware for validating client requests
   interface ApiAuthHeaders {
     'X-Client-ID': string;
     'X-Timestamp': string;
     'X-Auth-Token': string;
   }
   ```

3. Create BUI API client
   - Implement auth header generation
   - Add to all API requests
   - Handle auth errors

### 1.5 Session Storage Implementation

1. Implement localStorage interface over Deno KV
   ```typescript
   class DenoKVStorage implements Storage {
     private prefix = 'supabase_auth:';
     
     constructor(private kv: Deno.Kv) {}

     async getItem(key: string): Promise<string | null> {
       const result = await this.kv.get([this.prefix, key]);
       return result.value as string ?? null;
     }

     async setItem(key: string, value: string): Promise<void> {
       await this.kv.set([this.prefix, key], value);
     }

     async removeItem(key: string): Promise<void> {
       await this.kv.delete([this.prefix, key]);
     }

     async clear(): Promise<void> {
       // Delete all keys with our prefix
       const entries = this.kv.list({ prefix: [this.prefix] });
       for await (const entry of entries) {
         await this.kv.delete(entry.key);
       }
     }

     // Required by Storage interface but not used
     get length(): number { return 0; }
     key(index: number): string | null { return null; }
   }
   ```

2. Initialize Supabase client with storage
   ```typescript
   const kv = await Deno.openKv();
   const storage = new DenoKVStorage(kv);

   const supabaseClient = createClient(config.url, config.anonKey, {
     auth: {
       storage,
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: false  // API handles auth callbacks differently
     }
   });

   // Enable auto refresh
   supabaseClient.auth.startAutoRefresh();
   ```

3. Error handling for storage operations
   ```typescript
   class DenoKVStorage implements Storage {
     private async withErrorHandling<T>(
       operation: string,
       fn: () => Promise<T>
     ): Promise<T> {
       try {
         return await fn();
       } catch (error) {
         logger.error(`Storage ${operation} failed:`, error);
         throw new Error(`Storage operation failed: ${operation}`);
       }
     }

     async getItem(key: string): Promise<string | null> {
       return this.withErrorHandling('getItem', async () => {
         const result = await this.kv.get([this.prefix, key]);
         return result.value as string ?? null;
       });
     }
     // Apply to other methods similarly
   }
   ```

## Phase 2: Core Auth Flow

### 2.1 BUI Changes
1. Update auth components
   - Modify login form handling
   - Add loading states
   - Handle auth errors

2. Implement secure websocket connection
   ```typescript
   class SecureWebSocket {
     connect() {
       // Handle auth challenge
       // Establish secure connection
       // Maintain connection
     }
   }
   ```

3. Add auth status management
   - Track connection state
   - Handle disconnections
   - Show auth status to user

### 2.2 API Changes
1. Implement auth endpoints
   ```typescript
   router
     .post('/auth/login', handleLogin)
     .post('/auth/logout', handleLogout)
     .get('/auth/status', handleStatus);
   ```

2. Add websocket auth handling
   - Challenge-response flow
   - Session management
   - Event broadcasting

3. Configure Supabase client
   - Session management
   - Token refresh
   - Error handling

### 2.3 Auth Flow Implementation

1. Initial auth state check
   ```typescript
   // In API
   async checkAuthState() {
     const { data: { session } } = await this.supabaseClient.auth.getSession();
     return {
       isAuthenticated: !!session,
       user: session?.user
     };
   }
   ```

2. Login flow sequence
   ```typescript
   // 1. BUI initiates login
   // 2. API handles Supabase auth
   async handleLogin(email: string, password: string) {
     const { data, error } = await this.supabaseClient.auth.signInWithPassword({
       email,
       password
     });

     if (error) throw error;
     return data;
   }

   // 3. Session established
   // 4. API broadcasts status
   this.eventManager.emit('auth:stateChanged', {
     isAuthenticated: true,
     user: session.user
   });
   ```

3. Session refresh handling
   ```typescript
   // In API initialization
   setupAuthListeners() {
     this.supabaseClient.auth.onAuthStateChange((event, session) => {
       switch (event) {
         case 'SIGNED_IN':
         case 'TOKEN_REFRESHED':
         case 'SIGNED_OUT':
           this.eventManager.emit('auth:stateChanged', {
             isAuthenticated: !!session,
             user: session?.user
           });
           break;
       }
     });
   }
   ```

4. Social auth handling
   ```typescript
   // In API
   async handleSocialAuth(provider: 'github' | 'google') {
     const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
       provider,
       options: {
         redirectTo: 'https://bb.dev/auth/callback'
       }
     });

     if (error) throw error;
     return data;
   }

   // BUI handles the redirect and sends result to API
   async handleAuthCallback(params: URLSearchParams) {
     // API completes auth
     const { data, error } = await this.supabaseClient.auth.exchangeCodeForSession(
       params.get('code')
     );

     if (error) throw error;
     return data;
   }
   ```
1. Initial connection
   ```typescript
   // BUI connects to API
   // Establish secure channel
   // Verify API availability
   ```

2. Login flow
   ```typescript
   // User initiates login
   // API handles Supabase auth
   // Session established
   // Status broadcast
   ```

3. Session management
   ```typescript
   // API refreshes token
   // Status updates
   // Error handling
   ```

## Phase 3: Refinements

### 3.1 Error Handling

1. API Error Scenarios
   ```typescript
   // Error types
   type AuthError =
     | { code: 'CONFIG_FETCH_FAILED'; message: string }
     | { code: 'STORAGE_ERROR'; message: string }
     | { code: 'AUTH_FAILED'; message: string }
     | { code: 'SESSION_EXPIRED'; message: string }
     | { code: 'NETWORK_ERROR'; message: string };

   // Error handling in API
   class ApiServer {
     private handleAuthError(error: Error): AuthError {
       if (error instanceof StorageError) {
         return { code: 'STORAGE_ERROR', message: error.message };
       }
       // ... handle other error types
     }

     private broadcastError(error: AuthError) {
       this.eventManager.emit('auth:error', error);
     }
   }
   ```

2. BUI Error Handling
   ```typescript
   // In BUI auth state management
   interface AuthState {
     isAuthenticated: boolean;
     user?: User;
     error?: AuthError;
     isLoading: boolean;
   }

   function useAuth() {
     const [authState, setAuthState] = useState<AuthState>({
       isAuthenticated: false,
       isLoading: true
     });

     useEffect(() => {
       // Listen for auth errors
       const handleError = (error: AuthError) => {
         setAuthState(prev => ({ ...prev, error }));
         
         // Handle specific errors
         switch (error.code) {
           case 'SESSION_EXPIRED':
             // Prompt for re-auth
             break;
           case 'NETWORK_ERROR':
             // Show reconnection UI
             break;
         }
       };

       // ... setup listeners
     }, []);
   }
   ```

3. Recovery Procedures
   ```typescript
   class ApiServer {
     async recoverSession() {
       try {
         // Attempt to recover from storage
         const { data: { session } } = 
           await this.supabaseClient.auth.getSession();

         if (session) {
           // Validate session is still valid
           const { data: { user } } = 
             await this.supabaseClient.auth.getUser();

           if (user) {
             this.broadcastAuthState({
               isAuthenticated: true,
               user
             });
             return true;
           }
         }

         // Session invalid or expired
         await this.supabaseClient.auth.signOut();
         return false;

       } catch (error) {
         logger.error('Session recovery failed:', error);
         return false;
       }
     }
   }
   ```

### 3.2 Auth State Management

1. BUI Auth State Tracking
   ```typescript
   // In BUI components/AuthProvider.tsx
   interface AuthContextType {
     isAuthenticated: boolean;
     user?: User;
     error?: AuthError;
     isLoading: boolean;
     login: (email: string, password: string) => Promise<void>;
     logout: () => Promise<void>;
     clearError: () => void;
   }

   export function AuthProvider({ children }: { children: React.ReactNode }) {
     const [state, setState] = useState<AuthState>({
       isAuthenticated: false,
       isLoading: true
     });

     useEffect(() => {
       // Setup websocket connection to API
       const ws = new WebSocket('ws://localhost:8000/app');

       ws.onmessage = (event) => {
         const { type, data } = JSON.parse(event.data);
         switch (type) {
           case 'auth:stateChanged':
             setState({
               isAuthenticated: data.isAuthenticated,
               user: data.user,
               isLoading: false
             });
             break;
           case 'auth:error':
             setState(prev => ({ ...prev, error: data }));
             break;
         }
       };

       // Handle disconnection
       ws.onclose = () => {
         setState(prev => ({
           ...prev,
           error: { 
             code: 'NETWORK_ERROR',
             message: 'Connection to API lost'
           }
         }));
       };

       return () => ws.close();
     }, []);

     // ... implement auth methods

     return (
       <AuthContext.Provider value={{ ...state, login, logout, clearError }}>
         {children}
       </AuthContext.Provider>
     );
   }
   ```

2. Auth State Synchronization
   ```typescript
   // In API
   class ApiServer {
     private broadcastAuthState() {
       const state = await this.checkAuthState();
       this.eventManager.emit('auth:stateChanged', state);
     }

     // Call on important state changes
     private async handleAuthStateChange(event: AuthChangeEvent) {
       switch (event) {
         case 'SIGNED_IN':
         case 'SIGNED_OUT':
         case 'USER_UPDATED':
         case 'TOKEN_REFRESHED':
           await this.broadcastAuthState();
           break;
       }
     }
   }
   ```
1. Connection errors
   - API unavailable
   - Auth failures
   - Session expiry

2. User feedback
   - Status indicators
   - Error messages
   - Loading states

3. Recovery flows
   - Reconnection logic
   - Session recovery
   - Graceful degradation

### 3.2 Security Hardening
1. Request validation
   - Timestamp checking
   - Nonce management
   - Rate limiting

2. Session protection
   - Secure storage
   - Token handling
   - Connection validation

## Testing Considerations

### Manual Testing
1. Basic auth flow
   - Successful login
   - Failed login
   - Session persistence
   - Token refresh

2. Error conditions
   - API unavailable
   - Network issues
   - Invalid credentials
   - Session expiry

3. Security testing
   - Invalid client attempts
   - Replay attacks
   - Session handling

### Future Automated Testing
1. API endpoints
   - Auth validation
   - Session management
   - Error cases

2. BUI integration
   - Connection handling
   - Auth state management
   - User feedback

## Implementation Notes

### Configuration Options

The API supports the following configuration options for Supabase config fetching:

```typescript
interface SupabaseConfigOptions {
  supabase: {
    configFetch: {
      // Maximum number of retry attempts when fetching config from BUI
      maxRetries: number;  // default: 3
      
      // Delay in milliseconds between retry attempts
      retryDelay: number;  // default: 5000
    }
  }
}
```

These values can be set in the API's configuration file or environment variables:
- `SUPABASE_CONFIG_FETCH_MAX_RETRIES`
- `SUPABASE_CONFIG_FETCH_RETRY_DELAY`

### Prerequisites
1. BUI endpoint for Supabase config
2. API startup sequence
3. Error handling for config fetch
1. Supabase project setup
2. API config structure updates
3. Deno KV access
4. Development environment

### Security Considerations
1. Secure secret handling
2. Localhost security
3. Token management
4. Error exposure

### Monitoring
1. Auth failures
2. Session status
3. API health
4. Connection state

## Success Criteria

### Phase 1 (Config & Storage)
1. API successfully fetches config from cloud BUI
2. Proper retry handling and logging
3. Graceful fallback to localMode
4. Deno KV storage working

### Phase 2 (Auth Flow)
1. Successful login flow
2. Secure BUI-API communication
3. Persistent sessions
4. Proper error handling
5. Clear user feedback
6. Token refresh working
1. Successful login flow
2. Secure BUI-API communication
3. Persistent sessions
4. Proper error handling
5. Clear user feedback
6. Token refresh working

## Implementation Considerations

### Testing Strategy
1. Manual Testing Priorities
   - Config fetching from cloud BUI
   - Auth flow with different providers
   - Session persistence and recovery
   - Error scenarios
   - Network disconnections

2. Test Environment Setup
   - Local BUI for initial testing
   - Test Supabase project
   - Network condition simulation

### Deployment Notes
1. Version Requirements
   - Deno 1.37 or later (for KV support)
   - Fresh 1.4 or later
   - Supabase JS v2

2. Configuration Changes
   - Update BUI config for auth endpoints
   - API config for retry settings
   - Environment variables

3. Migration Path
   - Implement on new git branch
   - No backward compatibility needed
   - Clear upgrade instructions

## Next Steps After Completion
1. CLI integration
2. Social auth providers
3. Multi-user support
4. Advanced security features