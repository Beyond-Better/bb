# Feature System Usage Examples

This document shows how to use the refactored feature system across different contexts with proper Supabase client injection.

## Key Changes

- **Before**: Environment-based client creation
- **After**: Explicit client injection for maximum flexibility
- **Benefits**: Multi-user support, context-aware clients, better testing

## API Usage

### Basic API Route with Features

```typescript
// api/src/routes/models.ts
import { SessionManager } from '../auth/session.ts';
import { ModelAccess, requireModelAccess } from '../../../src/shared/utils/features.utils.ts';

export class ModelsController {
  constructor(private sessionManager: SessionManager) {}

  async handleClaudeOpusRequest(req: Request, res: Response) {
    try {
      // Get authenticated user
      const session = await this.sessionManager.getSession();
      if (!session?.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get Supabase client
      const supabaseClient = this.sessionManager.getClient();
      
      // Check feature access
      const hasAccess = await ModelAccess.hasClaudeOpus(supabaseClient, session.user.id);
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Claude Opus requires Advanced plan or higher',
          upgradeUrl: '/upgrade'
        });
      }

      // Process request
      const result = await this.processClaudeOpusRequest(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error in Claude Opus request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

### API Middleware Pattern

```typescript
// api/src/middleware/featureGuard.ts
import { SessionManager } from '../auth/session.ts';
import { requireModelAccess, requireDatasourceAccess } from '../../../src/shared/utils/features.utils.ts';

export const createFeatureGuard = (sessionManager: SessionManager) => {
  return {
    // Model access middleware
    requireModel: (modelKey: string) => {
      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          const session = await sessionManager.getSession();
          if (!session?.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
          }

          const supabaseClient = sessionManager.getClient();
          await requireModelAccess(modelKey)(supabaseClient, session.user.id);
          next();
        } catch (error) {
          res.status(403).json({ error: error.message });
        }
      };
    },

    // Datasource access middleware
    requireDatasource: (datasourceKey: string, operation: 'read' | 'write' = 'read') => {
      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          const session = await sessionManager.getSession();
          if (!session?.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
          }

          const supabaseClient = sessionManager.getClient();
          await requireDatasourceAccess(datasourceKey, operation)(supabaseClient, session.user.id);
          next();
        } catch (error) {
          res.status(403).json({ error: error.message });
        }
      };
    }
  };
};

// Usage in routes
const featureGuard = createFeatureGuard(sessionManager);

app.use('/api/models/claude-opus', featureGuard.requireModel('claude.opus'));
app.use('/api/datasources/github', featureGuard.requireDatasource('github', 'write'));
```

### API Service Pattern

```typescript
// api/src/services/chatService.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { ModelAccess, RateLimits } from '../../../src/shared/utils/features.utils.ts';

export class ChatService {
  constructor(private supabaseClient: SupabaseClient, private userId: string) {}

  async processChat(message: string, modelKey: string) {
    // Check model access
    const hasModelAccess = await ModelAccess.hasModel(this.supabaseClient, this.userId, modelKey);
    if (!hasModelAccess) {
      throw new Error(`Model ${modelKey} is not available on your plan`);
    }

    // Check rate limits
    const tokenLimit = await RateLimits.getTokensPerMinute(this.supabaseClient, this.userId);
    const requestLimit = await RateLimits.getRequestsPerMinute(this.supabaseClient, this.userId);
    
    // Validate against limits
    if (message.length > tokenLimit) {
      throw new Error(`Message too long. Limit: ${tokenLimit} tokens`);
    }

    // Process chat
    return await this.callLLMModel(modelKey, message);
  }

  private async callLLMModel(modelKey: string, message: string) {
    // Implementation
  }
}

// Usage in controller
export class ChatController {
  constructor(private sessionManager: SessionManager) {}

  async handleChat(req: Request, res: Response) {
    const session = await this.sessionManager.getSession();
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseClient = this.sessionManager.getClient();
    const chatService = new ChatService(supabaseClient, session.user.id);
    
    try {
      const result = await chatService.processChat(req.body.message, req.body.model);
      res.json(result);
    } catch (error) {
      res.status(403).json({ error: error.message });
    }
  }
}
```

## BUI Usage

### Server-Side BUI (Islands/Routes)

```typescript
// bui/src/routes/models.tsx
import { useAuthState } from '../hooks/useAuthStateSupabase.ts';
import { ModelAccess, getUserFeatureProfile } from '../../../src/shared/utils/features.utils.ts';

