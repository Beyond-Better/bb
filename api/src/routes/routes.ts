import { Router } from '@oak/oak';
import type { Context } from '@oak/oak';
import { errorHandler } from '../middlewares/error.middleware.ts';
import apiRouter from './apiRouter.ts';
import swaggerRouter from './swaggerRouter.ts';

// top-level routes
const router = new Router();
router
	/**
	 * @openapi
	 * /:
	 *   get:
	 *     summary: API root
	 *     description: Returns a welcome message for the BB API and provides a link to the API documentation
	 *     responses:
	 *       200:
	 *         description: Successful response with welcome message and documentation link
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 message:
	 *                   type: string
	 *                   example: Welcome to BB API
	 *                 docs:
	 *                   type: string
	 *                   example: /api-docs/openapi.json
	 */
	.get('/', (ctx: Context) => {
		ctx.response.type = 'application/json';
		ctx.response.body = { message: 'Welcome to BB API', docs: '/api-docs/openapi.json' };
	})
	.use(errorHandler) // Apply the errorHandler to all routes
	.use('/api', apiRouter.routes(), apiRouter.allowedMethods())
	.use('/api-docs', swaggerRouter.routes(), swaggerRouter.allowedMethods());

export default router;
