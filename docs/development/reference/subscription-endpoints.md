# Subscription Management API Endpoints

## User Subscription Management

Edge Function: `user-subscription`

### GET /v1/user/subscription

Returns the current user's subscription details including the full plan information.

**Authentication Required**: Yes (JWT token in Authorization header)

**Response**:
```typescript
{
  subscription: {
    // Subscription fields
    subscription_id: string;
    user_id: string;
    plan_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_status: 'ACTIVE' | 'RENEWED' | 'CANCELED' | 'PENDING' | 'EXPIRED';
    subscription_period_start: string;  // ISO timestamp
    subscription_period_end: string;    // ISO timestamp
    subscription_cancel_at: string | null;
    subscription_canceled_at: string | null;
    created_at: string;
    updated_at: string;

    // Nested plan details
    plan: {
      plan_id: string;
      plan_name: string;
      plan_description: string | null;
      plan_type: 'free' | 'basic' | 'usage';
      plan_price_monthly: number | null;
      plan_price_yearly: number | null;
      plan_features: {
        features: string[];
        [key: string]: unknown;
      };
      plan_limits: {
        max_conversations?: number;
        max_storage_mb?: number;
        max_tokens_monthly?: number;
        base_tokens_monthly?: number;
        [key: string]: unknown;
      };
      plan_active: boolean;
      created_at: string;
      updated_at: string;
    }
  } | null;
  error?: string;
}
```

### POST /v1/user/subscription

Change the user's subscription to a new plan.

**Authentication Required**: Yes (JWT token in Authorization header)

**Request Body**:
```typescript
{
  planId: string;  // UUID of the new plan
  immediateChange?: boolean;  // Optional, defaults to true. For future use with scheduled changes
}
```

**Response**:
```typescript
{
  subscription: {
    // Same structure as GET response
  };
  error?: string;
}
```

**Error Codes**:
- 401: Unauthorized (missing or invalid auth token)
- 400: Invalid plan ID
- 500: Internal server error

## Public Plans Endpoint

Edge Function: `public-plans`

### GET /v1/plans

Returns list of available subscription plans. Does not require authentication.

**Authentication Required**: No

**Query Parameters**: None currently supported

**Response Sorting**:
- Plans are sorted by monthly price (ascending)
- Free plans (null price) appear first
- Only active plans are returned (plan_active = true)

**Error Cases**:
- 404: Invalid path (must be exactly '/v1/plans')
- 405: Method not allowed (only GET is supported)
- 500: Internal server error

**Response Headers**:
```typescript
{
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}
```

**Success Response** (200):
```typescript
{
  plans: Array<{
    plan_id: string;          // UUID
    plan_name: string;        // Display name
    plan_description: string | null;
    plan_type: 'free' | 'basic' | 'usage';
    plan_price_monthly: number | null;  // null for free plans
    plan_price_yearly: number | null;   // null for free plans
    plan_features: {
      features: string[];     // List of feature descriptions
      [key: string]: unknown; // Additional feature metadata
    };
    plan_limits: {
      max_conversations?: number;
      max_storage_mb?: number;
      max_tokens_monthly?: number;
      base_tokens_monthly?: number;
      [key: string]: unknown;
    };
    plan_active: boolean;     // Will always be true
    created_at: string;      // ISO timestamp
    updated_at: string;      // ISO timestamp
  }>
}
```

**Error Response** (4xx, 5xx):
```typescript
{
  error: string;  // Human-readable error message
}
```

**Example Success Response**:
```json
{
  "plans": [
    {
      "plan_id": "123e4567-e89b-12d3-a456-426614174000",
      "plan_name": "Free Tier",
      "plan_description": "Perfect for getting started",
      "plan_type": "free",
      "plan_price_monthly": null,
      "plan_price_yearly": null,
      "plan_features": {
        "features": [
          "Basic access to BB",
          "Limited monthly tokens",
          "Community support"
        ]
      },
      "plan_limits": {
        "max_conversations": 10,
        "max_storage_mb": 100,
        "max_tokens_monthly": 50000,
        "base_tokens_monthly": 50000
      },
      "plan_active": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "plan_id": "123e4567-e89b-12d3-a456-426614174001",
      "plan_name": "Pro",
      "plan_description": "For professional developers",
      "plan_type": "basic",
      "plan_price_monthly": 29.99,
      "plan_price_yearly": 299.99,
      "plan_features": {
        "features": [
          "Full access to BB",
          "Unlimited conversations",
          "Priority support",
          "Advanced tools"
        ]
      },
      "plan_limits": {
        "max_conversations": null,
        "max_storage_mb": 1000,
        "max_tokens_monthly": 500000,
        "base_tokens_monthly": 500000
      },
      "plan_active": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```