export default function ModelsPage(props: { request: Request }) {
  const { getServerClient, getSessionUser } = useAuthState();
  
  return (
    <div>
      <ModelSelector request={props.request} />
    </div>
  );
}

const ModelSelector = async ({ request }: { request: Request }) => {
  const { getServerClient, getSessionUser } = useAuthState();
  
  // Create response object for server client
  const response = new Response();
  
  // Get authenticated user
  const { user, error } = await getSessionUser(request, response);
  if (error || !user) {
    return <div>Please log in to access models</div>;
  }

  // Get server client
  const supabaseClient = getServerClient(request, response);
  if (!supabaseClient) {
    return <div>Authentication required</div>;
  }

  // Get user's available models
  const availableModels = await ModelAccess.getAvailableModels(supabaseClient, user.id);
  
  return (
    <div>
      <h2>Available Models</h2>
      <ul>
        {availableModels.map(model => (
          <li key={model}>
            <button onClick={() => selectModel(model)}>
              {model}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### Client-Side BUI (Interactive Components)

```typescript
// bui/src/components/FeatureGate.tsx
import { useEffect, useState } from 'preact/hooks';
import { useAuthState } from '../hooks/useAuthStateSupabase.ts';
import { checkFeatureAccess } from '../../../src/shared/utils/features.utils.ts';

interface FeatureGateProps {
  feature: string;
  userId: string;
  children: any;
  fallback?: any;
}

export function FeatureGate({ feature, userId, children, fallback }: FeatureGateProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const { getBrowserClient } = useAuthState();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const supabaseClient = getBrowserClient();
        if (!supabaseClient) {
          setHasAccess(false);
          return;
        }

        const access = await checkFeatureAccess(supabaseClient, userId, feature);
        setHasAccess(access);
      } catch (error) {
        console.error('Error checking feature access:', error);
        setHasAccess(false);
      }
    };

    checkAccess();
  }, [feature, userId]);

  if (hasAccess === null) {
    return <div>Loading...</div>;
  }

  if (!hasAccess) {
    return fallback || <div>Feature not available on your plan</div>;
  }

  return children;
}

// Usage
export function ExternalToolsPanel({ userId }: { userId: string }) {
  return (
    <FeatureGate
      feature="tools.external"
      userId={userId}
      fallback={<UpgradePrompt feature="External Tools" />}
    >
      <div>
        <h3>External Tools</h3>
        <ExternalToolsList />
      </div>
    </FeatureGate>
  );
}
```

### BUI Dashboard Component

```typescript
// bui/src/components/UserDashboard.tsx
import { useEffect, useState } from 'preact/hooks';
import { useAuthState } from '../hooks/useAuthStateSupabase.ts';
import { getUserFeatureProfile } from '../../../src/shared/utils/features.utils.ts';

export function UserDashboard({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { getBrowserClient } = useAuthState();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabaseClient = getBrowserClient();
        if (!supabaseClient) {
          setLoading(false);
          return;
        }

        const userProfile = await getUserFeatureProfile(supabaseClient, userId);
        setProfile(userProfile);
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  if (loading) {
    return <div>Loading your features...</div>;
  }

  if (!profile) {
    return <div>Unable to load features</div>;
  }

  return (
    <div className="user-dashboard">
      <h2>Your Features</h2>
      
      <div className="feature-section">
        <h3>Available Models</h3>
        <div className="feature-grid">
          {profile.models.map((model: string) => (
            <div key={model} className="feature-card">
              <span className="feature-name">{model}</span>
              <span className="feature-status">✓ Available</span>
            </div>
          ))}
        </div>
      </div>

      <div className="feature-section">
        <h3>Data Sources</h3>
        <div className="feature-grid">
          {profile.datasources.map((ds: any) => (
            <div key={ds.name} className="feature-card">
              <span className="feature-name">{ds.name}</span>
              <span className="feature-permissions">
                {ds.read && '📖'} {ds.write && '✏️'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="feature-section">
        <h3>Rate Limits</h3>
        <div className="limits-display">
          <div>Tokens/minute: {profile.limits.tokensPerMinute.toLocaleString()}</div>
          <div>Requests/minute: {profile.limits.requestsPerMinute}</div>
        </div>
      </div>
    </div>
  );
}
```

## CLI Usage

```typescript
// cli/src/commands/chat.ts
import { SessionManager } from '../auth/session.ts';
import { ModelAccess, RateLimits } from '../../../src/shared/utils/features.utils.ts';

export class ChatCommand {
  constructor(private sessionManager: SessionManager) {}

  async execute(args: { model: string; message: string }) {
    try {
      // Get authenticated session
      const session = await this.sessionManager.getSession();
      if (!session?.user?.id) {
        console.error('Please log in first: bb auth login');
        process.exit(1);
      }

      // Get Supabase client
      const supabaseClient = this.sessionManager.getClient();
      
      // Check model access
      const hasAccess = await ModelAccess.hasModel(supabaseClient, session.user.id, args.model);
      if (!hasAccess) {
        console.error(`Model '${args.model}' is not available on your plan`);
        console.log('Available models:');
        
        const availableModels = await ModelAccess.getAvailableModels(supabaseClient, session.user.id);
        availableModels.forEach(model => console.log(`  - ${model}`));
        
        process.exit(1);
      }

      // Check rate limits
      const tokenLimit = await RateLimits.getTokensPerMinute(supabaseClient, session.user.id);
      const requestLimit = await RateLimits.getRequestsPerMinute(supabaseClient, session.user.id);
      
      console.log(`Rate limits: ${tokenLimit} tokens/min, ${requestLimit} requests/min`);

      // Process chat
      const result = await this.processChat(args.model, args.message);
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  private async processChat(model: string, message: string) {
    // Implementation
    return `Response from ${model}: ${message}`;
  }
}
```

## Testing

### Unit Tests

```typescript
// tests/features.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/testing/asserts.ts';
import { createClient } from '@supabase/supabase-js';
import { ModelAccess } from '../src/shared/utils/features.utils.ts';

Deno.test('ModelAccess.hasClaudeOpus', async () => {
  // Create test client
  const supabaseClient = createClient(
    'https://test.supabase.co',
    'test-key',
    {
      auth: { persistSession: false }
    }
  );

  // Mock user with Basic plan (no Opus access)
  const userId = 'test-user-id';
  
  // Test access
  const hasAccess = await ModelAccess.hasClaudeOpus(supabaseClient, userId);
  assertEquals(hasAccess, false);
});
```

### Integration Tests

```typescript
// tests/integration/api.test.ts
import { SessionManager } from '../../api/src/auth/session.ts';
import { ModelsController } from '../../api/src/routes/models.ts';

Deno.test('API: Claude Opus access check', async () => {
  const sessionManager = new SessionManager();
  await sessionManager.initialize();
  
  const controller = new ModelsController(sessionManager);
  
  // Test with authenticated user
  const req = new Request('http://localhost/api/models/claude-opus', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer test-token' }
  });
  
  const res = new Response();
  await controller.handleClaudeOpusRequest(req, res);
  
  // Assert response
  assertEquals(res.status, 403); // Assuming test user doesn't have access
});
```

## Migration from Old System

### Before (Environment-based)

```typescript
// OLD - Don't use this pattern
const featureService = getFeatureAccessService(); // Magic environment lookup
const hasAccess = await featureService.hasModelAccess(userId, 'claude.opus');
```

### After (Client injection)

```typescript
// NEW - Explicit client injection
const supabaseClient = sessionManager.getClient(); // or getBrowserClient()
const hasAccess = await ModelAccess.hasClaudeOpus(supabaseClient, userId);
```

## Best Practices

### 1. Error Handling

```typescript
// Always handle errors gracefully
try {
  const hasAccess = await ModelAccess.hasClaudeOpus(supabaseClient, userId);
  if (!hasAccess) {
    // Show upgrade prompt
    return <UpgradePrompt feature="Claude Opus" />;
  }
} catch (error) {
  console.error('Feature check failed:', error);
  // Fail closed for security
  return <div>Feature unavailable</div>;
}
```

### 2. Caching

```typescript
// The service handles caching automatically
// But you can refresh when needed
await CacheManagement.refreshCache(supabaseClient, userId);
```

### 3. Multi-User Support

```typescript
// API can handle multiple users
const getUserFeatures = async (userId: string) => {
  const supabaseClient = sessionManager.getClient();
  return await getUserFeatureProfile(supabaseClient, userId);
};
```

### 4. Type Safety

```typescript
// Use the exported types
import type { FeatureAccessResult } from '../../docs/development/plans/feature-system/feature_access_service.ts';

const checkAccess = async (): Promise<FeatureAccessResult> => {
  const supabaseClient = getBrowserClient();
  return await getFeatureAccess(supabaseClient, userId, 'models.claude.opus');
};
```

This refactored approach provides maximum flexibility while maintaining security and performance. Each context can provide its own authenticated Supabase client, enabling proper multi-user support and clean separation of concerns.