import { signal } from '@preact/signals';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe, StripeElements, StripeElementsOptions, StripeError } from '@stripe/stripe-js';
import type { BillingPreviewWithUsage, PaymentMethod, Plan, SubscriptionWithUsage } from '../types/subscription.ts';
import { useAppState } from './useAppState.ts';

// Error Types
export class PaymentFlowError extends Error {
  constructor(
    message: string,
    public code: PaymentFlowErrorCode,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'PaymentFlowError';
  }
}

export type PaymentFlowErrorCode =
  | 'payment_failed'
  | 'card_declined'
  | 'card_expired'
  | 'invalid_card'
  | 'insufficient_funds'
  | 'payment_method_required'
  | 'stripe_setup_failed'
  | 'subscription_required'
  | 'plan_change_failed'
  | 'preview_failed'
  | 'cancel_failed'
  | 'network_error'
  | 'api_error'
  | 'customer_id_missing';

// Loading States
interface BillingLoadingState {
  subscription: boolean;
  plans: boolean;
  paymentMethods: boolean;
  preview: boolean;
  planChange: boolean;
  paymentSetup: boolean;
}

// Main State Interface
interface BillingState {
  subscription: SubscriptionWithUsage | null;
  availablePlans: Plan[];
  selectedPlan: Plan | null;
  paymentMethods: PaymentMethod[];
  defaultPaymentMethod: PaymentMethod | null;
  billingPreview: BillingPreviewWithUsage | null;
  loading: BillingLoadingState;
  paymentFlowError: PaymentFlowError | null;
  stripe: Stripe | null;
  elements: StripeElements | null;
}

const initialLoadingState: BillingLoadingState = {
  subscription: false,
  plans: false,
  paymentMethods: false,
  preview: false,
  planChange: false,
  paymentSetup: false,
};

const initialBillingState: BillingState = {
  subscription: null,
  availablePlans: [],
  selectedPlan: null,
  paymentMethods: [],
  defaultPaymentMethod: null,
  billingPreview: null,
  loading: initialLoadingState,
  paymentFlowError: null,
  stripe: null,
  elements: null,
};

const billingState = signal<BillingState>(initialBillingState);
let isInitialized = false;