```typescript
{
  plans: {
    plan_id: string;
    plan_name: string;
    plan_description: string | null;
    plan_type: 'free' | 'basic' | 'usage';
    plan_price_monthly: number | null;
    plan_price_yearly: number | null;
    plan_features: {
      features: string[];
      [key: string]: unknown;
    };
    plan_limits: {
      max_conversations?: number;
      max_storage_mb?: number;
      max_tokens_monthly?: number;
      base_tokens_monthly?: number;
      [key: string]: unknown;
    };
    plan_active: boolean;
    created_at: string;
    updated_at: string;
  }[];
  error?: string;
}
```

## Admin Subscription Management

Edge Function: `admin-subscription`

### GET /v1/admin/users/:userId/subscription

Returns subscription details for any user.

**Authentication Required**: Yes (Admin JWT token in Authorization header)

**URL Parameters**:
- userId: string (UUID of the user)

**Response**: Same structure as user GET response

### POST /v1/admin/users/:userId/subscription

Change subscription for any user.

**Authentication Required**: Yes (Admin JWT token in Authorization header)

**URL Parameters**:
- userId: string (UUID of the user)

**Request Body**:
```typescript
{
  planId: string;  // UUID of the new plan
  immediateChange?: boolean;  // Optional, defaults to true
  // Additional admin-only fields may be added in future
}
```

**Response**: Same structure as user POST response

**Error Codes**:
- 401: Unauthorized (missing or invalid auth token)
- 403: Forbidden (valid token but not admin)
- 400: Invalid plan ID or user ID
- 404: User not found
- 500: Internal server error

## Common Error Response Format

All endpoints use a consistent error response format:

```typescript
{
  error: string;  // Human-readable error message
  details?: unknown;  // Optional additional error details
}
```

## CORS Headers

All endpoints include the following CORS headers in responses:

```typescript
{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}
```

## Examples

### Change User's Plan

```typescript
// Request
POST /v1/user/subscription
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "planId": "123e4567-e89b-12d3-a456-426614174000"
}

// Success Response
{
  "subscription": {
    "subscription_id": "123e4567-e89b-12d3-a456-426614174001",
    "subscription_status": "ACTIVE",
    "subscription_period_start": "2024-01-01T00:00:00.000Z",
    "subscription_period_end": "2024-01-31T23:59:59.999Z",
    "plan": {
      "plan_name": "Pro Plan",
      "plan_type": "basic",
      "plan_price_monthly": 29.99
      // ... other plan details
    }
    // ... other subscription details
  }
}

// Error Response
{
  "error": "Invalid plan ID provided."
}
```

### Get Available Plans

```typescript
// Request
GET /v1/plans

// Response
{
  "plans": [
    {
      "plan_id": "123e4567-e89b-12d3-a456-426614174002",
      "plan_name": "Free",
      "plan_type": "free",
      "plan_price_monthly": null,
      "plan_features": {
        "features": ["Basic Access", "Limited Storage"]
      }
    },
    {
      "plan_id": "123e4567-e89b-12d3-a456-426614174003",
      "plan_name": "Pro",
      "plan_type": "basic",
      "plan_price_monthly": 29.99,
      "plan_features": {
        "features": ["Full Access", "Unlimited Storage"]
      }
    }
  ]
}
```

## Notes

1. All timestamps are returned in ISO 8601 format
2. All IDs are UUIDs
3. Subscription periods align with calendar months
4. Plan changes take effect immediately (future: support scheduled changes)
5. Response includes full plan details for easy UI rendering