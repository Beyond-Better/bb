import type { Context } from '@oak/oak';
import type { BillingPreview, Plan, Subscription } from 'shared/types/subscription.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { logger } from 'shared/logger.ts';

export async function getCurrentSubscription(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`SubscriptionHandler: getCurrentSubscription: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('user-subscription', {
			method: 'GET',
		});
		//logger.warn(
		//	`SubscriptionHandler: getCurrentSubscription: `,
		//	{ data, error },
		//);

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data as Subscription;
	} catch (err) {
		console.error('Error getting subscription:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to get subscription details' };
	}
}

export async function getAvailablePlans(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`SubscriptionHandler: getAvailablePlans: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();
		//logger.info(`SubscriptionHandler: Getting plans`);

		const { data, error } = await supabaseClient.functions.invoke('plans', {
			method: 'GET',
		});
		//logger.info(`SubscriptionHandler: Plans`, { data, error });

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data as Plan[];
	} catch (err) {
		console.error('Error getting plans:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to get available plans' };
	}
}

export async function changePlan(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`SubscriptionHandler: changePlan: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const planId = body.planId;
		const paymentMethodId = body.payment_method_id; // Extract payment method ID
		const couponCode = body.couponCode; // Extract coupon code

		if (!planId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Plan ID is required' };
			return;
		}

		// Log the request details
		//logger.info(`SubscriptionHandler: changePlan:`, { planId, paymentMethodId, couponCode });

		// Pass planId, paymentMethodId, and couponCode to the edge function
		const requestBody: { planId: string; paymentMethodId?: string; couponCode?: string } = { planId };
		if (paymentMethodId) requestBody.paymentMethodId = paymentMethodId;
		if (couponCode) requestBody.couponCode = couponCode;

		const { data, error } = await supabaseClient.functions.invoke('user-subscription', {
			method: 'POST',
			body: requestBody,
		});

		if (error) {
			logger.error(`SubscriptionHandler: changePlan-error:`, { error });
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data;
	} catch (err) {
		console.error('Error changing plan:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to change subscription plan' };
	}
}

export async function getPreview(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`SubscriptionHandler: getPreview: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const planId = body.planId;
		const couponCode = body.couponCode; // Extract coupon code for preview
		//logger.info( `SubscriptionHandler: getPreview: args`, { planId, couponCode });

		if (!planId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Plan ID is required' };
			return;
		}

		// Build request body with optional coupon code
		const requestBody: { planId: string; preview: boolean; couponCode?: string } = {
			planId,
			preview: true,
		};
		if (couponCode) requestBody.couponCode = couponCode;

		const { data, error } = await supabaseClient.functions.invoke('user-subscription', {
			method: 'POST',
			body: requestBody,
		});
		//logger.info(`SubscriptionHandler: getPreview: data`, { data, error });

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = data as BillingPreview;
	} catch (err) {
		console.error('Error getting preview:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to get billing preview' };
	}
}

export async function cancelSubscription(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`SubscriptionHandler: cancelSubscription: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const cancelAtPeriodEnd = body.cancelAtPeriodEnd ?? true; // Default to true if not specified

		const { data, error } = await supabaseClient.functions.invoke('user-subscription', {
			method: 'POST',
			body: { action: 'cancel', cancelAtPeriodEnd },
		});

		if (error) {
			ctx.response.status = 400;
			ctx.response.body = { error: error.message };
			return;
		}

		ctx.response.body = {
			success: true,
			subscription: data as Subscription,
		};
	} catch (err) {
		console.error('Error canceling subscription:', err);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to cancel subscription' };
	}
}
