import type { RouterContext } from '@oak/oak';
import { join } from '@std/path';
import { logger } from 'shared/logger.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type { ClientDataSourceConnection } from 'shared/types/project.ts';
import type { ProjectId } from 'shared/types.ts';
import { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
import { enhanceProjectWithSources, isProjectValid } from 'shared/projectData.ts';
import { errorMessage } from 'shared/error.ts';

// Generic datasource handlers - not project specific

/**
 * @openapi
 * /api/v1/datasource/types:
 *   get:
 *     summary: Get available data source types
 *     description: Retrieves all available data source types, optionally filtered by MCP servers
 *     parameters:
 *       - in: query
 *         name: mcpServers
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Optional array of MCP server IDs to filter MCP data sources
 *     responses:
 *       200:
 *         description: Successful response with data source types
 *       500:
 *         description: Internal server error
 */
export const getDsProviders = async (
	{ request, response }: RouterContext<'/types'>,
) => {
	try {
		//logger.info('DataSourceHandler: getDsProviders called');

		// Parse query parameters for mcpServers if provided
		const url = new URL(request.url);
		const mcpServersParam = url.searchParams.get('mcpServers');
		const mcpServers = mcpServersParam ? JSON.parse(mcpServersParam) : undefined;

		// Get available data source types with filtering
		const dataSourceRegistry = await getDataSourceRegistry();
		const types = dataSourceRegistry.getFilteredProviders(mcpServers);

		response.status = 200;
		response.body = { dsProviders: types };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in getDsProviders: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to get data source types', details: errorMessage(error) };
	}
};

// Project-specific datasource handlers

/**
 * @openapi
 * /api/v1/projects/{projectId}/datasource:
 *   get:
 *     summary: List all data sources for a project
 *     description: Retrieves all data sources associated with a specific project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *     responses:
 *       200:
 *         description: Successful response with data sources
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const listDsConnections = async (
	{ params, response }: RouterContext<'/:projectId/datasource', { projectId: ProjectId }>,
) => {
	try {
		//logger.info('DataSourceHandler: listDsConnections called');
		const { projectId } = params;

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data sources
		//const dsConnections = project.getDsConnections();

		// Convert to client format
		const clientDsConnections = project.toClientData().dsConnections;

		response.status = 200;
		response.body = { dsConnections: clientDsConnections };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in listDsConnections: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to list data sources', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{projectId}/datasource/{id}:
 *   get:
 *     summary: Get a specific data source
 *     description: Retrieves details of a specific data source
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the data source
 *     responses:
 *       200:
 *         description: Successful response with data source details
 *       404:
 *         description: Project or data source not found
 *       500:
 *         description: Internal server error
 */
export const getDsConnection = async (
	{ params, response }: RouterContext<'/:projectId/datasource/:id', { projectId: ProjectId; id: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: getDsConnection called');
		const { projectId, id: dsConnectionId } = params;

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data source
		//const dsConnection = project.getDsConnection(dsConnectionId);
		//if (!dsConnection) {
		//  response.status = 404;
		//  response.body = { error: 'Data source not found' };
		//  return;
		//}

		// Find the matching client data source
		const clientDsConnections = project.toClientData().dsConnections;
		const clientDsConnection = clientDsConnections.find((ds) => ds.id === dsConnectionId);

		response.status = 200;
		response.body = { dsConnection: clientDsConnection };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in getDsConnection: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to get data source', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{projectId}/datasource:
 *   post:
 *     summary: Add a new data source
 *     description: Adds a new data source to a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Data source added successfully
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const addDsConnection = async (
	{ params, request, response }: RouterContext<'/:projectId/datasource', { projectId: ProjectId }>,
) => {
	try {
		//logger.info('DataSourceHandler: addDsConnection called');
		const { projectId } = params;
		const body = await request.body.json();
		const dsConnectionData = body as ClientDataSourceConnection;

		// Handle rootPath for filesystem data sources
		if (
			dsConnectionData.providerType === 'filesystem' && dsConnectionData.config?.dataSourceRoot &&
			typeof dsConnectionData.config.dataSourceRoot === 'string'
		) {
			const rootPath = body.rootPath || Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

			// If the path doesn't start with rootPath, assume it's relative and join them
			if (!dsConnectionData.config.dataSourceRoot.startsWith('/')) {
				dsConnectionData.config.dataSourceRoot = join(rootPath, dsConnectionData.config.dataSourceRoot);
			} else if (!dsConnectionData.config.dataSourceRoot.startsWith(rootPath)) {
				dsConnectionData.config.dataSourceRoot = join(rootPath, dsConnectionData.config.dataSourceRoot);
			}
		}

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Create and add the data source
		const dsConnection = await DataSourceConnection.fromJSON(dsConnectionData);
		await project.registerDsConnection(dsConnection);

		// Check if project is valid and update status accordingly
		const isValid = isProjectValid(project);

		// If project is currently draft and is now valid, promote to active
		if (project.status === 'draft' && isValid) await project.setStatus('active');

		// If project is currently active and is no longer valid, demote to draft
		if (project.status === 'active' && !isValid) await project.setStatus('draft');

		// Get updated project with config sources
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(projectId);

		// Convert to client data format
		const clientData = project.toClientData();

		// Create enhanced project response
		const enhancedProject = enhanceProjectWithSources(
			clientData,
			projectConfig,
			globalConfig,
		);

		response.status = 200;
		response.body = { project: enhancedProject };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in addDsConnection: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to add data source', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{projectId}/datasource/{id}:
 *   put:
 *     summary: Update a data source
 *     description: Updates an existing data source
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the data source
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Data source updated successfully
 *       404:
 *         description: Project or data source not found
 *       500:
 *         description: Internal server error
 */
export const updateDsConnection = async (
	{ params, request, response }: RouterContext<'/:projectId/datasource/:id', { projectId: ProjectId; id: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: updateDsConnection called');
		const { projectId, id: dsConnectionId } = params;
		const body = await request.body.json();
		const updates = body as Partial<ClientDataSourceConnection>;
		//logger.info('DataSourceHandler: updateDsConnection:', {updates});

		// Handle rootPath for filesystem data sources
		if (
			updates.providerType === 'filesystem' && updates.config?.dataSourceRoot &&
			typeof updates.config.dataSourceRoot === 'string'
		) {
			const rootPath = body.rootPath || Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

			// If the path doesn't start with rootPath, assume it's relative and join them
			if (!updates.config.dataSourceRoot.startsWith('/')) {
				updates.config.dataSourceRoot = join(rootPath, updates.config.dataSourceRoot);
			} else if (!updates.config.dataSourceRoot.startsWith(rootPath)) {
				updates.config.dataSourceRoot = join(rootPath, updates.config.dataSourceRoot);
			}
		}
		//logger.info('DataSourceHandler: updateDsConnection - resolved paths:', {updates});

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data source
		const dsConnection = project.getDsConnection(dsConnectionId);
		if (!dsConnection) {
			response.status = 404;
			response.body = { error: 'Data source not found' };
			return;
		}

		// Update the data source - now with awaited persistence
		await project.updateDsConnection(dsConnectionId, updates);

		// Check if project is valid and update status accordingly
		const isValid = isProjectValid(project);

		// If project is currently draft and is now valid, promote to active
		if (project.status === 'draft' && isValid) await project.setStatus('active');

		// If project is currently active and is no longer valid, demote to draft
		if (project.status === 'active' && !isValid) await project.setStatus('draft');

		//logger.info('DataSourceHandler: updateDsConnection: Getting updated configs');
		// Get updated project with config sources
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(projectId);

		// Convert to client data format
		const clientData = project.toClientData();

		// Create enhanced project response
		const enhancedProject = enhanceProjectWithSources(
			clientData,
			projectConfig,
			globalConfig,
		);

		response.status = 200;
		response.body = { project: enhancedProject };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in updateDsConnection: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to update data source', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{projectId}/datasource/{id}:
 *   delete:
 *     summary: Remove a data source
 *     description: Removes a data source from a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the data source
 *     responses:
 *       200:
 *         description: Data source removed successfully
 *       404:
 *         description: Project or data source not found
 *       500:
 *         description: Internal server error
 */
export const removeDsConnection = async (
	{ params, response }: RouterContext<'/:projectId/datasource/:id', { projectId: ProjectId; id: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: removeDsConnection called');
		const { projectId, id: dsConnectionId } = params;

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data source
		const dsConnection = project.getDsConnection(dsConnectionId);
		if (!dsConnection) {
			response.status = 404;
			response.body = { error: 'Data source not found' };
			return;
		}

		// Remove the data source
		await project.removeDsConnection(dsConnectionId);

		// Check if project is valid and update status accordingly
		const isValid = isProjectValid(project);

		// If project is currently draft and is now valid, promote to active
		if (project.status === 'draft' && isValid) await project.setStatus('active');

		// If project is currently active and is no longer valid, demote to draft
		if (project.status === 'active' && !isValid) await project.setStatus('draft');

		// Get updated project with config sources
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(projectId);

		// Convert to client data format
		const clientData = project.toClientData();

		// Create enhanced project response
		const enhancedProject = enhanceProjectWithSources(
			clientData,
			projectConfig,
			globalConfig,
		);

		response.status = 200;
		response.body = { project: enhancedProject };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in removeDsConnection: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to remove data source', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{projectId}/primary-datasource:
 *   put:
 *     summary: Set a data source as primary
 *     description: Sets a specific data source as the primary data source for a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dsConnectionId
 *             properties:
 *               dsConnectionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Primary data source set successfully
 *       404:
 *         description: Project or data source not found
 *       500:
 *         description: Internal server error
 */
export const setPrimaryDsConnection = async (
	{ params, request, response }: RouterContext<'/:projectId/primary-datasource', { projectId: ProjectId }>,
) => {
	try {
		//logger.info('DataSourceHandler: setPrimaryDsConnection called');
		const { projectId } = params;
		const body = await request.body.json();
		const { dsConnectionId } = body;

		if (!dsConnectionId) {
			response.status = 400;
			response.body = { error: 'Missing dsConnectionId in request body' };
			return;
		}

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data source
		const dsConnection = project.getDsConnection(dsConnectionId);
		if (!dsConnection) {
			response.status = 404;
			response.body = { error: 'Data source not found' };
			return;
		}

		// Set as primary
		await project.setPrimaryDsConnection(dsConnectionId);

		// Check if project is valid and update status accordingly
		const isValid = isProjectValid(project);

		// If project is currently draft and is now valid, promote to active
		if (project.status === 'draft' && isValid) await project.setStatus('active');

		// If project is currently active and is no longer valid, demote to draft
		if (project.status === 'active' && !isValid) await project.setStatus('draft');

		// Get updated project with config sources
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(projectId);

		// Convert to client data format
		const clientData = project.toClientData();

		// Create enhanced project response
		const enhancedProject = enhanceProjectWithSources(
			clientData,
			projectConfig,
			globalConfig,
		);

		response.status = 200;
		response.body = { project: enhancedProject };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in setPrimaryDsConnection: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to set primary data source', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{projectId}/datasource/types:
 *   get:
 *     summary: Get available data source types
 *     description: Retrieves all available data source types, optionally filtered by MCP servers
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project
 *     responses:
 *       200:
 *         description: Successful response with data source types
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const getDsProvidersForProject = async (
	{ params, response }: RouterContext<'/:projectId/datasource/types'>,
) => {
	try {
		//logger.info('DataSourceHandler: getDsProvidersForProject called');
		const { projectId } = params;

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		const mcpServers = project.mcpServers;
		//logger.info('DataSourceHandler: getDsProvidersForProject', { mcpServers });

		// Get available data source types with filtering
		const dataSourceRegistry = await getDataSourceRegistry();
		const dsProviders = dataSourceRegistry.getFilteredProviders(mcpServers);
		//logger.info('DataSourceHandler: getDsProvidersForProject', { dsProviders });

		response.status = 200;
		response.body = { dsProviders };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in getDsProvidersForProject: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to get data source types for project', details: errorMessage(error) };
	}
};
