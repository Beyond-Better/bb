# Stripe Integration: API Endpoints

This document outlines the API endpoints required for the Stripe integration.

## Payment Method Management

### Create Setup Intent
```typescript
POST /api/billing/payment-methods/setup
Authorization: Bearer <token>

Response: {
  clientSecret: string;  // Stripe setup intent client secret
  setupIntentId: string; // Stripe setup intent ID
}
```
- Creates a SetupIntent for securely collecting payment method details
- Used with Stripe Elements in the UI
- No request body needed; uses authenticated user context

### List Payment Methods
```typescript
GET /api/billing/payment-methods
Authorization: Bearer <token>

Response: {
  paymentMethods: [{
    id: string;           // Internal payment_method_id
    stripeId: string;     // Stripe payment method ID
    type: string;         // e.g., 'card'
    isDefault: boolean;
    card: {
      brand: string;      // e.g., 'visa'
      last4: string;
      expMonth: number;
      expYear: number;
    }
  }]
}
```
- Returns all payment methods for the authenticated user
- Ordered with default payment method first
- Includes necessary details for display

### Set Default Payment Method
```typescript
POST /api/billing/payment-methods/default
Authorization: Bearer <token>
Content-Type: application/json

Request: {
  paymentMethodId: string;  // Internal payment_method_id
}

Response: {
  success: boolean;
  message: string;
}
```
- Sets the specified payment method as default
- Updates both local and Stripe customer default
- Returns error if payment method not found

### Remove Payment Method
```typescript
DELETE /api/billing/payment-methods/:id
Authorization: Bearer <token>

Response: {
  success: boolean;
  message: string;
}
```
- Removes the specified payment method
- Cannot remove default payment method if it's the only one
- Detaches from Stripe and removes local record

## Subscription Management

### Get Available Plans
```typescript
GET /api/billing/plans
Authorization: Bearer <token>

Response: {
  plans: [{
    id: string;           // Internal plan_id
    type: string;         // 'basic' | 'usage'
    name: string;
    description: string;
    priceMonthly: number;
    features: string[];
    limits: {
      baseCost: number;
      maxCost?: number;   // For usage plans
    }
  }]
}
```
- Returns all available subscription plans
- Includes pricing and feature information
- Indicates current plan if user is subscribed

### Get Current Subscription
```typescript
GET /api/billing/subscription
Authorization: Bearer <token>

Response: {
  subscription: {
    id: string;
    planId: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    paymentMethod: {
      id: string;
      card: {
        brand: string;
        last4: string;
      }
    }
  }
}
```
- Returns current subscription details
- Includes payment method information
- Returns null if no active subscription

### Change Subscription Plan
```typescript
POST /api/billing/subscription/change
Authorization: Bearer <token>
Content-Type: application/json

Request: {
  planId: string;        // Target plan ID
  paymentMethodId?: string;  // Optional new payment method
}

Response: {
  success: boolean;
  subscription: {
    id: string;
    planId: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }
}
```
- Changes subscription to new plan
- Handles pro-rata calculations
- Updates payment method if provided

### Preview Plan Change
```typescript
POST /api/billing/subscription/preview-change
Authorization: Bearer <token>
Content-Type: application/json

Request: {
  planId: string;  // Target plan ID
}

Response: {
  proration: {
    creditAmount: number;    // Credit from current plan
    newPlanAmount: number;   // Cost of new plan
    totalDue: number;        // Final amount after proration
    prorationDate: string;
  }
}
```
- Calculates proration for plan change
- Does not make any changes
- Used to show cost preview in UI

### Cancel Subscription
```typescript
POST /api/billing/subscription/cancel
Authorization: Bearer <token>
Content-Type: application/json

Request: {
  cancelAtPeriodEnd: boolean;  // True to cancel at period end
}

Response: {
  success: boolean;
  subscription: {
    id: string;
    status: string;
    cancelAt: string | null;
  }
}
```
- Cancels subscription immediately or at period end
- Updates subscription status
- Handles any final invoices

## Usage and Billing

### Get Current Usage
```typescript
GET /api/billing/usage/current
Authorization: Bearer <token>

Response: {
  usage: {
    tokens: {
      total: number;
      byModel: {
        [modelName: string]: number;
      }
    },
    costs: {
      total: number;
      byModel: {
        [modelName: string]: number;
      }
    },
    periodStart: string;
    periodEnd: string;
  }
}
```
- Returns current billing period usage
- Breaks down by model for detailed tracking
- Includes both token and cost metrics

### Get Usage History
```typescript
GET /api/billing/usage/history
Authorization: Bearer <token>
Query Parameters:
  - startDate: string (YYYY-MM-DD)
  - endDate: string (YYYY-MM-DD)

Response: {
  usage: [{
    date: string;
    tokens: number;
    cost: number;
    models: {
      [modelName: string]: {
        tokens: number;
        cost: number;
      }
    }
  }]
}
```
- Returns historical usage data
- Daily granularity
- Optional date range filtering

### Get Payment History
```typescript
GET /api/billing/payments
Authorization: Bearer <token>
Query Parameters:
  - limit: number
  - offset: number

Response: {
  payments: [{
    id: string;
    date: string;
    amount: number;
    status: string;
    type: string;  // 'subscription' | 'token_purchase'
    paymentMethod: {
      brand: string;
      last4: string;
    }
  }],
  total: number
}
```
- Returns payment history
- Includes both subscription and token purchases
- Supports pagination

### Get Invoices
```typescript
GET /api/billing/invoices
Authorization: Bearer <token>
Query Parameters:
  - status: string  // 'paid' | 'open' | 'draft'
  - limit: number
  - offset: number

Response: {
  invoices: [{
    id: string;
    number: string;
    date: string;
    amount: number;
    status: string;
    pdfUrl: string;
  }],
  total: number
}
```
- Returns invoice history
- Includes download links for PDF versions
- Supports filtering by status

## Error Handling

All endpoints should return errors in this format:
```typescript
{
  error: {
    code: string;      // Machine-readable error code
    message: string;   // Human-readable error message
    details?: any;     // Additional error context
  }
}
```

Common error codes:
- `payment_method_required`: No payment method available
- `invalid_plan`: Plan ID not found or not available
- `subscription_required`: Operation requires active subscription
- `insufficient_funds`: Payment failed due to funding
- `rate_limit_exceeded`: Too many requests
- `invalid_request`: Malformed request data