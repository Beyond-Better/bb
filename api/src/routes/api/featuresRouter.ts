import { Router } from '@oak/oak';
import {
	getUserFeatureProfile,
	checkUserFeatureAccess,
	batchCheckUserFeatureAccess,
	getUserAvailableModels,
	getUserAvailableDatasources,
	getUserRateLimits,
	refreshUserFeatureCache,
} from './features.handlers.ts';

const featuresRouter = new Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     FeatureAccessResponse:
 *       type: object
 *       properties:
 *         access_granted:
 *           type: boolean
 *           description: Whether access is granted
 *         feature_value:
 *           type: any
 *           description: The feature value (if applicable)
 *         access_reason:
 *           type: string
 *           description: Reason for access decision
 *           example: plan_feature
 *         resolved_from:
 *           type: string
 *           description: Where the access was resolved from
 *           example: subscription_plan
 *     UserFeatureProfile:
 *       type: object
 *       properties:
 *         models:
 *           type: array
 *           items:
 *             type: string
 *           description: Available models
 *           example: ["claude.haiku", "claude.sonnet", "openai.gpt4"]
 *         datasources:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               read:
 *                 type: boolean
 *               write:
 *                 type: boolean
 *           description: Available datasources with permissions
 *           example: [{"name": "filesystem", "read": true, "write": true}]
 *         tools:
 *           type: array
 *           items:
 *             type: string
 *           description: Available tools
 *           example: ["builtin", "external"]
 *         limits:
 *           type: object
 *           properties:
 *             tokensPerMinute:
 *               type: number
 *               description: Tokens per minute limit
 *             requestsPerMinute:
 *               type: number
 *               description: Requests per minute limit
 *           example: {"tokensPerMinute": 1000, "requestsPerMinute": 60}
 *         support:
 *           type: object
 *           properties:
 *             community:
 *               type: boolean
 *               description: Community support access
 *             email:
 *               type: boolean
 *               description: Email support access
 *             priorityQueue:
 *               type: boolean
 *               description: Priority queue access
 *             earlyAccess:
 *               type: boolean
 *               description: Early access features
 *             workspaceIsolation:
 *               type: boolean
 *               description: Workspace isolation feature
 *             sso:
 *               type: boolean
 *               description: Single sign-on access
 *             dedicatedCSM:
 *               type: boolean
 *               description: Dedicated customer success manager
 *             onPremises:
 *               type: boolean
 *               description: On-premises deployment option
 *     FeatureCheckRequest:
 *       type: object
 *       properties:
 *         featureKey:
 *           type: string
 *           description: The feature key to check
 *           example: models.claude.sonnet
 *       required:
 *         - featureKey
 *     BatchFeatureCheckRequest:
 *       type: object
 *       properties:
 *         featureKeys:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of feature keys to check
 *           example: ["models.claude.sonnet", "datasources.github", "tools.builtin"]
 *       required:
 *         - featureKeys
 *     UserDatasource:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Datasource name
 *           example: filesystem
 *         read:
 *           type: boolean
 *           description: Read access
 *         write:
 *           type: boolean
 *           description: Write access
 *     UserRateLimits:
 *       type: object
 *       properties:
 *         tokensPerMinute:
 *           type: number
 *           description: Tokens per minute limit
 *           example: 1000
 *         requestsPerMinute:
 *           type: number
 *           description: Requests per minute limit
 *           example: 60
 */

featuresRouter
	// Get complete user feature profile
	.get('/', getUserFeatureProfile)
	// Check single feature access
	.post('/check', checkUserFeatureAccess)
	// Batch check multiple features
	.post('/batch', batchCheckUserFeatureAccess)
	// Get available models
	.get('/models', getUserAvailableModels)
	// Get available datasources
	.get('/datasources', getUserAvailableDatasources)
	// Get user rate limits
	.get('/limits', getUserRateLimits)
	// Refresh feature cache
	.post('/cache/refresh', refreshUserFeatureCache);

export default featuresRouter;