export function useBillingState() {
  const appState = useAppState();

  // Private helper to handle errors consistently
  const handleError = (error: unknown, defaultMessage: string, code: PaymentFlowErrorCode): PaymentFlowError => {
    if (error instanceof PaymentFlowError) return error;
    if (error instanceof Error) {
      return new PaymentFlowError(error.message, code, error);
    }
    return new PaymentFlowError(defaultMessage, code, error);
  };

  // Private helper to get API client with error handling
  const getApiClient = () => {
    const apiClient = appState.value.apiClient;
    if (!apiClient) {
      throw new PaymentFlowError('API client not available', 'api_error');
    }
    return apiClient;
  };

  // Initialize Stripe
  const initializeStripe = async (): Promise<void> => {
    try {
      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, paymentSetup: true },
        paymentFlowError: null,
      };

      const apiClient = getApiClient();
      const { stripeKey } = await apiClient.getStripeConfig();

      const stripe = await loadStripe(stripeKey);
      if (!stripe) {
        throw new PaymentFlowError('Failed to initialize Stripe', 'stripe_setup_failed');
      }

      billingState.value = {
        ...billingState.value,
        stripe,
        loading: { ...billingState.value.loading, paymentSetup: false },
      };
    } catch (error) {
      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, paymentSetup: false },
        paymentFlowError: handleError(error, 'Failed to initialize payment system', 'stripe_setup_failed'),
      };
    }
  };

  const loadBillingData = async (): Promise<void> => {
    try {
      const apiClient = getApiClient();

      billingState.value = {
        ...billingState.value,
        loading: {
          ...billingState.value.loading,
          subscription: true,
          plans: true,
          paymentMethods: true,
        },
        paymentFlowError: null,
      };

      const [subscription, plans, paymentMethods] = await Promise.all([
        apiClient.getCurrentSubscription(),
        apiClient.getAvailablePlans(),
        apiClient.listPaymentMethods(),
      ]);
      console.log('useBillingState: subscription', subscription);

      const defaultPaymentMethod = paymentMethods?.find((pm) => pm.is_default) || null;
      console.log('useBillingState: paymentMethods', paymentMethods);
      console.log('useBillingState: defaultPaymentMethod', defaultPaymentMethod);

      billingState.value = {
        ...billingState.value,
        subscription: subscription || null,
        availablePlans: plans || [],
        paymentMethods: paymentMethods || [],
        defaultPaymentMethod,
        loading: {
          ...billingState.value.loading,
          subscription: false,
          plans: false,
          paymentMethods: false,
        },
      };
    } catch (error) {
      billingState.value = {
        ...billingState.value,
        loading: {
          ...billingState.value.loading,
          subscription: false,
          plans: false,
          paymentMethods: false,
        },
        paymentFlowError: handleError(error, 'Failed to load billing data', 'api_error'),
      };
    }
  };

  // Create Stripe Elements for new payment method collection only
  const createPaymentElements = async (): Promise<void> => {
    const { stripe } = billingState.value;
    if (!stripe) {
      throw new PaymentFlowError('Stripe not initialized', 'stripe_setup_failed');
    }

    try {
      const apiClient = getApiClient();
      const { clientSecret } = await apiClient.createCustomerSession();

      if (!clientSecret) {
        throw new PaymentFlowError('Failed to get customer session', 'stripe_setup_failed');
      }

      const elementsOptions: StripeElementsOptions = {
        mode: 'setup',
        currency: 'usd',
        paymentMethodCreation: 'manual',
        customerSessionClientSecret: clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#3b82f6',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'Inter, system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '6px',
          },
        },
      };

      const elements = stripe.elements(elementsOptions);

      billingState.value = {
        ...billingState.value,
        elements,
      };
    } catch (error) {
      throw handleError(error, 'Failed to create payment elements', 'stripe_setup_failed');
    }
  };

  // Preview plan change
  const previewPlanChange = async (planId: string): Promise<void> => {
    try {
      const apiClient = getApiClient();

      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, preview: true },
        paymentFlowError: null,
      };

      const preview = await apiClient.getBillingPreview(planId);
      const selectedPlan = billingState.value.availablePlans.find((p) => p.plan_id === planId) ?? null;

      billingState.value = {
        ...billingState.value,
        billingPreview: preview,
        selectedPlan,
        loading: { ...billingState.value.loading, preview: false },
      };
    } catch (error) {
      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, preview: false },
        paymentFlowError: handleError(error, 'Failed to preview plan change', 'preview_failed'),
      };
    }
  };

  // Change plan with payment if needed
  const changePlan = async (planId: string, paymentMethodId: string): Promise<void> => {
    try {
      const apiClient = getApiClient();

      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, planChange: true },
        paymentFlowError: null,
      };

      // If there's a prorated amount, create payment intent first
      if (billingState.value.billingPreview?.prorationFactor > 0) {
        const proratedAmount = Math.round(
          billingState.value.billingPreview.prorationFactor *
            (billingState.value.selectedPlan?.plan_price_monthly || 0) * 100,
        );

        await apiClient.createPaymentIntent({
          amount: proratedAmount,
          subscription_id: billingState.value.subscription?.subscription_id || '',
          payment_type: 'subscription',
          payment_method_id: paymentMethodId,
        });
      }

      // Change plan - ABI will handle the payment success via webhook
      const newSubscription = await apiClient.changePlan(planId, paymentMethodId);

      billingState.value = {
        ...billingState.value,
        subscription: newSubscription || null,
        selectedPlan: null,
        billingPreview: null,
        loading: { ...billingState.value.loading, planChange: false },
      };
    } catch (error) {
      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, planChange: false },
        paymentFlowError: handleError(error, 'Failed to change plan', 'plan_change_failed'),
      };
    }
  };

  // Purchase usage block
  const purchaseUsageBlock = async (amount: number, paymentMethodId: string): Promise<void> => {
    try {
      const apiClient = getApiClient();

      // Create payment intent with existing payment method
      await apiClient.createPaymentIntent({
        amount: Math.round(amount * 100),
        subscription_id: billingState.value.subscription?.subscription_id || '',
        payment_type: 'token_purchase',
        payment_method_id: paymentMethodId,
      });

      // Purchase the usage block - ABI will handle the payment success via webhook
      await apiClient.purchaseUsageBlock(amount, paymentMethodId);

      // Refresh subscription data to get updated usage
      await loadBillingData();
    } catch (error) {
      throw handleError(error, 'Failed to purchase usage block', 'payment_failed');
    }
  };

  // Cancel subscription
  const cancelSubscription = async (immediate: boolean = false): Promise<void> => {
    try {
      const apiClient = getApiClient();

      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, subscription: true },
        paymentFlowError: null,
      };

      const result = await apiClient.cancelSubscription(immediate);

      billingState.value = {
        ...billingState.value,
        subscription: result?.subscription || null,
        loading: { ...billingState.value.loading, subscription: false },
      };
    } catch (error) {
      billingState.value = {
        ...billingState.value,
        loading: { ...billingState.value.loading, subscription: false },
        paymentFlowError: handleError(error, 'Failed to cancel subscription', 'cancel_failed'),
      };
    }
  };

  return {
    billingState,
    initialize: async (): Promise<void> => {
      if (isInitialized) return;
      try {
        await initializeStripe();
        await loadBillingData();
        isInitialized = true;
      } catch (error) {
        billingState.value = {
          ...billingState.value,
          paymentFlowError: handleError(error, 'Failed to initialize billing', 'api_error'),
        };
      }
    },
    loadBillingData,
    createPaymentElements,
    previewPlanChange,
    changePlan,
    purchaseUsageBlock,
    cancelSubscription,
    cleanup: (): void => {
      billingState.value = initialBillingState;
      isInitialized = false;
    },
  };
}