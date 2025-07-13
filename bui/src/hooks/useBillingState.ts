import { signal } from '@preact/signals';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe, StripeElements, StripeElementsOptions } from '@stripe/stripe-js';
import type {
	BillingPreviewWithUsage,
	EnhancedPurchaseHistory,
	PaymentMethod,
	Plan,
	PurchaseHistoryFilters,
	PurchasesBalance,
	Subscription,
	UsageAnalytics,
} from '../types/subscription.ts';
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
	purchasesBalance: boolean;
	analytics: boolean;
	history: boolean;
	preview: boolean;
	planChange: boolean;
	paymentSetup: boolean;
}

// Main State Interface
interface BillingState {
	subscription: Subscription | null;
	futureSubscription: Subscription | null;
	availablePlans: Plan[];
	purchasesBalance: PurchasesBalance | null;
	selectedPlan: Plan | null;
	paymentMethods: PaymentMethod[];
	defaultPaymentMethod: PaymentMethod | null;
	billingPreview: BillingPreviewWithUsage | null;
	usageAnalytics: UsageAnalytics | null;
	purchaseHistory: EnhancedPurchaseHistory | null;
	loading: BillingLoadingState;
	paymentFlowError: PaymentFlowError | null;
	stripe: Stripe | null;
	elements: StripeElements | null;
}

const initialLoadingState: BillingLoadingState = {
	subscription: false,
	plans: false,
	paymentMethods: false,
	purchasesBalance: false,
	analytics: false,
	history: false,
	preview: false,
	planChange: false,
	paymentSetup: false,
};

const initialBillingState: BillingState = {
	subscription: null,
	futureSubscription: null,
	availablePlans: [],
	purchasesBalance: null,
	selectedPlan: null,
	paymentMethods: [],
	defaultPaymentMethod: null,
	billingPreview: null,
	usageAnalytics: null,
	purchaseHistory: null,
	loading: initialLoadingState,
	paymentFlowError: null,
	stripe: null,
	elements: null,
};

const billingState = signal<BillingState>(initialBillingState);
let isInitialized = false;

// Mock data for analytics features (to be replaced with real API calls)
const createMockUsageAnalytics = (): UsageAnalytics => ({
	current_month: {
		total_cost_usd: 23.45,
		total_requests: 2145,
		total_tokens: 45000000,
		period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
		period_end: new Date().toISOString(),
	},
	usage_trends: {
		daily_usage: Array.from({ length: 30 }, (_, i) => {
			const date = new Date();
			date.setDate(date.getDate() - (29 - i));
			return {
				date: date.toISOString().split('T')[0],
				cost_usd: Math.random() * 3 + 0.5,
				requests: Math.floor(Math.random() * 100 + 20),
				tokens: Math.floor(Math.random() * 50000 + 10000),
			};
		}),
		weekly_usage: Array.from({ length: 4 }, (_, i) => {
			const endDate = new Date();
			endDate.setDate(endDate.getDate() - (i * 7));
			const startDate = new Date(endDate);
			startDate.setDate(startDate.getDate() - 6);
			return {
				week_start: startDate.toISOString().split('T')[0],
				week_end: endDate.toISOString().split('T')[0],
				cost_usd: Math.random() * 20 + 5,
				requests: Math.floor(Math.random() * 500 + 100),
				tokens: Math.floor(Math.random() * 300000 + 50000),
			};
		}),
	},
	model_breakdown: [
		{ model_name: 'Claude-3.5-Sonnet', provider: 'Anthropic', cost_usd: 15.20, requests: 1245, tokens: 28000000, percentage_of_total: 64.8 },
		{ model_name: 'GPT-4o', provider: 'OpenAI', cost_usd: 8.25, requests: 900, tokens: 17000000, percentage_of_total: 35.2 },
	],
	feature_breakdown: [
		{ feature_type: 'chat', feature_name: 'Chat Conversations', cost_usd: 18.50, requests: 1850, tokens: 38000000, percentage_of_total: 78.9 },
		{ feature_type: 'code', feature_name: 'Code Generation', cost_usd: 4.95, requests: 295, tokens: 7000000, percentage_of_total: 21.1 },
	],
});

