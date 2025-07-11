# Feature System Implementation Roadmap

## Overview

This document outlines the complete implementation plan for BB's dynamic feature access system. The system enables granular, plan-based feature permissions without requiring code modifications, supporting hierarchical inheritance, immediate plan changes, and rate limit controls.

## 🎯 Key Benefits

- **Zero Code Changes**: Update features, plans, and permissions through database configuration
- **Hierarchical Inheritance**: `models.claude.opus` automatically inherits from `models.claude` 
- **Real-time Updates**: Feature changes take effect immediately across all components
- **Performance Optimized**: Multi-level caching (application + database) for sub-100ms response times
- **Audit Trail**: Complete logging of all feature access attempts for analytics
- **Flexible Overrides**: Temporary or permanent user-specific feature access
- **Rate Limiting**: Integrated rate limits as configurable features

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        Feature Access System                   │
├────────────────────────────────────────────────────────────────┤
│  Database Layer (PostgreSQL)                                   │
│  ├── feature_definitions (hierarchy)                           │
│  ├── plan_features (plan mappings)                             │
│  ├── user_feature_overrides (custom access)                    │
│  ├── feature_access_cache (performance)                        │
│  └── feature_usage_log (analytics)                             │
├────────────────────────────────────────────────────────────────┤
│  Service Layer (TypeScript)                                    │
│  ├── FeatureAccessService (core logic)                         │
│  ├── Application cache (in-memory)                             │
│  └── Helper methods (models, datasources, rates)               │
├────────────────────────────────────────────────────────────────┤
│  Integration Layer                                             │
│  ├── API: Middleware for endpoint protection                   │
│  ├── CLI: Command access control                               │
│  ├── BUI: React components with feature gates                  │
│  └── ABI: Edge function authorization                          │
└────────────────────────────────────────────────────────────────┘
```

## 📋 Implementation Phases

### Phase 1: Database Setup (Week 1)

**Files to implement:**
- `feature_system_migration.sql` - Core schema
- `feature_system_seed_data.sql` - Initial data
- `feature_system_functions.sql` - Database functions

**Steps:**
1. Run the migration to create tables
2. Execute seed data to populate features and plans
3. Deploy database functions for core logic
4. Test basic feature resolution with SQL queries

**Testing:**
```sql
-- Test feature inheritance
SELECT * FROM abi_billing.check_feature_access(
  'user-uuid-here', 
  'models.claude.opus'
);

-- Test plan features
SELECT * FROM abi_billing.get_user_features('user-uuid-here');
```

### Phase 2: Service Layer (Week 2)

**Files to implement:**
- `feature_access_service.ts` - Core TypeScript service

**Steps:**
1. Install dependencies: `@supabase/supabase-js`
2. Implement FeatureAccessService class
3. Create singleton pattern for easy access
4. Add environment configuration
5. Build basic unit tests

**Testing:**
```typescript
// Test service initialization
const service = getFeatureAccessService(supabaseUrl, supabaseKey);

// Test feature access
const access = await service.checkFeatureAccess(userId, 'models.claude.sonnet');
console.log(access.access_granted); // true/false

