# Feature Access Design: Two-Level Control System

## Overview

The BB feature system uses a **two-level control system** to determine feature access, providing both performance optimization and granular control.

## Two-Level Architecture

### Level 1: `is_enabled` (Database Column)
- **Type**: `boolean` (indexed for performance)
- **Purpose**: Coarse-grained on/off switch at the table level
- **Use Case**: Quick performance filtering and plan-level kill switches
- **Example**: Completely disable a feature for a plan

### Level 2: `feature_value.enabled` (JSON Field)
- **Type**: `jsonb->>'enabled'` (boolean within JSON)
- **Purpose**: Fine-grained feature configuration and permissions
- **Use Case**: Complex feature logic with additional parameters
- **Example**: Enable with specific limitations or configurations

## Access Determination Logic

**Both conditions must be true for access to be granted:**

```sql
WHERE pf.is_enabled = true                                    -- Level 1: Table-level switch
AND coalesce((pf.feature_value->>'enabled')::boolean, false) = true  -- Level 2: JSON-level control
```

## When to Use Each Level

### Use `is_enabled = false` When:
- **Performance**: Need fast filtering without JSON parsing
- **Plan-level Disable**: Completely turn off feature for entire plan
- **Emergency Kill Switch**: Quickly disable problematic features
- **Bulk Operations**: Mass enable/disable without touching JSON

### Use `feature_value.enabled = false` When:
- **Complex Logic**: Feature has additional configuration parameters
- **Conditional Access**: Access depends on other JSON fields
- **Granular Control**: Need more than simple on/off
- **Future Flexibility**: May need additional parameters later

## Examples by Feature Type

### Simple Access Features
```sql
-- Basic model access
{
  "is_enabled": true,
  "feature_value": {"enabled": true}
}
```

### Complex Configuration Features
```sql
-- Datasource with read/write permissions
{
  "is_enabled": true,
  "feature_value": {
    "enabled": true,
    "read": true,
    "write": false
  }
}
```

### Rate Limit Features
```sql
-- Rate limits with specific values
{
  "is_enabled": true,
  "feature_value": {
    "enabled": true,
    "limit": 1000
  }
}
```

### Disabled Features
```sql
-- Table-level disabled (fastest check)
{
  "is_enabled": false,
  "feature_value": {"enabled": false}
}

-- OR JSON-level disabled (with explanation)
{
  "is_enabled": true,
  "feature_value": {
    "enabled": false,
    "reason": "upgrade_required",
    "upgrade_url": "/plans/advanced"
  }
}
```

## Performance Characteristics

### Database Query Performance
```sql
-- FAST: Uses indexed boolean column first
WHERE pf.is_enabled = true 
AND pf.feature_value->>'enabled' = 'true'

-- SLOW: JSON parsing without index filter
WHERE pf.feature_value->>'enabled' = 'true'
```

### Index Strategy
```sql
-- Compound index for optimal performance
CREATE INDEX idx_plan_features_enabled_lookup 
ON abi_core.plan_features (plan_id, feature_id, is_enabled);

-- JSON index for complex queries
CREATE INDEX idx_plan_features_json_enabled 
ON abi_core.plan_features USING gin ((feature_value->>'enabled'));
```

## Consistent Patterns

### Seed Data Pattern
```sql
-- Always set both fields consistently
INSERT INTO abi_core.plan_features (plan_id, feature_id, feature_value, is_enabled)
VALUES (
  plan_id,
  feature_id,
  '{"enabled": true, "additional": "config"}',
  true  -- Must match feature_value.enabled
);
```

### Application Code Pattern
```typescript
// Service layer checks both levels
const hasAccess = result.access_granted; // From RPC that checks both

// Manual check pattern (if needed)
const isTableEnabled = planFeature.is_enabled;
const isJsonEnabled = planFeature.feature_value?.enabled === true;
const hasAccess = isTableEnabled && isJsonEnabled;
```

## Migration Strategy

### Current State Issues
1. ❌ Seed data only sets `feature_value.enabled`
2. ❌ RPC functions only check `is_enabled`
3. ❌ Inconsistent data in database

### Fixed Implementation
1. ✅ RPC functions check both levels
2. ✅ Seed data sets both fields consistently
3. ✅ Clear documentation of the pattern

## Best Practices

### For New Features
1. **Always set both fields** in seed data
2. **Use `is_enabled = true`** unless you need a kill switch
3. **Put complex logic in `feature_value`**
4. **Default to `{"enabled": true}` for simple features**

### For Feature Updates
1. **Update both fields together** when changing access
2. **Use `is_enabled = false` for emergency disables**
3. **Use `feature_value.enabled = false` for business logic disables**
4. **Consider performance impact** of JSON queries

### For Database Queries
1. **Always filter by `is_enabled` first** for performance
2. **Add JSON conditions after** boolean filter
3. **Use appropriate indexes** for query patterns
4. **Consider query plan** for complex JSON logic

## Common Patterns

### Emergency Disable
```sql
-- Quick disable without changing configuration
UPDATE abi_core.plan_features 
SET is_enabled = false 
WHERE feature_id = (SELECT feature_id FROM abi_core.feature_definitions WHERE feature_key = 'models.claude.opus');
```

### Gradual Rollout
```sql
-- Enable table-level, control via JSON
UPDATE abi_core.plan_features 
SET is_enabled = true,
    feature_value = jsonb_set(feature_value, '{enabled}', 'false')
WHERE plan_id = basic_plan_id;
```

### Complex Configuration
```sql
-- Rich feature configuration
UPDATE abi_core.plan_features 
SET is_enabled = true,
    feature_value = '{
      "enabled": true,
      "read": true,
      "write": false,
      "rate_limit": 100,
      "expires_at": "2024-12-31T23:59:59Z"
    }'
WHERE feature_key = 'datasources.github';
```

## Monitoring and Debugging

### Check for Inconsistencies
```sql
-- Find mismatched boolean states
SELECT pf.*, fd.feature_key
FROM abi_core.plan_features pf
JOIN abi_core.feature_definitions fd ON pf.feature_id = fd.feature_id
WHERE pf.is_enabled != coalesce((pf.feature_value->>'enabled')::boolean, false);
```

### Performance Analysis
```sql
-- Query performance with EXPLAIN
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM abi_core.plan_features pf
WHERE pf.is_enabled = true 
AND pf.feature_value->>'enabled' = 'true';
```

### Feature Access Testing
```sql
-- Test access for specific user/feature
SELECT * FROM abi_core.check_feature_access(
  'user-uuid-here',
  'models.claude.opus'
);
```

This two-level system provides both the performance benefits of indexed boolean columns and the flexibility of JSON configuration, making it robust for current needs and future expansion.