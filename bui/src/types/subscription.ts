// Subscription and plan types for BB
export interface Plan {
	plan_id: string;
	plan_name: string;
	plan_description: string;
	plan_price_monthly: number;
	plan_price_yearly: number;
	//interval: 'month' | 'year';
	plan_features: {
		features: string[];
		proposition?: string; // Marketing content for upgrade encouragement
		target_user?: string; // Target user description for upgrade encouragement
		signup_credits_cents: number;
		upgrade_credits_cents?: number; // Credits to encourage upgrades
		contact_for_signup?: boolean; // Enterprise plans that require contact
		promotion?: {
			type: string;
			title: string;
			description: string;
			original_price_monthly: string;
			original_price_yearly: string;
			savings_monthly?: string;
			savings_yearly?: string;
			discount_percentage?: string;
		};
	};
	//plan_limits?: {
	//	max_conversations?: number;
	//	monthly_tokens?: number;
	//	rate_limits: {
	//		tokens_per_minute: number;
	//		requests_per_minute: number;
	//	};
	//};
}
export interface PlanResults {
	plans: Array<Plan>;
}

export interface Subscription {
	subscription_id: string;
	plan_id: string;
	subscription_status: 'ACTIVE' | 'RENEWED' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE';
	subscription_period_start: string;
	subscription_period_end: string;
	subscription_cancel_at: string;
	subscription_cancelled_at: string;
	stripe_subscription_id: string;
	plan: Plan;
	paymentMethod?: PaymentMethod;
}
export interface SubscriptionUsage {
	quotaLimits: {
		base_cost_monthly: number; //Base monthly cost limit in USD
		max_cost_monthly: number; //Maximum monthly cost limit (usage plans only)
		daily_cost_limit?: number; //Optional daily cost limit in USD
		hourly_cost_limit?: number; //Optional hourly cost limit in USD
	};
}
export interface SubscriptionResults {
	subscription: Subscription;
	futureSubscription: Subscription | null;
	paymentMethods: PaymentMethod[];
}

export interface BillingPreview {
	daysInMonth: number;
	daysRemaining: number;
	proratedAmount?: number;
	prorationFactor: number;
	fullAmount?: number;
	originalAmount?: number;
	discount?: number;
	bonusCredits?: number;
	periodStart: string; // iso8601
	periodEnd: string; // iso8601
	nextPeriodStart?: string; // iso8601
	nextPeriodEnd?: string; // iso8601
	currentPlan: Plan;
	newPlan: Plan;
	// New fields for upgrade/downgrade differentiation
	changeType?: 'upgrade' | 'downgrade';
	immediateChange?: boolean;
	effectiveDate?: string; // iso8601
	description?: string;
	// Coupon fields
	coupon?: {
		code: string;
		valid: boolean;
		error?: string;
		coupon_name?: string;
		discount_type?: string;
		duration_months?: number;
	};
}
export interface BillingPreviewResults {
	preview: BillingPreview;
	usage: SubscriptionUsage;
}

export interface SubscriptionWithPaymentMethods extends Subscription {
	payment_methods: PaymentMethod[];
}

export interface BillingPreviewWithUsage extends BillingPreview {
	usage?: SubscriptionUsage;
}

export interface PaymentMethod {
	payment_method_id: string;
	stripe_payment_method_id: string;
	type: string;
	// 	card?: {
	// 		brand: string;
	// 		last4: string;
	// 		exp_month: string;
	// 		exp_year: string;
	// 	};
	card_brand: string;
	card_last4: string;
	card_exp_month: string;
	card_exp_year: string;
	is_default: boolean;
}
export interface PaymentMethodResults {
	paymentMethods: PaymentMethod[];
}

export interface BlockPurchase {
	user_id: string;
	product_id: string;
	purchase_id: string;
	subscription_id: string;
	purchase_status: 'pending' | 'completed' | 'failed';
	amount_usd: number;
	tokens_added_at: string; // iso8601
	created_at: string; // iso8601
	updated_at: string; // iso8601
}
export interface BlockPurchaseResults {
	token_purchase: BlockPurchase;
}

export interface PurchasesBalance {
	balance: {
		current_balance_usd: number; // Current token balance
		last_updated: string; // When balance was last updated
		usage_since_update_usd: number; // Usage since last update
	};
	purchases: Array<BlockPurchase>;
}

// NEW INTERFACES FOR ANALYTICS FEATURES

// Usage Analytics for the Usage & History tab
export interface UsageAnalytics {
	current_month: {
		total_cost_usd: number;
		total_requests: number;
		total_tokens: number;
		period_start: string; // iso8601
		period_end: string; // iso8601
	};
	usage_trends: {
		daily_usage: Array<{
			date: string; // iso8601 date
			cost_usd: number;
			requests: number;
			tokens: number;
		}>;
		weekly_usage: Array<{
			week_start: string; // iso8601 date
			week_end: string; // iso8601 date
			cost_usd: number;
			requests: number;
			tokens: number;
		}>;
	};
	model_breakdown: Array<{
		model_name: string;
		provider: string;
		cost_usd: number;
		requests: number;
		tokens: number;
		percentage_of_total: number;
	}>;
	feature_breakdown: Array<{
		feature_type: 'chat' | 'code' | 'file_operations' | 'search' | 'other';
		feature_name: string;
		cost_usd: number;
		requests: number;
		tokens: number;
		percentage_of_total: number;
	}>;
}

// Enhanced Purchase History for combined subscription + credit transactions
export interface EnhancedPurchaseHistory {
	transactions: Array<{
		transaction_id: string;
		transaction_type: 'subscription' | 'credit_purchase' | 'auto_topup';
		amount_usd: number;
		description: string;
		status: 'pending' | 'completed' | 'failed' | 'refunded';
		created_at: string; // iso8601
		payment_method?: {
			type: string;
			last4?: string;
			brand?: string;
		};
		subscription_details?: {
			plan_name: string;
			period_start: string;
			period_end: string;
		};
		credit_details?: {
			credits_added_usd: number;
			auto_triggered: boolean;
		};
	}>;
	pagination: {
		total_items: number;
		current_page: number;
		total_pages: number;
		per_page: number;
	};
}

// Results interfaces for API responses
export interface UsageAnalyticsResults {
	analytics: UsageAnalytics;
}

export interface EnhancedPurchaseHistoryResults {
	history: EnhancedPurchaseHistory;
}

// Filter parameters for the purchase history API
export interface PurchaseHistoryFilters {
	transaction_type?: 'all' | 'subscription' | 'credit_purchase' | 'auto_topup';
	date_start?: string; // iso8601
	date_end?: string; // iso8601
	status?: 'all' | 'pending' | 'completed' | 'failed' | 'refunded';
	page?: number;
	per_page?: number;
}
