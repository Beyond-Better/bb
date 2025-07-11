# Feature System Integration Guide

This guide shows how to integrate the feature access system across all BB components: API, CLI, BUI, and ABI.

## 1. API Integration

### Middleware for Feature Access Control

```typescript
// api/src/middleware/featureAccessMiddleware.ts
import { Context, Next } from 'oak';
import { getFeatureAccessService } from '../services/featureAccessService.ts';

export interface FeatureAccessMiddleware {
  requiredFeature: string;
  operation?: 'read' | 'write';
  allowPartialAccess?: boolean;
}

export function requireFeature(config: FeatureAccessMiddleware) {
  return async (ctx: Context, next: Next) => {
    const userId = ctx.state.userId; // From auth middleware
    
    if (!userId) {
      ctx.response.status = 401;
      ctx.response.body = { error: 'Authentication required' };
      return;
    }

    const featureService = getFeatureAccessService();
    const access = await featureService.checkFeatureAccess(userId, config.requiredFeature);

    if (!access.access_granted) {
      ctx.response.status = 403;
      ctx.response.body = { 
        error: 'Feature access denied',
        feature: config.requiredFeature,
        reason: access.access_reason,
        upgrade_required: access.access_reason === 'plan_limit'
      };
      
      // Log the access attempt
      await featureService.logFeatureAccess(
        userId,
        config.requiredFeature,
        false,
        access.access_reason,
        {
          endpoint: ctx.request.url.pathname,
          method: ctx.request.method,
          ip: ctx.request.ip
        }
      );
      return;
    }

    // For datasource operations, check specific permissions
    if (config.operation && access.feature_value) {
      const hasOperation = access.feature_value[config.operation];
      if (!hasOperation && !config.allowPartialAccess) {
        ctx.response.status = 403;
        ctx.response.body = { 
          error: `${config.operation} access denied for ${config.requiredFeature}`,
          available_operations: Object.keys(access.feature_value).filter(k => access.feature_value[k])
        };
        return;
      }
    }

    // Store feature access in context for later use
    ctx.state.featureAccess = access;
    await next();
  };
}

// Usage in routes
// api/src/routes/models.ts
import { Router } from 'oak';
import { requireFeature } from '../middleware/featureAccessMiddleware.ts';

const router = new Router();

router.post('/models/claude/chat', 
  requireFeature({ requiredFeature: 'models.claude.sonnet' }),
  async (ctx) => {
    // Route implementation
    const access = ctx.state.featureAccess;
    // Use access.feature_value for any model-specific configuration
  }
);

router.get('/datasources/github/repos',
  requireFeature({ 
    requiredFeature: 'datasources.github',
    operation: 'read' 
  }),
  async (ctx) => {
    // Read-only GitHub access
  }
);

router.post('/datasources/github/commit',
  requireFeature({ 
    requiredFeature: 'datasources.github',
    operation: 'write' 
  }),
  async (ctx) => {
    // Write access to GitHub
  }
);
```

### Rate Limiting Integration

```typescript
// api/src/middleware/rateLimitMiddleware.ts
import { Context, Next } from 'oak';
import { getFeatureAccessService } from '../services/featureAccessService.ts';

export function rateLimitByFeature(limitType: 'tokens_per_minute' | 'requests_per_minute') {
  return async (ctx: Context, next: Next) => {
    const userId = ctx.state.userId;
    const featureService = getFeatureAccessService();
    
    const limit = await featureService.getRateLimit(userId, limitType);
    
    if (limit === 0) {
      ctx.response.status = 403;
      ctx.response.body = { error: 'Rate limiting not available in your plan' };
      return;
    }

    // Check current usage (implement your rate limiting logic here)
    const currentUsage = await getCurrentUsage(userId, limitType);
    
    if (currentUsage >= limit) {
      ctx.response.status = 429;
      ctx.response.body = { 
        error: 'Rate limit exceeded',
        limit,
        current_usage: currentUsage,
        reset_time: getResetTime()
      };
      return;
    }

    await next();
  };
}
```

## 2. CLI Integration

### Command Access Control

