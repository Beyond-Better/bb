import { Router } from '@oak/oak';
import billingRouter from './billingRouter.ts';
import featuresRouter from './featuresRouter.ts';
import { cancelSubscription, changePlan, getCurrentSubscription, getPreview } from './subscription.handlers.ts';
import { getUserPreferences, updateUserPreferences } from './userPreferences.handlers.ts';

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
 *     UserPreferences:
 *       type: object
 *       properties:
 *         theme:
 *           type: string
 *           enum: [light, dark, system]
 *           description: UI theme preference
 *         fontSize:
 *           type: string
 *           enum: [small, medium, large]
 *           description: Font size preference
 *         language:
 *           type: string
 *           description: Language preference
 *         timezone:
 *           type: string
 *           description: User timezone
 *         notifications:
 *           type: object
 *           properties:
 *             audioEnabled:
 *               type: boolean
 *               description: Enable audio notifications
 *             browserNotifications:
 *               type: boolean
 *               description: Enable browser push notifications
 *             visualIndicators:
 *               type: boolean
 *               description: Enable visual indicators (tab title, favicon)
 *             customAudioUrl:
 *               type: string
 *               description: Custom audio file URL
 *             volume:
 *               type: number
 *               minimum: 0
 *               maximum: 1
 *               description: Notification volume (0.0 to 1.0)
 *         defaultProjectId:
 *           type: string
 *           description: Default project ID
 *         recentProjects:
 *           type: array
 *           items:
 *             type: string
 *           description: Recently accessed project IDs
 *         projectViewMode:
 *           type: string
 *           enum: [list, grid]
 *           description: Project view mode preference
 */

userRouter
	.get('/preferences', getUserPreferences)
	.put('/preferences', updateUserPreferences)
	.get('/subscription/current', getCurrentSubscription)
	.post('/subscription/change', changePlan)
	.post('/subscription/preview', getPreview)
	.post('/subscription/cancel', cancelSubscription)
	.use('/billing', billingRouter.routes(), billingRouter.allowedMethods())
	.use('/features', featuresRouter.routes(), featuresRouter.allowedMethods());

export default userRouter;
