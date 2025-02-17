# Cost-Based API Implementation

This document outlines the API changes and additions needed to support BB's cost-based subscription system.

## API Endpoints

### GET /v1/user/subscription
Returns current subscription status including cost information.

```typescript
interface SubscriptionResponse {
  subscription: {
    subscription_id: string;
    plan_id: string;
    plan_type: 'free' | 'basic' | 'usage';
    status: 'ACTIVE' | 'CANCELED' | 'PENDING' | 'EXPIRED';
    
    // Cost Information
    base_cost_monthly: number;
    current_cost: number;
    remaining_cost: number;
    max_cost_limit?: number;  // For usage plans
    
    // Period Information
    period_start: string;     // ISO timestamp
    period_end: string;       // ISO timestamp
    
    // Usage Information
    current_usage_breakdown: {
      model_name: string;
      cost: number;
      token_count: number;
    }[];
    
    // Payment Information
    payment_method?: {
      type: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    };
  };
  error?: string;
}
```

### POST /v1/user/subscription/change
Change subscription plan with cost-based calculations.

```typescript
interface PlanChangeRequest {
  plan_id: string;
  immediate?: boolean;  // Default true
}

interface PlanChangeResponse {
  success: boolean;
  subscription_id: string;
  
  // Cost Calculations
  current_plan_remaining: number;  // Pro-rata credit
  new_plan_charge: number;        // Pro-rated new plan cost
  usage_charges?: number;         // For usage plan changes
  total_charge: number;           // Final amount to charge
  
  // Timing
  effective_date: string;         // When change takes effect
  next_billing_date: string;      // Next regular billing date
  
  error?: string;
}
```

### GET /v1/user/subscription/preview
Preview cost changes for plan change.

```typescript
interface PlanChangePreview {
  current_plan: {
    cost_monthly: number;
    days_remaining: number;
    credit_amount: number;
  };
  new_plan: {
    cost_monthly: number;
    prorated_amount: number;
  };
  usage_charges?: {
    current_usage: number;
    estimated_final: number;
  };
  total_charge: number;
  effective_date: string;
}
```

### GET /v1/user/usage
Get detailed usage and cost information.

```typescript
interface UsageResponse {
  period_start: string;
  period_end: string;
  
  costs: {
    total: number;
    by_model: {
      model_name: string;
      cost: number;
      token_count: number;
    }[];
    by_day: {
      date: string;
      cost: number;
      token_count: number;
    }[];
  };
  
  limits: {
    base_cost: number;
    max_cost?: number;
    remaining_cost: number;
  };
}
```

## Error Responses

### Cost-Related Errors
```typescript
interface CostError {
  error: {
    code: string;
    message: string;
    details?: {
      current_cost?: number;
      limit?: number;
      remaining?: number;
    };
  };
}

// Example Errors
{
  error: {
    code: 'cost_limit_exceeded',
    message: 'Monthly cost limit exceeded',
    details: {
      current_cost: 55.20,
      limit: 50.00,
      remaining: 0
    }
  }
}

{
  error: {
    code: 'insufficient_funds',
    message: 'Insufficient funds for plan change',
    details: {
      required_amount: 45.00
    }
  }
}
```

## Response Headers

Cost-related information included in response headers:

```typescript
{
  'BB-Cost-Remaining': string;     // Remaining cost limit
  'BB-Cost-Used': string;          // Cost used this period
  'BB-Cost-Reset': string;         // Next reset date ISO timestamp
}
```

## Webhook Events

New webhook events for cost tracking:

```typescript
interface CostWebhookEvent {
  type: 'cost.limit.approaching' | 'cost.limit.exceeded';
  data: {
    user_id: string;
    subscription_id: string;
    current_cost: number;
    limit: number;
    percentage_used: number;
    period_end: string;
  };
}
```

## Integration Points

### Frontend Requirements
1. Display current cost usage:
   ```typescript
   // Component props
   interface CostDisplayProps {
     currentCost: number;
     baseLimit: number;
     maxLimit?: number;
     resetDate: string;
   }
   ```

2. Plan change workflow:
   ```typescript
   async function handlePlanChange(planId: string) {
     // 1. Get preview
     const preview = await api.getChangePreview(planId);
     
     // 2. Show confirmation with costs
     await showConfirmation({
       currentCredit: preview.current_plan.credit_amount,
       newCharge: preview.new_plan.prorated_amount,
       totalCharge: preview.total_charge,
       effectiveDate: preview.effective_date
     });
     
     // 3. Process change
     const result = await api.changePlan(planId);
     
     // 4. Handle result
     if (result.success) {
       showSuccess(result);
     } else {
       handleError(result.error);
     }
   }
   ```

3. Usage displays:
   ```typescript
   interface UsageDisplayProps {
     costs: {
       current: number;
       limit: number;
       remaining: number;
     };
     breakdown: {
       model: string;
       cost: number;
       tokens: number;
     }[];
     history: {
       date: string;
       cost: number;
     }[];
   }
   ```

### Error Handling
1. Cost limit errors:
   ```typescript
   function handleCostError(error: CostError) {
     if (error.code === 'cost_limit_exceeded') {
       showLimitExceededDialog({
         current: error.details.current_cost,
         limit: error.details.limit,
         resetDate: getNextResetDate()
       });
     }
   }
   ```

2. Payment errors:
   ```typescript
   function handlePaymentError(error: PaymentError) {
     switch (error.code) {
       case 'insufficient_funds':
         showPaymentDialog(error.details.required_amount);
         break;
       case 'payment_failed':
         handleFailedPayment(error);
         break;
     }
   }
   ```

## Implementation Steps

1. Database Updates
   - Add cost tracking views
   - Update subscription queries
   - Add cost calculation functions

2. API Implementation
   - Add new endpoints
   - Update existing endpoints
   - Add cost-related headers
   - Implement error handling

3. Frontend Updates
   - Add cost displays
   - Update plan change flow
   - Add usage visualizations
   - Implement error handling

4. Testing
   - Test all API endpoints
   - Verify cost calculations
   - Test error scenarios
   - Validate webhook handling

## Monitoring

1. Cost Tracking
   - Monitor cost calculation accuracy
   - Track usage patterns
   - Alert on unusual activity

2. API Performance
   - Monitor response times
   - Track error rates
   - Monitor webhook processing

3. User Experience
   - Track plan change success rates
   - Monitor error frequencies
   - Track usage pattern changes

## Future Considerations

1. Advanced Cost Analytics
   - Cost forecasting
   - Usage optimization suggestions
   - Cost breakdown analysis

2. Bulk Operations
   - Batch cost calculations
   - Organization-wide usage tracking
   - Team cost allocation

3. Cost Optimization
   - Model selection suggestions
   - Usage pattern analysis
   - Cost-saving recommendations