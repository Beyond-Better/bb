import type { Context, RouterContext } from '@oak/oak';
import type {
	PaymentMethod,
	SetupIntent,
	UsageBlockList,
	UsageBlockPurchase,
	UsageBlockResponse,
} from '../../types/billing.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { logger } from 'shared/logger.ts';

export async function createPaymentIntent(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: createPaymentIntent: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const { amount, stripe_payment_method_id, metadata = {} } = body;

		if (!amount || amount <= 0) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Valid amount is required' };
			return;
		}
		if (!stripe_payment_method_id) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Valid payment method id is required' };
			return;
		}

		const { data, error } = await supabaseClient.functions.invoke('payment-intent', {
			method: 'POST',
			body: {
				amount,
				stripe_payment_method_id,
				metadata,
			},
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error creating payment intent:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to create payment intent' };
	}
}

export async function createCustomerSession(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: createCustomerSession: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		//const body = await ctx.request.body.json();

		const { data, error } = await supabaseClient.functions.invoke('customer-session', {
			method: 'POST',
			body: {},
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error creating customer session:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to create customer session' };
	}
}

export async function getBillingConfig(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: getBillingConfig: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('billing-config', {
			method: 'GET',
		});
		//logger.info('BillingHandler: getBillingConfig', {data, error});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error getting billing config:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to get billing configuration' };
	}
}

export async function createSetupIntent(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: createSetupIntent: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('payment-setup', {
			method: 'POST',
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data as SetupIntent;
	} catch (err) {
		console.error('Error creating setup intent:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to create setup intent' };
	}
}

export async function listPaymentMethods(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: listPaymentMethods: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('payment-methods', {
			method: 'GET',
		});
		// logger.info(`BillingHandler: PaymentMethods`, { data, error });

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data as { paymentMethods: PaymentMethod[] };
	} catch (err) {
		console.error('Error listing payment methods:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to list payment methods' };
	}
}

export async function setDefaultPaymentMethod(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: setDefaultPaymentMethod: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const paymentMethodId = body.paymentMethodId;

		if (!paymentMethodId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Payment method ID is required' };
			return;
		}

		const { data: _data, error } = await supabaseClient.functions.invoke('payment-methods', {
			method: 'POST',
			body: { paymentMethodId, action: 'setDefault' },
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = {
			success: true,
			message: 'Default payment method updated',
		};
	} catch (err) {
		console.error('Error setting default payment method:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to set default payment method' };
	}
}

export async function purchaseUsageBlock(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: purchaseUsageBlock: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const { amount, paymentMethodId } = body as UsageBlockPurchase;
		// logger.info(
		// 	`BillingHandler: purchaseUsageBlock: args`,
		// 	{ amount, paymentMethodId },
		// );

		if (!amount || amount <= 0) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Valid purchase amount is required' };
			return;
		}

		const { data, error } = await supabaseClient.functions.invoke('usage-purchase', {
			method: 'POST',
			body: { amount, paymentMethodId },
		});
		// logger.info(
		// 	`BillingHandler: purchaseUsageBlock: result`,
		// 	{ data, error },
		// );

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data as UsageBlockResponse;
	} catch (err) {
		console.error('Error purchasing usage block:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to purchase usage block' };
	}
}

export async function listUsageBlocks(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: listUsageBlocks: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('usage-purchase', {
			method: 'GET',
		});
		//logger.warn(
		//	`BillingHandler: listUsageBlocks: `,
		//	{ data, error },
		//);

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data as UsageBlockList;
	} catch (err) {
		console.error('Error listing usage blocks:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to list usage blocks' };
	}
}

