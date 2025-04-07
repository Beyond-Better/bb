import type { Context } from '@oak/oak';
import type { BillingPreview, Plan, Subscription } from 'shared/types/subscription.ts';
import type { SessionManager } from '../../auth/session.ts';
import { logger } from 'shared/logger.ts';

export async function getCurrentSubscription(ctx: Context) {
	try {
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`SubscriptionHandler: HandlerContinueConversation: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const { data, error } = await supabaseClient.functions.invoke('user-subscription', {
			method: 'GET',
		});

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
				`SubscriptionHandler: HandlerContinueConversation: No session manager configured`,
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
				`SubscriptionHandler: HandlerContinueConversation: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const planId = body.planId;
		const paymentMethodId = body.payment_method_id; // Extract payment method ID

		if (!planId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Plan ID is required' };
			return;
		}
		
		// Log the request details
		logger.info(`SubscriptionHandler: changePlan:`, { planId, paymentMethodId });

		// Pass both planId and paymentMethodId to the edge function
		const { data, error } = await supabaseClient.functions.invoke('user-subscription', {
			method: 'POST',
			body: { planId, paymentMethodId },
		});

		if (error) {
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
				`SubscriptionHandler: HandlerContinueConversation: No session manager configured`,
			);
			ctx.response.status = 400;
			ctx.response.body = { error: 'No session manager configured' };
			return;
		}
		const supabaseClient = sessionManager.getClient();

		const body = await ctx.request.body.json();
		const planId = body.planId;
		logger.info(
			`SubscriptionHandler: createPaymentIntent: args`,
			{ planId },
		);

		if (!planId) {
			ctx.response.status = 400;
			ctx.response.body = { error: 'Plan ID is required' };
			return;
		}

		const { data, error } = await supabaseClient.functions.invoke('user-subscription', {
			method: 'POST',
			body: { planId, preview: true },
		});
		logger.info(
			`SubscriptionHandler: createPaymentIntent: data`,
			{ data, error },
		);

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
				`SubscriptionHandler: HandlerContinueConversation: No session manager configured`,
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
