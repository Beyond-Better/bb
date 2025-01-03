import { Router } from '@oak/oak';
import {
	createSetupIntent,
	listPaymentMethods,
	setDefaultPaymentMethod,
	removePaymentMethod,
	purchaseUsageBlock,
} from './billing.handlers.ts';

const billingRouter = new Router();

billingRouter
	.post('/payment-methods/setup', createSetupIntent)
	.get('/payment-methods', listPaymentMethods)
	.post('/payment-methods/default', setDefaultPaymentMethod)
	.delete('/payment-methods/:id', removePaymentMethod)
	.post('/usage/purchase', purchaseUsageBlock);

export default billingRouter;