export const removePaymentMethod = async (
	{ params, response, app }: RouterContext<'/payment-methods/:id', { id: string }>,
) => {
	const { id: paymentMethodId } = params;

	try {
		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: removePaymentMethod: No session manager configured`,
			);
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		if (!paymentMethodId) {
			response.status = 400;
			response.body = { error: 'Payment method ID is required' };
			return;
		}

		const { data: _data, error } = await supabaseClient.functions.invoke('payment-methods', {
			method: 'DELETE',
			body: { paymentMethodId },
		});

		if (error) {
			response.status = 400;
			response.body = { error: error.message };
			return;
		}

		response.body = {
			success: true,
			message: 'Payment method removed',
		};
	} catch (err) {
		console.error('Error removing payment method:', err);
		response.status = 500;
		response.body = { error: 'Failed to remove payment method' };
	}
};

// Auto Top-up handlers
export async function getAutoTopupStatus(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: getAutoTopupStatus: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('auto-topup', {
			method: 'GET',
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error getting auto top-up status:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to get auto top-up status' };
	}
}

export async function updateAutoTopupSettings(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: updateAutoTopupSettings: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const { enabled, min_balance_cents, purchase_amount_cents, max_per_day_cents } = body;

		// Basic validation
		if (enabled && (!min_balance_cents || !purchase_amount_cents)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Min balance and purchase amount are required when enabling auto top-up' };
			return;
		}

		const { data, error } = await supabaseClient.functions.invoke('auto-topup', {
			method: 'PUT',
			body: {
				enabled,
				min_balance_cents,
				purchase_amount_cents,
				max_per_day_cents,
			},
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error updating auto top-up settings:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to update auto top-up settings' };
	}
}

export async function triggerAutoTopup(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: triggerAutoTopup: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('auto-topup', {
			method: 'POST',
			body: {},
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error triggering auto top-up:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to trigger auto top-up' };
	}
}

// NEW ENDPOINTS FOR BILLING RESTRUCTURE

/**
 * Get usage analytics for Usage & History tab
 * Calls billing-usage-analytics edge function
 */
export async function getUsageAnalytics(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: getUsageAnalytics: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		// Extract query parameters
		const url = new URL(ctx.request.url);
		const period = url.searchParams.get('period') || 'month';
		const month = url.searchParams.get('month') || 'current';
		const models = url.searchParams.get('models');
		const metric = url.searchParams.get('metric') || 'cost';

		// Validate period parameter
		if (!['month', 'quarter', 'year'].includes(period)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid period. Must be month, quarter, or year' };
			return;
		}

		// Validate month parameter
		if (month !== 'current' && !/^\d{4}-\d{2}$/.test(month)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid month format. Use "current" or "YYYY-MM"' };
			return;
		}

		// Validate metric parameter
		if (!['cost', 'tokens', 'both'].includes(metric)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid metric. Must be cost, tokens, or both' };
			return;
		}

		// Build query parameters for GET request
		const queryParams = new URLSearchParams({ period, month, metric });
		if (models) {
			queryParams.set('models', models);
		}
		
		const { data, error } = await supabaseClient.functions.invoke(
			`billing-usage-analytics?${queryParams}`,
			{ method: 'GET' }
		);

		if (error) {
			logger.error(`BillingHandler: getUsageAnalytics: Edge function error`, { error });
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error getting usage analytics:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to get usage analytics' };
	}
}

/**
 * Get enhanced purchase history for Usage & History tab
 * Calls billing-invoice-history edge function
 */
export async function getEnhancedPurchaseHistory(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`BillingHandler: getEnhancedPurchaseHistory: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		// Extract query parameters
		const url = new URL(ctx.request.url);
		const type = url.searchParams.get('type') || 'all';
		const status = url.searchParams.get('status') || 'all';
		const date_start = url.searchParams.get('date_start');
		const date_end = url.searchParams.get('date_end');
		const page = parseInt(url.searchParams.get('page') || '1', 10);
		const per_page = Math.min(parseInt(url.searchParams.get('per_page') || '25', 10), 100);

		// Validate parameters
		if (!['all', 'subscription', 'credit_purchase', 'auto_topup'].includes(type)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid transaction type' };
			return;
		}

		if (!['all', 'pending', 'completed', 'failed', 'refunded'].includes(status)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid status' };
			return;
		}

		if (page < 1) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Page must be >= 1' };
			return;
		}

		if (per_page < 1 || per_page > 100) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Per page must be between 1 and 100' };
			return;
		}

		// Validate date format if provided
		if (date_start && !/^\d{4}-\d{2}-\d{2}$/.test(date_start)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid date_start format. Use YYYY-MM-DD' };
			return;
		}

		if (date_end && !/^\d{4}-\d{2}-\d{2}$/.test(date_end)) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Invalid date_end format. Use YYYY-MM-DD' };
			return;
		}

		// Build query parameters for GET request
		const queryParams = new URLSearchParams();
		if (type !== 'all') queryParams.set('type', type);
		if (status !== 'all') queryParams.set('status', status);
		if (date_start) queryParams.set('date_start', date_start);
		if (date_end) queryParams.set('date_end', date_end);
		queryParams.set('page', page.toString());
		queryParams.set('per_page', per_page.toString());
		
		const { data, error } = await supabaseClient.functions.invoke(
			`billing-invoice-history?${queryParams}`,
			{ method: 'GET' }
		);

		if (error) {
			logger.error(`BillingHandler: getEnhancedPurchaseHistory: Edge function error`, { error });
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error getting enhanced purchase history:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to get purchase history' };
	}
}
