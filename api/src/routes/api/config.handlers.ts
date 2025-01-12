import type { Context, RouterContext } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';

/**
 * @openapi
 * /api/v1/config/global:
 *   get:
 *     summary: Get global configuration
 *     description: Retrieves the current global configuration settings
 *     responses:
 *       200:
 *         description: Successful response with global configuration
 *       500:
 *         description: Internal server error
 */
export const getGlobalConfig = async (
	{ response }: { response: Context['response'] },
) => {
	try {
		const configManager = await ConfigManagerV2.getInstance();
		const config = await configManager.getGlobalConfig();

		response.status = 200;
		response.body = config;
	} catch (error) {
		logger.error(`ConfigHandler: Error in getGlobalConfig: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to retrieve global configuration' };
	}
};

/**
 * @openapi
 * /api/v1/config/global:
 *   put:
 *     summary: Update global configuration
 *     description: Updates a single global configuration value
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *                 description: Configuration key in dot notation (e.g., "api.maxTurns")
 *               value:
 *                 type: string
 *                 description: New value for the configuration key
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Internal server error
 */
export const updateGlobalConfig = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const body = await request.body.json();
		const { key, value } = body;

		if (!key || value === undefined) {
			response.status = 400;
			response.body = { error: 'Missing required fields: key and value' };
			return;
		}

		const configManager = await ConfigManagerV2.getInstance();
		await configManager.setGlobalConfigValue(key, value);

		response.status = 200;
		response.body = { message: 'Configuration updated successfully' };
	} catch (error) {
		logger.error(`ConfigHandler: Error in updateGlobalConfig: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to update global configuration' };
	}
};

/**
 * @openapi
 * /api/v1/config/project/{id}:
 *   get:
 *     summary: Get project configuration
 *     description: Retrieves configuration for a specific project
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Successful response with project configuration
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const getProjectConfig = async (
	{ params, response }: RouterContext<'/project/:id', { id: string }>,
) => {
	try {
		const configManager = await ConfigManagerV2.getInstance();
		const config = await configManager.getProjectConfig(params.id);

		response.status = 200;
		response.body = config;
	} catch (error) {
		const e = error as Error;
		if (e.message.includes('not found')) {
			response.status = 404;
			response.body = { error: 'Project not found' };
		} else {
			logger.error(`ConfigHandler: Error in getProjectConfig: ${e.message}`);
			response.status = 500;
			response.body = { error: 'Failed to retrieve project configuration' };
		}
	}
};

/**
 * @openapi
 * /api/v1/config/project/{id}:
 *   put:
 *     summary: Update project configuration
 *     description: Updates a single project configuration value
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *                 description: Configuration key in dot notation (e.g., "settings.api.maxTurns")
 *               value:
 *                 type: string
 *                 description: New value for the configuration key
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       400:
 *         description: Invalid request body
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const updateProjectConfig = async (
	{ params, request, response }: RouterContext<'/project/:id', { id: string }>,
) => {
	try {
		const body = await request.body.json();
		const { key, value } = body;

		if (!key || value === undefined) {
			response.status = 400;
			response.body = { error: 'Missing required fields: key and value' };
			return;
		}

		const configManager = await ConfigManagerV2.getInstance();
		await configManager.setProjectConfigValue(params.id, key, value);

		response.status = 200;
		response.body = { message: 'Configuration updated successfully' };
	} catch (error) {
		const e = error as Error;
		if (e.message.includes('not found')) {
			response.status = 404;
			response.body = { error: 'Project not found' };
		} else {
			logger.error(`ConfigHandler: Error in updateProjectConfig: ${e.message}`);
			response.status = 500;
			response.body = { error: 'Failed to update project configuration' };
		}
	}
};
