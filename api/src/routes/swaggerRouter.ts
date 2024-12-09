import type { Context } from '@oak/oak';
import { Router } from '@oak/oak';
import swaggerJsdoc from 'swagger-jsdoc';
//import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import { getVersionInfo } from 'shared/version.ts';

// const configManager = await ConfigManagerV2.getInstance();
// const globalConfig = await configManager.getGlobalConfig();
const versionInfo = await getVersionInfo();
const swaggerDefinition = {
	openapi: '3.0.0',
	info: {
		title: 'BB API',
		version: versionInfo.version,
		description:
			`BB (Beyond Better) is an advanced AI-powered assistant designed to revolutionize how you work with text-based projects. Whether you're coding, writing, or managing complex documentation, BB is here to help you "be better" at every step.`,
	},
};

const options = {
	swaggerDefinition,
	// Path to the API docs
	// Note that this path is relative to the current directory from which deno is ran, not the application itself.
	apis: ['./src/routes/routes.ts', './src/routes/api/*.handlers.ts', './src/routes/swaggerRouter.ts'],
	failOnErrors: true,
	verbose: true,
};

// Initialize swagger-jsdoc -> returns validated swagger spec in json format
const swaggerSpec = swaggerJsdoc(options);

/**
 * @openapi
 * /api-docs/openapi.json:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the OpenAPI specification for the BB API in JSON format
 *     responses:
 *       200:
 *         description: Successful response with OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

/**
 * @openapi
 * /api-docs/swagger.json:
 *   get:
 *     summary: Get Swagger specification
 *     description: Returns the Swagger specification for the BB API in JSON format
 *     responses:
 *       200:
 *         description: Successful response with Swagger specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

// swagger routes
const swaggerRouter = new Router();
swaggerRouter
	.get('/openapi.json', (ctx: Context) => {
		ctx.response.body = swaggerSpec;
	})
	.get('/swagger.json', (ctx: Context) => {
		ctx.response.body = swaggerSpec;
	});

export default swaggerRouter;
