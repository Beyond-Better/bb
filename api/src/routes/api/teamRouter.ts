import { Router } from '@oak/oak';
import teamFeaturesRouter from './teamFeaturesRouter.ts';

const teamRouter = new Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     Team:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Team ID
 *         name:
 *           type: string
 *           description: Team name
 *         description:
 *           type: string
 *           description: Team description
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     TeamMember:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           description: User ID
 *         team_id:
 *           type: string
 *           description: Team ID
 *         role:
 *           type: string
 *           enum: [owner, admin, member]
 *           description: Member role
 *         status:
 *           type: string
 *           enum: [active, inactive, pending]
 *           description: Membership status
 *         joined_at:
 *           type: string
 *           format: date-time
 *           description: Join timestamp
 */

teamRouter
	// Mount team features sub-router
	.use('/:teamId/features', teamFeaturesRouter.routes(), teamFeaturesRouter.allowedMethods());

export default teamRouter;
