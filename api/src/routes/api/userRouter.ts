import { Router } from '@oak/oak';
import billingRouter from './billingRouter.ts';
import { changePlan, getCurrentSubscription, getPreview, cancelSubscription } from './subscription.handlers.ts';

const userRouter = new Router();

userRouter
	.get('/subscription/current', getCurrentSubscription)
	.post('/subscription/change', changePlan)
	.post('/subscription/preview', getPreview)
	.post('/subscription/cancel', cancelSubscription)
	.use('/billing', billingRouter.routes(), billingRouter.allowedMethods());

export default userRouter;
