# Billing Settings Tab Restructure - API Requirements

This document outlines the new API endpoints needed to support the restructured billing settings with separate "Plans & Credits" and "Usage & History" tabs.

## **New API Endpoints Required**

### **1. Usage Analytics Endpoint**

**Endpoint:** `GET /api/v1/user/billing/usage/analytics`

**Query Parameters:**
- `period` (optional): `month` | `quarter` | `year` (defaults to `month`)

**Response Format:**
```typescript
{
  "analytics": {
    "current_month": {
      "total_cost_usd": 23.45,
      "total_requests": 2145,
      "total_tokens": 45000000,
      "period_start": "2025-01-01T00:00:00.000Z",
      "period_end": "2025-01-31T23:59:59.999Z"
    },
    "usage_trends": {
      "daily_usage": [
        {
          "date": "2025-01-01",
          "cost_usd": 1.23,
          "requests": 45,
          "tokens": 12500
        }
        // ... more daily entries for the period
      ],
      "weekly_usage": [
        {
          "week_start": "2025-01-01",
          "week_end": "2025-01-07",
          "cost_usd": 8.65,
          "requests": 315,
          "tokens": 87500
        }
        // ... more weekly entries
      ]
    },
    "model_breakdown": [
      {
        "model_name": "Claude-3.5-Sonnet",
        "provider": "Anthropic",
        "cost_usd": 15.20,
        "requests": 1245,
        "tokens": 28000000,
        "percentage_of_total": 64.8
      },
      {
        "model_name": "GPT-4o",
        "provider": "OpenAI",
        "cost_usd": 8.25,
        "requests": 900,
        "tokens": 17000000,
        "percentage_of_total": 35.2
      }
    ],
    "feature_breakdown": [
      {
        "feature_type": "chat",
        "feature_name": "Chat Conversations",
        "cost_usd": 18.50,
        "requests": 1850,
        "tokens": 38000000,
        "percentage_of_total": 78.9
      },
      {
        "feature_type": "code",
        "feature_name": "Code Generation",
        "cost_usd": 4.95,
        "requests": 295,
        "tokens": 7000000,
        "percentage_of_total": 21.1
      }
    ]
  }
}
```

**Implementation Notes:**
- Aggregate data from your usage tracking tables
- Calculate percentages based on total usage
- Support different time periods for trend analysis
- Group by model/provider for model breakdown
- Group by feature type for feature breakdown

---

### **2. Enhanced Purchase History Endpoint**

**Endpoint:** `GET /api/v1/user/billing/history/enhanced`

**Query Parameters:**
- `type` (optional): `subscription` | `credit_purchase` | `auto_topup`
- `status` (optional): `pending` | `completed` | `failed` | `refunded`
- `date_start` (optional): ISO8601 date string
- `date_end` (optional): ISO8601 date string
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 25, max: 100)

**Response Format:**
```typescript
{
  "history": {
    "transactions": [
      {
        "transaction_id": "txn_auto_123",
        "transaction_type": "auto_topup",
        "amount_usd": 20.00,
        "description": "Auto top-up purchase",
        "status": "completed",
        "created_at": "2025-01-07T10:30:00.000Z",
        "payment_method": {
          "type": "card",
          "last4": "4242",
          "brand": "visa"
        },
        "credit_details": {
          "credits_added_usd": 20.00,
          "auto_triggered": true
        }
      },
      {
        "transaction_id": "txn_sub_456",
        "transaction_type": "subscription",
        "amount_usd": 29.00,
        "description": "Beyond Plan - Monthly",
        "status": "completed",
        "created_at": "2025-01-01T09:00:00.000Z",
        "payment_method": {
          "type": "card",
          "last4": "4242",
          "brand": "visa"
        },
        "subscription_details": {
          "plan_name": "Beyond Plan",
          "period_start": "2025-01-01T00:00:00.000Z",
          "period_end": "2025-01-31T23:59:59.999Z"
        }
      },
      {
        "transaction_id": "txn_credit_789",
        "transaction_type": "credit_purchase",
        "amount_usd": 50.00,
        "description": "Manual credit purchase",
        "status": "completed",
        "created_at": "2024-12-15T14:20:00.000Z",
        "payment_method": {
          "type": "card",
          "last4": "4242",
          "brand": "visa"
        },
        "credit_details": {
          "credits_added_usd": 50.00,
          "auto_triggered": false
        }
      }
    ],
    "pagination": {
      "total_items": 45,
      "current_page": 1,
      "total_pages": 2,
      "per_page": 25
    }
  }
}
```