const createMockPurchaseHistory = (): EnhancedPurchaseHistory => ({
	transactions: [
		{
			transaction_id: 'txn_auto_123',
			transaction_type: 'auto_topup',
			amount_usd: 20.00,
			description: 'Auto top-up purchase',
			status: 'completed',
			created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
			payment_method: { type: 'card', last4: '4242', brand: 'visa' },
			credit_details: { credits_added_usd: 20.00, auto_triggered: true },
		},
		{
			transaction_id: 'txn_sub_456',
			transaction_type: 'subscription',
			amount_usd: 29.00,
			description: 'Beyond Plan - Monthly',
			status: 'completed',
			created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
			payment_method: { type: 'card', last4: '4242', brand: 'visa' },
			subscription_details: {
				plan_name: 'Beyond Plan',
				period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
				period_end: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
			},
		},
		{
			transaction_id: 'txn_credit_789',
			transaction_type: 'credit_purchase',
			amount_usd: 50.00,
			description: 'Manual credit purchase',
			status: 'completed',
			created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
			payment_method: { type: 'card', last4: '4242', brand: 'visa' },
			credit_details: { credits_added_usd: 50.00, auto_triggered: false },
		},
	],
	pagination: {
		total_items: 3,
		current_page: 1,
		total_pages: 1,
		per_page: 25,
	},
});

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
					purchasesBalance: true,
				},
				paymentFlowError: null,
			};

			const [subscriptionResponse, plans, purchasesBalance] = await Promise.all([
				apiClient.getCurrentSubscription(),
				apiClient.getAvailablePlans(),
				apiClient.listUsageBlocks(),
			]);
			console.log('useBillingState: subscriptionResponse', subscriptionResponse);
			console.log('useBillingState: purchasesBalance', purchasesBalance);

			// Extract subscription, futureSubscription, and paymentMethods from API response
			const subscription = subscriptionResponse?.subscription || null;
			const futureSubscription = subscriptionResponse?.futureSubscription || null;
			const paymentMethods = subscriptionResponse?.paymentMethods || [];

			const defaultPaymentMethod = paymentMethods?.find((pm: PaymentMethod) => pm.is_default) || null;
			console.log('useBillingState: paymentMethods', paymentMethods);
			console.log('useBillingState: defaultPaymentMethod', defaultPaymentMethod);

			billingState.value = {
				...billingState.value,
				subscription: subscription || null,
				futureSubscription: futureSubscription || null,
				availablePlans: plans || [],
				purchasesBalance,
				paymentMethods: paymentMethods || [],
				defaultPaymentMethod,
				loading: {
					...billingState.value.loading,
					subscription: false,
					plans: false,
					paymentMethods: false,
					purchasesBalance: false,
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
					purchasesBalance: false,
				},
				paymentFlowError: handleError(error, 'Failed to load billing data', 'api_error'),
			};
		}
	};

	const updateUsageData = async (): Promise<void> => {
		try {
			const apiClient = getApiClient();

			billingState.value = {
				...billingState.value,
				loading: {
					...billingState.value.loading,
					purchasesBalance: true,
				},
			};

			const purchasesBalance = await apiClient.listUsageBlocks();
			console.log('useBillingState: purchasesBalance', purchasesBalance);

			billingState.value = {
				...billingState.value,
				purchasesBalance,
				loading: {
					...billingState.value.loading,
					purchasesBalance: false,
				},
			};
		} catch (_error) {
			billingState.value = {
				...billingState.value,
				loading: {
					...billingState.value.loading,
					purchasesBalance: false,
				},
			};
		}
	};

	const updatePaymentMethods = async (): Promise<void> => {
		try {
			const apiClient = getApiClient();

			billingState.value = {
				...billingState.value,
				loading: {
					...billingState.value.loading,
					paymentMethods: true,
				},
				paymentFlowError: null,
			};

			const paymentMethods = await apiClient.listPaymentMethods();

			const defaultPaymentMethod = paymentMethods?.find((pm) => pm.is_default) || null;
			console.log('useBillingState: paymentMethods', paymentMethods);
			console.log('useBillingState: defaultPaymentMethod', defaultPaymentMethod);

			billingState.value = {
				...billingState.value,
				paymentMethods: paymentMethods || [],
				defaultPaymentMethod,
				loading: {
					...billingState.value.loading,
					paymentMethods: false,
				},
			};
		} catch (error) {
			billingState.value = {
				...billingState.value,
				loading: {
					...billingState.value.loading,
					paymentMethods: false,
				},
				paymentFlowError: handleError(error, 'Failed to load billing data', 'api_error'),
			};
		}
	};

	// NEW METHODS FOR ANALYTICS FEATURES

	const loadUsageAnalytics = async (period?: 'month' | 'quarter' | 'year'): Promise<void> => {
		try {
			billingState.value = {
				...billingState.value,
				loading: { ...billingState.value.loading, analytics: true },
				paymentFlowError: null,
			};

			// For now, use mock data. Replace with real API call when backend is ready:
			// const apiClient = getApiClient();
			// const analytics = await apiClient.getUsageAnalytics(period);
			
			// Simulate API delay
			await new Promise(resolve => setTimeout(resolve, 500));
			const analytics = createMockUsageAnalytics();

			billingState.value = {
				...billingState.value,
				usageAnalytics: analytics,
				loading: { ...billingState.value.loading, analytics: false },
			};
		} catch (error) {
			billingState.value = {
				...billingState.value,
				loading: { ...billingState.value.loading, analytics: false },
				paymentFlowError: handleError(error, 'Failed to load usage analytics', 'api_error'),
			};
		}
	};

	const loadPurchaseHistory = async (filters?: PurchaseHistoryFilters): Promise<void> => {
		try {
			billingState.value = {
				...billingState.value,
				loading: { ...billingState.value.loading, history: true },
				paymentFlowError: null,
			};

			// For now, use mock data. Replace with real API call when backend is ready:
			// const apiClient = getApiClient();
			// const history = await apiClient.getEnhancedPurchaseHistory(filters);
			
			// Simulate API delay
			await new Promise(resolve => setTimeout(resolve, 300));
			const history = createMockPurchaseHistory();

			billingState.value = {
				...billingState.value,
				purchaseHistory: history,
				loading: { ...billingState.value.loading, history: false },
			};
		} catch (error) {
			billingState.value = {
				...billingState.value,
				loading: { ...billingState.value.loading, history: false },
				paymentFlowError: handleError(error, 'Failed to load purchase history', 'api_error'),
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

			console.log('useBillingState: changing plan with paymentMethodId: ', paymentMethodId);

			// For upgrades, payment method is required; for downgrades, it's optional
			const isUpgrade = billingState.value.billingPreview?.changeType === 'upgrade';
			const isDowngrade = billingState.value.billingPreview?.changeType === 'downgrade';
			if (isUpgrade && !paymentMethodId) {
				throw new PaymentFlowError('A payment method is required for upgrades', 'payment_method_required');
			}
			// For downgrades, payment method is optional since there's no immediate charge
			if (isDowngrade && !paymentMethodId) {
				console.log('Downgrade without payment method - this is allowed');
			}

			// Change plan - ABI will handle the payment success via webhook
			const newSubscription = await apiClient.changePlan(planId, paymentMethodId);
			console.log('useBillingState: changed plan to subscription: ', newSubscription);

			// Payment intent is automatically created by Stripe when the subscription is created
			// with proration_behavior: 'create_prorations' in the backend

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

			// Purchase the usage block - ABI will handle the payment success via webhook
			const newPurchase = await apiClient.purchaseUsageBlock(amount, paymentMethodId);

			// Create payment intent with existing payment method
			await apiClient.createPaymentIntent({
				amount: Math.round(amount * 100),
				subscription_id: billingState.value.subscription?.subscription_id || '',
				purchase_id: newPurchase?.purchase_id || '',
				payment_type: 'token_purchase',
				stripe_payment_method_id: paymentMethodId,
				source: 'useBillingState:purchaseUsageBlock',
			});

			console.log('useBillingState: changing plan with paymentMethodId: ', paymentMethodId);

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
		updateUsageData,
		updatePaymentMethods,
		loadUsageAnalytics,
		loadPurchaseHistory,
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