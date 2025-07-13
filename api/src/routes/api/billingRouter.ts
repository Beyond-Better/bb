import { Router } from '@oak/oak';
import {
	createCustomerSession,
	createPaymentIntent,
	createSetupIntent,
	getAutoTopupStatus,
	getBillingConfig,
	listPaymentMethods,
	listUsageBlocks,
	purchaseUsageBlock,
	removePaymentMethod,
	setDefaultPaymentMethod,
	triggerAutoTopup,
	updateAutoTopupSettings,
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
	.get('/usage/blocks', listUsageBlocks)
	.get('/auto-topup', getAutoTopupStatus)
	.put('/auto-topup', updateAutoTopupSettings)
	.post('/auto-topup', triggerAutoTopup);

export default billingRouter;
