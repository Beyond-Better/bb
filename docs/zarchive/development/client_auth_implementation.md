# BUI/DUI Authentication Implementation Guide

## Getting Started

### Initial Setup Steps
1. Start a new conversation with:
   ```markdown
   I need help implementing Supabase authentication in the BUI (Fresh) and DUI clients.
   Let's start with:
   1. Setting up the Supabase client in Fresh
   2. Creating the auth middleware
   3. Building the login page and form
   ```

### Implementation Order
1. Basic Auth Flow
   - Supabase client setup
   - Login page and form
   - Auth middleware
   - Protected routes

2. Additional Features
   - Registration
   - Password reset
   - Email verification
   - OAuth providers

3. Polish & Security
   - Error handling
   - Loading states
   - Security headers
   - Rate limiting

### Required Changes
1. Fresh Configuration
   - Add Supabase dependency
   - Configure environment
   - Set up types

2. File Structure
   - Create auth routes
   - Add form islands
   - Implement middleware
   - Add utility functions

This guide outlines the steps needed to implement Supabase authentication in both BUI (Browser UI) and DUI (Desktop UI) clients.

## Implementation Steps

### 1. BUI Authentication

#### Setup Required
1. Add Supabase dependency
   ```jsonc
   // import_map.json
   {
     "imports": {
       "@supabase/supabase-js": "jsr:@supabase/supabase-js@2"
     }
   }
   ```

2. Environment configuration
   ```typescript
   // bui/utils/supabase.ts
   import { createClient } from '@supabase/supabase-js';
   import { config } from '$fresh/config.ts';
   import type { Database } from '../types/database.ts';

   export const supabase = createClient<Database>(
     Deno.env.get('SUPABASE_URL') ?? '',
     Deno.env.get('SUPABASE_ANON_KEY') ?? ''
   );
   ```

3. Environment variables
   ```bash
   # .env
   SUPABASE_URL=http://localhost:54321
   SUPABASE_ANON_KEY=your-local-anon-key
   ```

#### Components Structure
1. Auth Middleware
   ```typescript
   // bui/routes/_middleware.ts
   import { MiddlewareHandlerContext } from '$fresh/server.ts';
   import { getCookies } from '@std/http/cookie.ts';
   import { supabase } from '../utils/supabase.ts';

   export async function handler(req: Request, ctx: MiddlewareHandlerContext) {
     // Handle auth state and protected routes
   }
   ```

2. Auth Islands (Interactive Components)
   ```typescript
   // bui/islands/LoginForm.tsx
   import { useSignal } from '@preact/signals';
   import { supabase } from '../utils/supabase.ts';

   export default function LoginForm() {
     const email = useSignal('');
     const password = useSignal('');
     // Handle login logic
   }
   ```

3. Auth State Management
   ```typescript
   // bui/utils/auth.ts
   import { signal } from '@preact/signals';
   import type { User } from '../types/auth.ts';

   export const user = signal<User | null>(null);
   export const isLoading = signal(true);

   export async function initAuth() {
     // Initialize auth state
   }
   ```

4. Required Routes and Components
   - /routes/auth/login.tsx + LoginForm island
   - /routes/auth/register.tsx + RegisterForm island
   - /routes/auth/reset-password.tsx + ResetForm island
   - /routes/auth/verify.tsx for email verification
   - /routes/_middleware.ts for protection

#### Implementation Tasks
1. [ ] Set up Supabase client utility
   - Configure globalConfig bui variables
   - Create type definitions
   - Add error handling

2. [ ] Implement auth middleware
   - Session validation
   - Route protection
   - Redirect handling
   - Cookie management

3. [ ] Create auth state management
   - User signal
   - Loading states
   - Error handling
   - Session persistence

4. [ ] Build auth routes and islands
   - Login page and form
   - Registration page and form
   - Password reset flow
   - Email verification handler

5. [ ] Add OAuth integration
   - Provider configuration
   - Callback handling
   - Profile merging
   - Error recovery

6. [ ] Implement security features
   - CSRF protection
   - Rate limiting
   - Session invalidation
   - Error boundaries

### 2. DUI Authentication (Tauri)

#### Setup Required
1. Install dependencies
   ```bash
   cd dui
   npm install @supabase/supabase-js
   ```

2. Environment configuration
   ```typescript
   // dui/src/lib/supabase.ts
   import { createClient } from '@supabase/supabase-js';
   import { Store } from '@tauri-apps/api/store';
   
   // Use Tauri's secure store for tokens
   const store = new Store('.secrets.dat');
   ```

3. Deep linking setup
   ```rust
   // dui/src-tauri/src/main.rs
   #[tauri::command]
   async fn handle_deep_link(url: String) {
     // Handle OAuth redirects and other deep links
   }
   ```

4. Protocol Registration
   ```toml
   # dui/src-tauri/tauri.conf.json
   {
     "tauri": {
       "protocol": {
         "name": "bb-desktop",
         "schemes": ["bb-desktop"]
       }
     }
   }
   ```

#### Components Structure
1. Auth Store
   ```typescript
   // dui/src/lib/auth.ts
   import { Store } from '@tauri-apps/api/store';
   import { signal } from '@preact/signals';
   import type { User, Session } from './types';

   export const user = signal<User | null>(null);
   export const loading = signal(true);

   // Secure storage using Tauri
   const secureStore = new Store('.secrets.dat');

   export async function persistSession(session: Session) {
     await secureStore.set('session', session);
     user.value = session.user;
   }
   ```