// Test helper methods
const hasOpus = await service.hasModelAccess(userId, 'claude.opus');
const tokenLimit = await service.getRateLimit(userId, 'tokens_per_minute');
```

### Phase 3: API Integration (Week 3)

**Reference:** `feature_system_integration_guide.md` - Section 1

**Implementation:**
1. Create feature access middleware
2. Add rate limiting middleware 
3. Protect existing endpoints with `requireFeature()` decorator
4. Add feature access headers to responses
5. Implement webhook for subscription changes

**Key endpoints to protect:**
- `/api/v1/models/*` - Model access
- `/api/v1/datasources/*` - Data source operations
- `/api/v1/tools/*` - Tool access
- `/api/v1/chat/*` - Chat functionality

### Phase 4: CLI Integration (Week 4)

**Reference:** `feature_system_integration_guide.md` - Section 2

**Implementation:**
1. Create BaseCommand class with feature checking
2. Update existing commands to extend BaseCommand
3. Implement dynamic command discovery
4. Add feature status in `bb status` command
5. Create `bb features` command for user feature listing

**Example command updates:**
```bash
bb chat --model claude-opus    # Checks models.claude.opus
bb github commit               # Checks datasources.github + write
bb tools external             # Checks tools.external
```

### Phase 5: BUI Integration (Week 5)

**Reference:** `feature_system_integration_guide.md` - Section 3

**Implementation:**
1. Create FeatureGate React component
2. Add useFeatureAccess hook
3. Update model selector with feature gates
4. Add upgrade prompts for restricted features
5. Create feature-aware navigation
6. Build admin feature management interface

**UI Elements:**
- Model selector with disabled/upgrade options
- Datasource cards with permission indicators
- Feature usage dashboard
- Plan comparison table
- Upgrade call-to-action components

### Phase 6: ABI Integration (Week 6)

**Reference:** `feature_system_integration_guide.md` - Section 4

**Implementation:**
1. Add feature checking to existing edge functions
2. Create reusable auth + feature validation
3. Implement rate limiting at edge function level
4. Add feature access logging
5. Create feature status endpoint

**Critical edge functions:**
- Chat processing functions
- Model inference functions
- Data source connector functions
- Tool execution functions

## 🚀 Getting Started

### 1. Database Setup

```sql
-- Run in your Supabase SQL editor
\i feature_system_migration.sql
\i feature_system_seed_data.sql
\i feature_system_functions.sql
```

### 2. Environment Configuration

```typescript
// In your .env files
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Service Integration

```typescript
// In your application startup
import { getFeatureAccessService } from './services/featureAccessService';

const featureService = getFeatureAccessService(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### 4. Quick Testing

```typescript
// Test user's access to Claude Opus
const userId = 'user-uuid-from-auth';
const access = await featureService.checkFeatureAccess(userId, 'models.claude.opus');

if (access.access_granted) {
  console.log('✅ User has Claude Opus access');
} else {
  console.log('❌ Access denied:', access.access_reason);
}
```

## 🔧 Common Operations

### Adding a New Feature

```sql
-- Add new feature to hierarchy
INSERT INTO abi_billing.feature_definitions (
  feature_key, 
  feature_name, 
  feature_description, 
  feature_type, 
  parent_feature_id, 
  feature_category
) VALUES (
  'models.gemini.pro', 
  'Gemini Pro', 
  'Access to Google Gemini Pro model', 
  'access', 
  (SELECT feature_id FROM abi_billing.feature_definitions WHERE feature_key = 'models.gemini'), 
  'models'
);

-- Add to plans
INSERT INTO abi_billing.plan_features (plan_id, feature_id, feature_value) VALUES (
  (SELECT plan_id FROM abi_billing.subscription_plans WHERE plan_name = 'Advanced'),
  (SELECT feature_id FROM abi_billing.feature_definitions WHERE feature_key = 'models.gemini.pro'),
  '{"enabled": true}'
);
```

### Updating Rate Limits

```sql
-- Update token limit for Professional plan
UPDATE abi_billing.plan_features 
SET feature_value = '{"limit": 2000000}'
WHERE plan_id = (SELECT plan_id FROM abi_billing.subscription_plans WHERE plan_name = 'Professional')
AND feature_id = (SELECT feature_id FROM abi_billing.feature_definitions WHERE feature_key = 'limits.tokens_per_minute');
```

### Creating User Overrides

```sql
-- Give user temporary access to Claude Opus for 30 days
SELECT abi_billing.create_feature_override(
  'user-uuid-here',
  'models.claude.opus',
  '{"enabled": true}',
  'support_access',
  NOW() + INTERVAL '30 days',
  'admin-uuid-here'
);
```

### Refreshing Cache After Changes

```sql
-- Clear cache for all users after plan changes
DELETE FROM abi_billing.feature_access_cache;

-- Or refresh specific user
SELECT abi_billing.refresh_feature_cache('user-uuid-here');
```

## 📊 Monitoring and Analytics

### Feature Usage Analytics

```sql
-- Most requested features
SELECT 
  feature_key,
  COUNT(*) as requests,
  SUM(CASE WHEN access_granted THEN 1 ELSE 0 END) as granted,
  SUM(CASE WHEN access_granted THEN 0 ELSE 1 END) as denied
FROM abi_billing.feature_usage_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY feature_key
ORDER BY requests DESC;

-- Users hitting limits
SELECT 
  user_id,
  feature_key,
  COUNT(*) as denied_requests
FROM abi_billing.feature_usage_log
WHERE access_granted = false
AND access_reason = 'plan_limit'
AND created_at >= NOW() - INTERVAL '1 day'
GROUP BY user_id, feature_key
ORDER BY denied_requests DESC;
```

### Performance Monitoring

```sql
-- Cache hit rate
SELECT 
  COUNT(*) as total_requests,
  COUNT(CASE WHEN from_cache THEN 1 END) as cache_hits,
  ROUND(COUNT(CASE WHEN from_cache THEN 1 END) * 100.0 / COUNT(*), 2) as hit_rate
FROM abi_billing.feature_access_cache
WHERE created_at >= NOW() - INTERVAL '1 hour';
```

## 🔒 Security Considerations

### Row Level Security Policies

```sql
-- Enable RLS on feature tables
ALTER TABLE abi_billing.feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE abi_billing.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE abi_billing.user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Users can only see their own overrides
CREATE POLICY "Users can view own overrides" ON abi_billing.user_feature_overrides
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage all overrides
CREATE POLICY "Admins can manage overrides" ON abi_billing.user_feature_overrides
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

### API Security

```typescript
// Validate feature keys to prevent injection
const VALID_FEATURE_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

if (!VALID_FEATURE_PATTERN.test(featureKey)) {
  throw new Error('Invalid feature key format');
}
```

## 🎓 Best Practices

### Feature Naming Convention

```
models.{provider}.{model}     # models.claude.opus
datasources.{type}.{action}   # datasources.github.write
tools.{category}              # tools.external
limits.{type}                 # limits.tokens_per_minute
features.{name}               # features.early_access
support.{level}               # support.priority_queue
```

### Caching Strategy

1. **Application Cache**: 5-minute TTL for high-frequency checks
2. **Database Cache**: 1-hour TTL for computed results
3. **Cache Invalidation**: Immediate on subscription changes
4. **Cache Warming**: Proactive refresh for active users

### Error Handling

```typescript
// Always provide graceful fallbacks
try {
  const access = await service.checkFeatureAccess(userId, feature);
  return access.access_granted;
} catch (error) {
  // Log error but don't block functionality
  console.error('Feature access check failed:', error);
  return false; // Fail closed for security
}
```

## 📈 Future Enhancements

### Phase 7: Advanced Features (Future)

1. **A/B Testing**: Feature flags for gradual rollouts
2. **Usage-based Limits**: Dynamic limits based on consumption
3. **Team-level Features**: Organization and team-specific permissions
4. **Feature Analytics**: Advanced usage insights and recommendations
5. **Self-service Upgrades**: Automated plan upgrades based on usage patterns

### Integration with External Systems

1. **Stripe Integration**: Automatic plan sync
2. **Analytics Platforms**: Usage data export
3. **Support Systems**: Feature context in support tickets
4. **Monitoring**: Alerts for unusual feature access patterns

## 🤝 Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review feature usage analytics
2. **Monthly**: Clean up expired overrides and old cache entries
3. **Quarterly**: Review and optimize feature hierarchy
4. **Annually**: Audit feature definitions and plan mappings

### Troubleshooting Common Issues

1. **Cache Misses**: Check cache expiration and refresh patterns
2. **Inheritance Problems**: Verify parent-child relationships
3. **Performance Issues**: Monitor query performance and add indexes
4. **Plan Sync Issues**: Ensure subscription webhooks are working

This roadmap provides a complete implementation path for BB's feature access system, enabling dynamic, configuration-driven feature management across all components while maintaining high performance and security standards.