```typescript
// cli/src/commands/baseCommand.ts
import { Command } from 'cliffy';
import { getFeatureAccessService } from '../services/featureAccessService.ts';

export abstract class BaseCommand extends Command {
  protected requiredFeature?: string;
  protected operation?: 'read' | 'write';

  async checkFeatureAccess(userId: string): Promise<boolean> {
    if (!this.requiredFeature) return true;

    const featureService = getFeatureAccessService();
    const access = await featureService.checkFeatureAccess(userId, this.requiredFeature);

    if (!access.access_granted) {
      console.error(`❌ Feature access denied: ${this.requiredFeature}`);
      console.error(`Reason: ${access.access_reason}`);
      
      if (access.access_reason === 'plan_limit') {
        console.error('💡 Consider upgrading your plan to access this feature');
      }
      
      return false;
    }

    // Check operation-specific access
    if (this.operation && access.feature_value) {
      const hasOperation = access.feature_value[this.operation];
      if (!hasOperation) {
        console.error(`❌ ${this.operation} access denied for ${this.requiredFeature}`);
        return false;
      }
    }

    return true;
  }

  async execute(args: any): Promise<void> {
    const userId = await this.getCurrentUserId();
    
    if (!await this.checkFeatureAccess(userId)) {
      Deno.exit(1);
    }

    await this.run(args);
  }

  abstract run(args: any): Promise<void>;
  abstract getCurrentUserId(): Promise<string>;
}

// cli/src/commands/models/claudeCommand.ts
export class ClaudeCommand extends BaseCommand {
  constructor() {
    super();
    this.requiredFeature = 'models.claude.sonnet';
  }

  async run(args: any): Promise<void> {
    // Command implementation
  }
}

// cli/src/commands/datasources/githubCommand.ts
export class GitHubListCommand extends BaseCommand {
  constructor() {
    super();
    this.requiredFeature = 'datasources.github';
    this.operation = 'read';
  }

  async run(args: any): Promise<void> {
    // List GitHub repos
  }
}

export class GitHubCommitCommand extends BaseCommand {
  constructor() {
    super();
    this.requiredFeature = 'datasources.github';
    this.operation = 'write';
  }

  async run(args: any): Promise<void> {
    // Commit to GitHub
  }
}
```

### Dynamic Command Discovery

```typescript
// cli/src/commandRegistry.ts
import { getFeatureAccessService } from './services/featureAccessService.ts';

export class CommandRegistry {
  private commands: Map<string, any> = new Map();
  
  async getAvailableCommands(userId: string): Promise<string[]> {
    const featureService = getFeatureAccessService();
    const userFeatures = await featureService.getUserFeatures(userId);
    
    const availableCommands: string[] = [];
    
    for (const [commandName, command] of this.commands) {
      if (!command.requiredFeature) {
        availableCommands.push(commandName);
        continue;
      }
      
      const hasAccess = userFeatures.some(f => 
        f.feature_key === command.requiredFeature && f.access_granted
      );
      
      if (hasAccess) {
        availableCommands.push(commandName);
      }
    }
    
    return availableCommands;
  }
}
```

## 3. BUI Integration

### React Component with Feature Access

```typescript
// bui/src/components/FeatureGate.tsx
import React, { useState, useEffect } from 'react';
import { getFeatureAccessService } from '../services/featureAccessService';

interface FeatureGateProps {
  feature: string;
  operation?: 'read' | 'write';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ 
  feature, 
  operation, 
  fallback, 
  children 
}) => {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const userId = useAuth().user?.id;

  useEffect(() => {
    const checkAccess = async () => {
      if (!userId) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const featureService = getFeatureAccessService();
      const access = await featureService.checkFeatureAccess(userId, feature);
      
      let granted = access.access_granted;
      
      // Check operation-specific access
      if (granted && operation && access.feature_value) {
        granted = access.feature_value[operation] === true;
      }
      
      setHasAccess(granted);
      setLoading(false);
    };

    checkAccess();
  }, [userId, feature, operation]);

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-8 w-32 rounded"></div>;
  }

  if (!hasAccess) {
    return fallback || null;
  }

  return <>{children}</>;
};

// Usage in components
// bui/src/components/ModelSelector.tsx
export const ModelSelector: React.FC = () => {
  return (
    <div className="space-y-2">
      <FeatureGate feature="models.claude.sonnet">
        <ModelOption model="claude-sonnet" />
      </FeatureGate>
      
      <FeatureGate 
        feature="models.claude.opus"
        fallback={
          <div className="p-2 bg-gray-100 rounded text-sm text-gray-600">
            <span>Claude Opus</span>
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Upgrade Required
            </span>
          </div>
        }
      >
        <ModelOption model="claude-opus" />
      </FeatureGate>
    </div>
  );
};

// bui/src/components/DataSourcePanel.tsx
export const DataSourcePanel: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FeatureGate feature="datasources.filesystem">
        <DataSourceCard 
          name="Filesystem" 
          icon="📁"
          description="Access local files"
        />
      </FeatureGate>
      
      <FeatureGate 
        feature="datasources.github"
        operation="read"
        fallback={<UpgradeCard feature="GitHub Integration" />}
      >
        <DataSourceCard 
          name="GitHub" 
          icon="🐙"
          description="Access GitHub repositories"
        />
      </FeatureGate>
    </div>
  );
};
```

### Feature-aware Navigation

