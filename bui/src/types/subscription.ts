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
	};
	plan_limits?: {
		max_conversations?: number;
		monthly_tokens?: number;
		rate_limits: {
			tokens_per_minute: number;
			requests_per_minute: number;
		};
	};
}
export interface PlanResults {
	plans: Array<Plan>;
}

export interface Subscription {
	subscription_id: string;
	plan_id: string;
	subscription_status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE';
	subscription_period_start: string;
	subscription_period_end: string;
	subscription_cancel_at: string;
	subscription_cancelled_at: string;
	stripe_subscription_id: string;
	plan: Plan;
	paymentMethod?: PaymentMethod;
}
export interface SubscriptionUsage {
	currentUsage: {
		costUsd: number;
		tokenCount: number;
		requestCount: number;
	};
	quotaLimits: {
		base_cost_monthly: number; //Base monthly cost limit in USD
		max_cost_monthly: number; //Maximum monthly cost limit (usage plans only)
		daily_cost_limit?: number; //Optional daily cost limit in USD
		hourly_cost_limit?: number; //Optional hourly cost limit in USD
	};
}
export interface SubscriptionResults {
	subscription: Subscription;
	usage: SubscriptionUsage;
	paymentMethods: PaymentMethod[];
}

export interface BillingPreview {
	daysInMonth: number;
	daysRemaining: number;
	prorationFactor: number;
	periodStart: string; // iso8601
	periodEnd: string; // iso8601
	currentPlan: Plan;
	newPlan: Plan;
}
export interface BillingPreviewResults {
	preview: BillingPreview;
	usage: SubscriptionUsage;
}

export interface SubscriptionWithUsage extends Subscription {
	usage?: SubscriptionUsage;
}
export interface SubscriptionWithUsageWithPaymentMethods extends SubscriptionWithUsage {
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
		// Allowances
		subscription_allowance_usd: number; // Monthly subscription allowance amount
		purchased_allowance_usd: number; // Total purchased block allowance
		total_allowance_usd: number; // Total available allowance (subscription + blocks)

		// Usage
		subscription_used_usd: number; // Amount used from subscription allowance
		purchased_used_usd: number; // Amount used from purchased blocks
		total_used_usd: number; // Total usage across all sources

		// Balance
		remaining_balance_usd: number; // Total remaining balance
	};
	purchases: Array<BlockPurchase>;
}
