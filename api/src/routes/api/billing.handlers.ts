import type { Context, RouterContext } from '@oak/oak';
import type { PaymentMethod, SetupIntent, UsageBlockPurchase, UsageBlockResponse } from '../../types/billing.ts';
import type { SessionManager } from '../../auth/session.ts';
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
		const { amount, stripe_payment_method_id, subscription_id, payment_type } = body;

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
				metadata: {
					subscription_id,
					payment_type,
				},
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

		if (!amount || amount <= 0) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Valid purchase amount is required' };
			return;
		}

		const { data, error } = await supabaseClient.functions.invoke('usage-purchase', {
			method: 'POST',
			body: { amount, paymentMethodId },
		});

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