```typescript
// bui/src/components/Navigation.tsx
import { useFeatureAccess } from '../hooks/useFeatureAccess';

export const Navigation: React.FC = () => {
  const { hasFeature } = useFeatureAccess();
  
  return (
    <nav className="space-y-2">
      <NavItem href="/chat" icon="💬">Chat</NavItem>
      
      {hasFeature('models.claude.opus') && (
        <NavItem href="/advanced-chat" icon="🧠">Advanced Chat</NavItem>
      )}
      
      {hasFeature('datasources.github') && (
        <NavItem href="/github" icon="🐙">GitHub</NavItem>
      )}
      
      {hasFeature('tools.external') && (
        <NavItem href="/tools" icon="🔧">External Tools</NavItem>
      )}
      
      {hasFeature('support.priority_queue') && (
        <NavItem href="/support" icon="🎫" badge="Priority">Support</NavItem>
      )}
    </nav>
  );
};

// bui/src/hooks/useFeatureAccess.ts
import { useState, useEffect } from 'react';
import { getFeatureAccessService } from '../services/featureAccessService';

export const useFeatureAccess = () => {
  const [features, setFeatures] = useState<Map<string, boolean>>(new Map());
  const userId = useAuth().user?.id;

  const hasFeature = (featureKey: string): boolean => {
    return features.get(featureKey) || false;
  };

  const checkFeature = async (featureKey: string): Promise<boolean> => {
    if (!userId) return false;
    
    const featureService = getFeatureAccessService();
    const access = await featureService.checkFeatureAccess(userId, featureKey);
    
    setFeatures(prev => new Map(prev).set(featureKey, access.access_granted));
    return access.access_granted;
  };

  return { hasFeature, checkFeature };
};
```

## 4. ABI Edge Function Integration

### Edge Function with Feature Access

```typescript
// abi/supabase/functions/chat/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Get user from JWT
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { model, message } = await req.json();

  // Check model access
  const { data: accessData, error: accessError } = await supabase
    .rpc('check_feature_access', {
      user_id_param: user.id,
      feature_key_param: `models.${model}`
    });

  if (accessError || !accessData?.[0]?.access_granted) {
    return new Response(JSON.stringify({ 
      error: 'Model access denied',
      model,
      reason: accessData?.[0]?.access_reason || 'unknown'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check rate limits
  const { data: rateLimitData } = await supabase
    .rpc('get_cached_feature_access', {
      user_id_param: user.id,
      feature_key_param: 'limits.tokens_per_minute'
    });

  const tokenLimit = rateLimitData?.[0]?.feature_value?.limit || 0;
  
  // Implement rate limiting logic here
  const currentUsage = await getCurrentTokenUsage(user.id);
  if (currentUsage >= tokenLimit) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      limit: tokenLimit,
      current_usage: currentUsage
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Log the feature access
  await supabase.rpc('log_feature_access', {
    user_id_param: user.id,
    feature_key_param: `models.${model}`,
    access_granted_param: true,
    access_reason_param: 'plan_access',
    request_context_param: {
      function: 'chat',
      model,
      message_length: message.length
    }
  });

  // Process the chat request
  const response = await processChat(model, message);
  
  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

## 5. Admin Interface

### Feature Management Dashboard

```typescript
// bui/src/components/admin/FeatureManager.tsx
export const FeatureManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFeatures, setUserFeatures] = useState<UserFeature[]>([]);

  const loadUserFeatures = async (userId: string) => {
    const featureService = getFeatureAccessService();
    const features = await featureService.getUserFeatures(userId);
    setUserFeatures(features);
  };

  const createOverride = async (userId: string, featureKey: string, value: any) => {
    const featureService = getFeatureAccessService();
    const success = await featureService.createFeatureOverride(
      userId,
      featureKey,
      value,
      'admin_override',
      undefined,
      getCurrentAdminId()
    );
    
    if (success) {
      await loadUserFeatures(userId);
    }
  };

  return (
    <div className="flex space-x-6">
      <div className="w-1/3">
        <h3 className="text-lg font-semibold mb-4">Users</h3>
        <UserList users={users} onSelect={setSelectedUser} />
      </div>
      
      <div className="w-2/3">
        {selectedUser && (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Features for {selectedUser.email}
            </h3>
            <FeatureList 
              features={userFeatures}
              onCreateOverride={(featureKey, value) => 
                createOverride(selectedUser.id, featureKey, value)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};
```

## 6. Event Handling

### Subscription Change Events

```typescript
// api/src/webhooks/subscriptionWebhook.ts
import { getFeatureAccessService } from '../services/featureAccessService.ts';

export async function handleSubscriptionChange(event: StripeEvent) {
  const { userId, newPlanId } = event.data;
  
  const featureService = getFeatureAccessService();
  
  // Clear user's feature cache
  await featureService.clearFeatureCache(userId);
  
  // Refresh with new plan
  await featureService.refreshFeatureCache(userId);
  
  // Notify other services about the change
  await notifyServicesOfPlanChange(userId, newPlanId);
}
```

This integration guide provides a comprehensive approach to implementing feature access control across all BB components while maintaining the flexibility to update features without code changes.