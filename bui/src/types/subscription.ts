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
	plan_id: string;
	subscription_status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE';
	subscription_period_start: string;
	subscription_period_end: string;
	subscription_cancel_at: string;
	subscription_cancelled_at: string;
	stripe_subscription_id: string;
	plan: Plan;
	//paymentMethod?: {
	//	brand: string;
	//	last4: string;
	//	expiryMonth: number;
	//	expiryYear: number;
	//};
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

export interface BillingPreviewWithUsage extends BillingPreview {
	usage?: SubscriptionUsage;
}
