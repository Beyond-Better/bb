import { Router } from '@oak/oak';
import { getAvailablePlans } from './subscription.handlers.ts';

const subscriptionRouter = new Router();

subscriptionRouter
	.get('/plans', getAvailablePlans);

export default subscriptionRouter;