**Implementation Notes:**
- Combine data from subscription payments, credit purchases, and auto top-ups
- Include payment method details (sanitized)
- Support filtering by type, status, and date range
- Include pagination for large result sets
- Sort by created_at descending (most recent first)

---

## **Database Schema Considerations**

To support these endpoints, you'll likely need to track:

### **Usage Tracking Table**
```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  model_name VARCHAR NOT NULL,
  provider VARCHAR NOT NULL,
  feature_type VARCHAR NOT NULL,
  feature_name VARCHAR NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_usd DECIMAL(10,4) NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_usage_events_user_date ON usage_events (user_id, created_at);
CREATE INDEX idx_usage_events_model ON usage_events (user_id, model_name, created_at);
CREATE INDEX idx_usage_events_feature ON usage_events (user_id, feature_type, created_at);
```

### **Transaction History View**
You'll need a way to unify data from different transaction sources:
- Subscription payments from Stripe
- Credit purchases 
- Auto top-up transactions

Consider creating a unified view or table that combines:
- `subscriptions` table
- `usage_block_purchases` table  
- `auto_topup_transactions` table
- Payment method information

---

## **Implementation Priorities**

### **Phase 1: Mock Data (Current)**
The frontend now uses mock data for these endpoints. This allows immediate testing of the UI while you implement the backend.

### **Phase 2: Basic Analytics**
1. Implement `/api/v1/user/billing/usage/analytics` with basic aggregation
2. Start with current month data only
3. Add model breakdown from existing usage data

### **Phase 3: Enhanced History**
1. Implement `/api/v1/user/billing/history/enhanced` 
2. Combine existing payment/subscription data
3. Add pagination and filtering

### **Phase 4: Advanced Features**
1. Add trend analysis (daily/weekly breakdowns)
2. Implement feature-based usage tracking
3. Add export functionality
4. Optimize performance with caching

---

## **Data Sources to Integrate**

Based on the existing codebase, you'll need to aggregate data from:

1. **LLM Usage Logs**: Token counts, model usage, feature categorization
2. **Stripe Subscription Data**: Subscription payments and plan changes
3. **Usage Block Purchases**: Credit purchases and auto top-ups
4. **Payment Methods**: Card information for transaction history

---

## **Performance Considerations**

- **Caching**: Cache analytics data for recent periods
- **Aggregation**: Pre-calculate daily/monthly summaries
- **Pagination**: Limit result sets for history endpoints
- **Indexing**: Optimize database queries with proper indexes
- **Rate Limiting**: Protect expensive analytics endpoints

---

## **Testing Recommendations**

1. **Unit Tests**: Test aggregation logic with known data sets
2. **Integration Tests**: Verify end-to-end data flow
3. **Performance Tests**: Ensure endpoints respond quickly with large data sets
4. **Mock Data**: Use the provided mock data structure for consistent testing

---

## **Frontend Integration**

The frontend is already configured to call these endpoints. Once implemented:

1. Remove mock data from `useBillingState.ts`
2. Uncomment the real API calls in `loadUsageAnalytics()` and `loadPurchaseHistory()`
3. Test with real data to ensure UI handles edge cases

The restructured billing tabs are now fully implemented with:
- ✅ Separated "Plans & Credits" and "Usage & History" tabs
- ✅ Enhanced UI with better organization
- ✅ Mock data for immediate testing
- ✅ New API interfaces defined
- ✅ Comprehensive documentation for backend implementation