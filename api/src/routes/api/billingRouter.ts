import { Router } from '@oak/oak';
import {
	createCustomerSession,
	createPaymentIntent,
	createSetupIntent,
	getBillingConfig,
	listPaymentMethods,
	listUsageBlocks,
	purchaseUsageBlock,
	removePaymentMethod,
	setDefaultPaymentMethod,
} from './billing.handlers.ts';

const billingRouter = new Router();

billingRouter
	.get('/config', getBillingConfig)
	.post('/customer-session', createCustomerSession)
	.post('/payment-methods/setup', createSetupIntent)
	.post('/payment-intent', createPaymentIntent)
	.get('/payment-methods', listPaymentMethods)
	.post('/payment-methods/default', setDefaultPaymentMethod)
	.delete('/payment-methods/:id', removePaymentMethod)
	.post('/usage/purchase', purchaseUsageBlock)
	.get('/usage/blocks', listUsageBlocks);

export default billingRouter;
