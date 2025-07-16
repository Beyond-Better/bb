import { Router } from '@oak/oak';
import { checkTeamFeatureAccess, getTeamAvailableModels, getTeamFeatureProfile } from './teamFeatures.handlers.ts';

const teamFeaturesRouter = new Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     TeamFeatureProfile:
 *       type: object
 *       properties:
 *         teamId:
 *           type: string
 *           description: Team ID
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
 */

teamFeaturesRouter
	// Get complete team feature profile
	.get('/', getTeamFeatureProfile)
	// Check single feature access for team
	.post('/check', checkTeamFeatureAccess)
	// Get available models for team
	.get('/models', getTeamAvailableModels);

export default teamFeaturesRouter;
