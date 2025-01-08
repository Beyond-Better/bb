# BB Plan Limits Implementation

This document describes BB's plan limits structure and implementation. All plans (free, basic, and usage) use a cost-based quota system.

## Plan Limits Structure

The plan_limits JSON structure defines all limits and restrictions for a subscription plan:

```typescript
interface PlanLimits {
  quota_limits: {
    base_cost_monthly: number;     // Base monthly cost limit in USD
    max_cost_monthly?: number;     // Maximum monthly cost limit (usage plans only)
    daily_cost_limit?: number;     // Optional daily cost limit in USD
    hourly_cost_limit?: number;    // Optional hourly cost limit in USD
  };
  rate_limits: {
    requests_per_minute: number;   // Maximum requests per minute
    tokens_per_minute: number;     // Maximum tokens per minute
  };
  models?: {
    allowed_models: string[];      // List of allowed model IDs
    model_specific_limits?: {      // Optional per-model limits
      [model_id: string]: {
        requests_per_minute: number;
        tokens_per_minute: number;
      };
    };
  };
}
```

## Plan Types

### Free Plan
```json
{
  "quota_limits": {
    "base_cost_monthly": 5.00,    // $5 worth of usage
    "daily_cost_limit": 0.50      // Prevent all usage in one day
  },
  "rate_limits": {
    "requests_per_minute": 30,    // Lower rate limits
    "tokens_per_minute": 500
  }
}
```
Behavior:
- Fixed monthly cost limit ($5)
- Daily limit prevents quota exhaustion
- Service stops when any limit reached
- No rollover of unused quota
- Lower rate limits than paid plans

### Basic Plan
```json
{
  "quota_limits": {
    "base_cost_monthly": 50.00    // $50 worth of usage
  },
  "rate_limits": {
    "requests_per_minute": 60,
    "tokens_per_minute": 1000
  },
  "models": {
    "allowed_models": ["claude-3-sonnet", "claude-3-haiku"]
  }
}
```
Behavior:
- Fixed monthly cost limit ($50)
- Service stops when limit reached
- Higher rate limits than free plan
- Optional model restrictions

### Usage Plan
```json
{
  "quota_limits": {
    "base_cost_monthly": 100.00,  // Base $100 included
    "max_cost_monthly": 1000.00,  // Maximum $1000 allowed
    "daily_cost_limit": 100.00    // Optional daily limit
  },
  "rate_limits": {
    "requests_per_minute": 120,
    "tokens_per_minute": 2000
  },
  "models": {
    "allowed_models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"]
  }
}
```
Behavior:
- Base cost included in subscription
- Can exceed base up to max limit
- Additional usage billed at period end
- Highest rate limits
- Access to all models

## Implementation Details

### Cost Tracking
```sql
-- Current period usage
SELECT SUM(cost_usd) as total_cost
FROM abi_llm.token_usage
WHERE user_id = :user_id
AND request_timestamp >= :period_start
AND request_timestamp < :period_end;
```

### Rate Limit Checking
```sql
-- Requests per minute
SELECT COUNT(*) 
FROM abi_llm.provider_requests
WHERE user_id = :user_id
AND request_timestamp >= NOW() - INTERVAL '1 minute';

-- Tokens per minute
SELECT SUM(token_count)
FROM abi_llm.token_usage
WHERE user_id = :user_id
AND request_timestamp >= NOW() - INTERVAL '1 minute';
```

### Cost Limit Checking
```sql
-- Check against plan limits
WITH period_usage AS (
  SELECT SUM(cost_usd) as total_cost
  FROM abi_llm.token_usage
  WHERE user_id = :user_id
  AND request_timestamp >= :period_start
)
SELECT 
  CASE 
    WHEN total_cost >= (plan_limits->>'base_cost_monthly')::numeric 
    AND plan_type = 'basic' THEN false
    WHEN total_cost >= (plan_limits->>'max_cost_monthly')::numeric 
    AND plan_type = 'usage' THEN false
    ELSE true
  END as allowed
FROM period_usage
JOIN abi_billing.user_subscriptions us ON us.user_id = :user_id
JOIN abi_billing.subscription_plans sp ON sp.plan_id = us.plan_id;
```

## Usage Alerts

The system generates alerts when:
1. Approaching base cost limit (80%, 90%, 95%)
2. Approaching max cost limit (usage plans)
3. High daily cost rate detected
4. Unusual usage patterns detected

See [Cost Monitoring](./cost-monitoring.md) for detailed monitoring implementation.

## Plan Changes

When changing plans:
1. Basic to Basic:
   - Pro-rata based on cost limits
   - Immediate effect

2. Basic to Usage:
   - Pro-rata base cost
   - Start tracking excess immediately

3. Usage to Basic:
   - Settle any excess usage
   - Pro-rata new plan cost

See [Stripe Cost Integration](./stripe-cost-integration.md) for detailed billing implementation.

## API Integration

The API exposes cost limits and usage through:
1. Subscription endpoints
2. Usage tracking endpoints
3. Cost-specific headers

See [Cost-Based API](./cost-based-api.md) for detailed API implementation.