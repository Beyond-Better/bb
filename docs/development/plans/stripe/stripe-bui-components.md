# Stripe Integration: BUI Components

This document outlines the BUI components required for the Stripe integration.

## Component Overview

### Component Hierarchy
```
BillingManager/
├── SubscriptionDisplay/
│   ├── CurrentPlanDetails
│   ├── UsageMetrics
│   └── PlanChangeButton
├── PaymentMethodManager/
│   ├── PaymentMethodList
│   ├── AddPaymentMethod
│   └── PaymentMethodActions
├── UsageDisplay/
│   ├── UsageSummary
│   ├── UsageChart
│   └── UsageAlerts
└── BillingHistory/
    ├── PaymentList
    ├── InvoiceList
    └── DownloadInvoice
```

## Component Specifications

### SubscriptionDisplay

#### CurrentPlanDetails
```typescript
interface CurrentPlanDetailsProps {
  subscription: {
    planId: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
  onManage: () => void;
}
```
- Displays current subscription plan details
- Shows renewal date and status
- Includes upgrade/downgrade options
- Handles cancellation status display

#### UsageMetrics
```typescript
interface UsageMetricsProps {
  usage: {
    tokens: number;
    cost: number;
    limit: number;
    periodStart: string;
    periodEnd: string;
  };
}
```
- Shows current period usage
- Displays progress towards limits
- Includes cost breakdown
- Updates in real-time when possible

#### PlanChangeButton
```typescript
interface PlanChangeButtonProps {
  currentPlanId: string;
  availablePlans: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  onPlanSelect: (planId: string) => void;
}
```
- Triggers plan change flow
- Shows available plans
- Handles confirmation dialog
- Displays proration preview

### PaymentMethodManager

#### PaymentMethodList
```typescript
interface PaymentMethodListProps {
  paymentMethods: Array<{
    id: string;
    type: string;
    isDefault: boolean;
    card: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
  }>;
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
}
```
- Lists all saved payment methods
- Shows card details securely
- Handles default payment method
- Supports removal actions

#### AddPaymentMethod
```typescript
interface AddPaymentMethodProps {
  onSuccess: (paymentMethodId: string) => void;
  onError: (error: Error) => void;
}
```
- Integrates Stripe Elements
- Handles card validation
- Processes setup intent
- Shows loading states
- Manages error display

#### PaymentMethodActions
```typescript
interface PaymentMethodActionsProps {
  paymentMethodId: string;
  isDefault: boolean;
  onSetDefault: () => void;
  onRemove: () => void;
}
```
- Contains action buttons
- Handles confirmation dialogs
- Shows operation status
- Manages loading states

### UsageDisplay

#### UsageSummary
```typescript
interface UsageSummaryProps {
  usage: {
    current: number;
    limit: number;
    cost: number;
    projectedCost: number;
  };
}
```
- Shows usage overview
- Displays cost projections
- Highlights approaching limits
- Updates periodically

#### UsageChart
```typescript
interface UsageChartProps {
  data: Array<{
    date: string;
    tokens: number;
    cost: number;
  }>;
  range: 'day' | 'week' | 'month';
}
```
- Visualizes usage trends
- Supports different time ranges
- Shows cost overlay
- Handles data loading states

#### UsageAlerts
```typescript
interface UsageAlertsProps {
  alerts: Array<{
    type: string;
    threshold: number;
    message: string;
    timestamp: string;
  }>;
}
```
- Shows usage warnings
- Displays cost alerts
- Handles acknowledgment
- Updates in real-time

### BillingHistory

#### PaymentList
```typescript
interface PaymentListProps {
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    status: string;
    paymentMethod: {
      brand: string;
      last4: string;
    };
  }>;
  onPageChange: (page: number) => void;
}
```
- Lists payment history
- Supports pagination
- Shows payment details
- Handles failed payments

#### InvoiceList
```typescript
interface InvoiceListProps {
  invoices: Array<{
    id: string;
    number: string;
    date: string;
    amount: number;
    status: string;
    pdfUrl: string;
  }>;
  onDownload: (invoiceId: string) => void;
}
```
- Shows invoice history
- Supports PDF download
- Handles loading states
- Shows invoice status

## State Management

### Billing Context
```typescript
interface BillingState {
  subscription: {
    current: SubscriptionDetails;
    available: Plan[];
  };
  paymentMethods: {
    list: PaymentMethod[];
    default: string | null;
  };
  usage: {
    current: UsageMetrics;
    history: UsageData[];
  };
  billing: {
    payments: Payment[];
    invoices: Invoice[];
  };
}

interface BillingActions {
  refreshSubscription: () => Promise<void>;
  changePlan: (planId: string) => Promise<void>;
  addPaymentMethod: (data: PaymentMethodData) => Promise<void>;
  removePaymentMethod: (id: string) => Promise<void>;
  setDefaultPaymentMethod: (id: string) => Promise<void>;
  fetchUsage: (range: DateRange) => Promise<void>;
  downloadInvoice: (id: string) => Promise<void>;
}
```

## Error Handling

### Error Components

#### PaymentError
```typescript
interface PaymentErrorProps {
  error: {
    code: string;
    message: string;
    suggestion?: string;
  };
  onRetry?: () => void;
  onDismiss: () => void;
}
```
- Shows payment-specific errors
- Provides recovery actions
- Handles retry logic
- Links to support when needed

#### ValidationError
```typescript
interface ValidationErrorProps {
  field: string;
  message: string;
  suggestion?: string;
}
```
- Shows field-level errors
- Provides inline guidance
- Handles focus management
- Supports error clearing

## Loading States

### LoadingStates
```typescript
interface LoadingState {
  type: 'spinner' | 'skeleton' | 'progress';
  message?: string;
  progress?: number;
}
```
- Consistent loading indicators
- Progress feedback
- Cancelable operations
- Timeout handling

## Responsive Design

### Breakpoints
```typescript
const breakpoints = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
};
```

### Layout Components
```typescript
interface ResponsiveContainerProps {
  maxWidth?: keyof typeof breakpoints;
  padding?: string;
  children: React.ReactNode;
}
```
- Handles different screen sizes
- Maintains consistent spacing
- Supports nested layouts
- Preserves accessibility

## Accessibility

### ARIA Labels
```typescript
interface AriaProps {
  'aria-label': string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  role?: string;
}
```
- Proper heading structure
- Focus management
- Keyboard navigation
- Screen reader support

## Animation

### Transitions
```typescript
interface TransitionProps {
  type: 'fade' | 'slide' | 'expand';
  duration: number;
  delay?: number;
}
```
- Smooth state changes
- Loading indicators
- Error animations
- Success feedback

## Implementation Notes

1. Component Updates
- Use React.memo for performance
- Implement proper cleanup
- Handle unmounting gracefully
- Cache API responses

2. Error Boundaries
- Implement at key points
- Provide fallback UI
- Log errors properly
- Support recovery

3. Performance
- Lazy load components
- Implement proper caching
- Optimize re-renders
- Monitor metrics

4. Testing
- Unit tests for components
- Integration tests for flows
- E2E tests for critical paths
- Accessibility testing