import { Router } from '@oak/oak';
import { requireAuth } from '../middlewares/auth.middleware.ts';
import {
	chatConversation,
	clearConversation,
	deleteConversation,
	getConversation,
	listConversations,
} from './api/conversation.handlers.ts';
import { websocketApp, websocketConversation } from './api/websocket.handlers.ts';
import { getStatus } from './api/status.handlers.ts';
import { logEntryFormatter } from './api/logEntryFormatter.handlers.ts';
import { upgradeApi } from './api/upgrade.handlers.ts';
import { applyFixHandler, checkHandler, reportHandler } from './api/doctor.handlers.ts';
import projectRouter from './api/projectRouter.ts';
import fileRouter from './api/fileRouter.ts';
import authRouter from './api/authRouter.ts';
import userRouter from './api/userRouter.ts';
import subscriptionRouter from './api/subscriptionRouter.ts';

const apiRouter = new Router();

// Define protected routes
const protectedPaths = [
	'/v1/ws/conversation/*',
	'/v1/conversation/*',
	'/v1/project/*',
	'/v1/files/*',
	'/v1/user/*',  // Protect all user routes including subscription
];

apiRouter
	// Apply auth middleware to protected routes
	.use(requireAuth(protectedPaths))
	.get('/v1/status', getStatus)
	// WebSocket endpoints
	.get('/v1/ws/app', websocketApp)
	.get('/v1/ws/conversation/:id', websocketConversation)
	// Conversation endpoints
	.get('/v1/conversation', listConversations)
	.get('/v1/conversation/:id', getConversation)
	.post('/v1/conversation/:id', chatConversation)
	.delete('/v1/conversation/:id', deleteConversation)
	.post('/v1/conversation/:id/clear', clearConversation)
	// Log Entries endpoints
	.post('/v1/format_log_entry/:logEntryDestination/:logEntryFormatterType', logEntryFormatter)
	/**
	 * @openapi
	 * /api/v1/upgrade:
	 *   post:
	 *     summary: Upgrade BB to the latest version
	 *     description: |
	 *       Upgrades BB to the latest version. Only works with user-local installations.
	 *       System-wide installations require manual upgrade with sudo.
	 *     responses:
	 *       200:
	 *         description: Upgrade successful
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: true
	 *                 currentVersion:
	 *                   type: string
	 *                   example: '1.0.0'
	 *                 latestVersion:
	 *                   type: string
	 *                   example: '1.1.0'
	 *                 needsRestart:
	 *                   type: boolean
	 *                   example: true
	 *       403:
	 *         description: System-wide installation requires sudo
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: false
	 *                 error:
	 *                   type: string
	 *                   example: 'System-wide installation requires manual upgrade with sudo'
	 *                 needsSudo:
	 *                   type: boolean
	 *                   example: true
	 *       500:
	 *         description: Upgrade failed
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 success:
	 *                   type: boolean
	 *                   example: false
	 *                 error:
	 *                   type: string
	 *                   example: 'Failed to download latest version'
	 */
	.post('/v1/upgrade', upgradeApi)
	/**
	 * @openapi
	 * /api/v1/doctor/check:
	 *   get:
	 *     summary: Run system diagnostic checks
	 *     description: Performs a series of diagnostic checks on the BB system
	 *     responses:
	 *       200:
	 *         description: Diagnostic results
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 results:
	 *                   type: array
	 *                   items:
	 *                     type: object
	 *                     properties:
	 *                       category:
	 *                         type: string
	 *                         example: 'config'
	 *                       status:
	 *                         type: string
	 *                         enum: ['ok', 'warning', 'error']
	 *                       message:
	 *                         type: string
	 *                       details:
	 *                         type: string
	 *                       fix:
	 *                         type: object
	 *                         properties:
	 *                           description:
	 *                             type: string
	 *                           command:
	 *                             type: string
	 *                           apiEndpoint:
	 *                             type: string
	 *                 summary:
	 *                   type: object
	 *                   properties:
	 *                     total:
	 *                       type: number
	 *                     errors:
	 *                       type: number
	 *                     warnings:
	 *                       type: number
	 *                     ok:
	 *                       type: number
	 */
	.get('/v1/doctor/check', checkHandler)
	/**
	 * @openapi
	 * /api/v1/doctor/report:
	 *   get:
	 *     summary: Generate diagnostic report
	 *     description: Generates a comprehensive diagnostic report
	 *     responses:
	 *       200:
	 *         description: Diagnostic report (as downloadable file)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 */
	.get('/v1/doctor/report', reportHandler)
	/**
	 * @openapi
	 * /api/v1/doctor/fix/{type}:
	 *   post:
	 *     summary: Apply a specific fix
	 *     description: Applies a fix for a specific diagnostic issue
	 *     parameters:
	 *       - name: type
	 *         in: path
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Fix applied successfully
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 */
	.post('/v1/doctor/fix/:type', applyFixHandler)
	// Mount sub-routers
	.use('/v1/project', projectRouter.routes(), projectRouter.allowedMethods())
	.use('/v1/files', fileRouter.routes(), fileRouter.allowedMethods())
	.use('/v1/auth', authRouter.routes(), authRouter.allowedMethods())
	.use('/v1/user', userRouter.routes(), userRouter.allowedMethods())
	.use('/v1/subscription', subscriptionRouter.routes(), subscriptionRouter.allowedMethods());

/*
    // NOT IMPLEMENTED
    // Logs endpoint
    .get('/v1/logs', getLogs)
    // Persistence endpoints
    .post('/v1/persist', persistConversation)
    .post('/v1/resume', resumeConversation)
 */

/**
 * @openapi
 * /api/v1/billing/config:
 *   get:
 *     summary: Get Stripe configuration
 *     description: Returns the Stripe publishable key and mode
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stripe configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BillingConfig'
 *       401:
 *         description: Unauthorized
 *
 * /api/v1/billing/payment-methods:
 *   get:
 *     summary: List payment methods
 *     description: Returns all payment methods for the authenticated user
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentMethods:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PaymentMethod'
 *       401:
 *         description: Unauthorized
 *
 * /api/v1/billing/payment-methods/setup:
 *   post:
 *     summary: Create setup intent
 *     description: Creates a SetupIntent for securely collecting payment method details
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Setup intent created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret:
 *                   type: string
 *                   description: Stripe setup intent client secret
 *                 setupIntentId:
 *                   type: string
 *                   description: Stripe setup intent ID
 *       401:
 *         description: Unauthorized
 *
 * /api/v1/billing/payment-methods/default:
 *   post:
 *     summary: Set default payment method
 *     description: Sets the specified payment method as default
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: Internal payment method ID
 *     responses:
 *       200:
 *         description: Default payment method updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *
 * /api/v1/billing/payment-methods/{id}:
 *   delete:
 *     summary: Remove payment method
 *     description: Removes the specified payment method
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Internal payment method ID
 *     responses:
 *       200:
 *         description: Payment method removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *
 * /api/v1/billing/usage/purchase:
 *   post:
 *     summary: Purchase usage block
 *     description: Purchases a usage block with the specified amount
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount in USD
 *               paymentMethodId:
 *                 type: string
 *                 description: Optional payment method ID
 *     responses:
 *       200:
 *         description: Usage block purchased
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 blockId:
 *                   type: string
 *                   description: Usage block ID
 *       401:
 *         description: Unauthorized
 */

export default apiRouter;