2. Tauri Commands
   ```rust
   // dui/src-tauri/src/commands.rs
   #[tauri::command]
   async fn get_stored_session(app: tauri::AppHandle) -> Result<Option<Session>, String> {
     // Access secure storage and return session
   }

   #[tauri::command]
   async fn clear_session(app: tauri::AppHandle) -> Result<(), String> {
     // Clear stored session data
   }
   ```

3. Auth Components
   ```tsx
   // dui/src/routes/auth/login.tsx
   import { useSignal } from '@preact/signals';
   import { supabase } from '../../lib/supabase';
   import { user } from '../../lib/auth';
     
   export function Login() {
     const email = useSignal('');
     const password = useSignal('');
     
     async function handleLogin() {
       // Handle login and session storage
     }

     return (
       // Login form JSX
     );
   }
   ```

#### Implementation Tasks
1. [ ] Set up Supabase client
   - Configure environment variables
   - Initialize client
   - Set up type definitions

2. [ ] Implement secure storage
   - Configure Tauri store
   - Implement session persistence
   - Handle token refresh
   - Manage secure data

3. [ ] Create auth routes and components
   - Login page (Svelte)
   - Registration flow
   - Password reset
   - Protected route handling

4. [ ] Add Tauri integration
   - Protocol registration
   - Deep link handling
   - IPC commands
   - Window management

5. [ ] Implement OAuth flow
   - Configure providers
   - Handle redirects
   - Manage state
   - Error recovery

6. [ ] Add security features
   - Session validation
   - Token rotation
   - Secure storage
   - Error boundaries

## Shared Types

```typescript
// shared/types/auth.ts
export interface User {
  id: string
  email: string
  email_verified: boolean
  created_at: string
  last_sign_in: string
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number
  user: User
}
```

## Testing Requirements

1. Authentication Flows
   - Email/password login
   - OAuth provider login
   - Registration process
   - Password reset
   - Email verification
   - Session refresh
   - Token storage

2. Error Scenarios
   - Invalid credentials
   - Network failures
   - Token expiration
   - Offline access
   - Session conflicts

3. Security Verification
   - Token storage security
   - Session handling
   - Protected route access
   - OAuth state validation

## Next Steps

1. Start New Conversation
   ```markdown
   I need help implementing Supabase authentication in the BUI/DUI clients.
   Let's start with:
   1. Setting up the auth context
   2. Creating the login form
   3. Implementing protected routes
   ```

2. Implementation Order
   - Basic auth context
   - Login functionality
   - Protected routes
   - Registration
   - Password reset
   - Email verification
   - OAuth providers
   - Error handling
   - Loading states

3. Testing Approach
   - Unit tests for components
   - Integration tests for flows
   - E2E tests for critical paths
   - Security testing
   - Error scenario testing

## Fresh-Specific Considerations

1. Server vs Island Components
   - Use islands only for interactive auth forms
   - Keep auth state management minimal in islands
   - Handle main auth logic in routes and middleware
   - Use form submissions over client-side API calls

2. State Management
   - Use Preact signals for client-side state
   - Store auth state in cookies for server-side
   - Minimize client-side token handling
   - Keep sensitive operations server-side

3. Route Organization
   ```plaintext
   bui/
   ├── routes/
   │   ├── _middleware.ts         # Auth protection
   │   ├── auth/
   │   │   ├── login.tsx          # Login page
   │   │   ├── register.tsx       # Registration
   │   │   ├── reset.tsx          # Password reset
   │   │   └── verify.tsx         # Email verification
   │   └── protected/             # Auth required routes
   ├── islands/
   │   ├── LoginForm.tsx          # Interactive login
   │   ├── RegisterForm.tsx       # Interactive registration
   │   └── ResetForm.tsx          # Interactive reset
   └── utils/
       ├── supabase.ts            # Supabase client
       └── auth.ts                # Auth utilities
   ```

4. Performance Optimization
   - Minimize client-side JavaScript
   - Use progressive enhancement
   - Leverage Fresh's partial hydration
   - Keep auth islands lightweight

## Tauri-Specific Considerations

1. Security Architecture
   - Use Tauri's secure store for sensitive data
   - Keep auth tokens in Rust backend
   - Implement IPC commands for auth operations
   - Handle deep links securely

2. File Structure
   ```plaintext
   dui/
   ├── src/
   │   ├── lib/
   │   │   ├── supabase.ts       # Supabase client
   │   │   └── auth.ts           # Auth store & utilities
   │   ├── routes/
   │   │   └── auth/
   │   │       ├── login.tsx
   │   │       ├── register.tsx
   │   │       └── reset.tsx
   │   └── components/
   │       └── auth/
   │           ├── LoginForm.tsx
   │           └── AuthGuard.tsx
   └── src-tauri/
       ├── src/
       │   ├── main.rs           # App setup & deep links
       │   ├── commands.rs       # Auth-related commands
       │   └── store.rs          # Secure storage
       └── tauri.conf.json       # Protocol registration
   ```

3. State Management
   - Use Preact signals for UI state
   - Keep sensitive data in Rust
   - Minimize IPC calls
   - Handle offline state
   - Use computed signals for derived state
   - Batch signal updates for performance

4. Performance Considerations
   - Lazy load auth components
   - Cache necessary data
   - Optimize IPC calls
   - Handle background tasks

## Notes

1. Security Considerations
   - Secure token storage
   - Session management
   - Error handling
   - Rate limiting
   - Input validation

2. User Experience
   - Loading states
   - Error messages
   - Validation feedback
   - Success notifications
   - Redirect handling

3. Development Process
   - Start with basic flows
   - Add features incrementally
   - Test thoroughly
   - Document changes
   - Review security