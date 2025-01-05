import { Router } from '@oak/oak';
import billingRouter from './billingRouter.ts';
import { changePlan, getCurrentSubscription, getPreview, cancelSubscription } from './subscription.handlers.ts';

const userRouter = new Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     BillingConfig:
 *       type: object
 *       properties:
 *         stripeKey:
 *           type: string
 *           description: Stripe publishable key
 *           example: pk_test_123...
 *         mode:
 *           type: string
 *           enum: [test, live]
 *           description: Current Stripe mode
 *     PaymentMethod:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Internal payment method ID
 *         stripeId:
 *           type: string
 *           description: Stripe payment method ID
 *         type:
 *           type: string
 *           example: card
 *         isDefault:
 *           type: boolean
 *         card:
 *           type: object
 *           properties:
 *             brand:
 *               type: string
 *               example: visa
 *             last4:
 *               type: string
 *             expMonth:
 *               type: number
 *             expYear:
 *               type: number
 */


userRouter
	.get('/subscription/current', getCurrentSubscription)
	.post('/subscription/change', changePlan)
	.post('/subscription/preview', getPreview)
	.post('/subscription/cancel', cancelSubscription)
	.use('/billing', billingRouter.routes(), billingRouter.allowedMethods());

export default userRouter;
