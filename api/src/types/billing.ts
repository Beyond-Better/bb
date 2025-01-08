// Payment method and billing types for BB API

export interface PaymentMethod {
	id: string; // Internal payment_method_id
	stripeId: string; // Stripe payment method ID
	type: string; // e.g., 'card'
	isDefault: boolean;
	card: {
		brand: string; // e.g., 'visa'
		last4: string;
		expMonth: number;
		expYear: number;
	};
}

export interface SetupIntent {
	clientSecret: string; // Stripe setup intent client secret
	setupIntentId: string; // Stripe setup intent ID
}

export interface Invoice {
	id: string;
	number: string;
	date: string;
	amount: number;
	status: 'paid' | 'open' | 'draft';
	pdfUrl: string;
}

export interface Payment {
	id: string;
	date: string;
	amount: number;
	status: string;
	type: 'subscription' | 'token_purchase';
	paymentMethod: {
		brand: string;
		last4: string;
	};
}

export interface UsageBlockPurchase {
	amount: number; // Amount of additional usage to purchase
	paymentMethodId?: string; // Optional - uses default if not provided
}

export interface UsageBlockResponse {
	success: boolean;
	newLimit: number; // Updated max cost limit
	purchaseAmount: number; // Amount charged
	effectiveDate: string; // When the new limit takes effect
}

export interface UsageBlockList {
	purchases: UsageBlockResponse[];
}

export interface UsageMetrics {
	tokens: {
		total: number;
		byModel: {
			[modelName: string]: number;
		};
	};
	costs: {
		total: number;
		byModel: {
			[modelName: string]: number;
		};
	};
	periodStart: string;
	periodEnd: string;
}
