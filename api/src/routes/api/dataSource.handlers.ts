import type { RouterContext } from '@oak/oak';
import { join } from '@std/path';
import { logger } from 'shared/logger.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { getDataSourceRegistry } from 'api/resources/dataSourceRegistry.ts';
import type { ClientDataSource } from 'shared/types/project.ts';
import { DataSource } from 'api/resources/dataSource.ts';
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
export const getDataSourceTypes = async (
	{ request, response }: RouterContext<'/types'>,
) => {
	try {
		//logger.info('DataSourceHandler: getDataSourceTypes called');

		// Parse query parameters for mcpServers if provided
		const url = new URL(request.url);
		const mcpServersParam = url.searchParams.get('mcpServers');
		const mcpServers = mcpServersParam ? JSON.parse(mcpServersParam) : undefined;

		// Get available data source types with filtering
		const dataSourceRegistry = await getDataSourceRegistry();
		const types = dataSourceRegistry.getFilteredTypes(mcpServers);

		response.status = 200;
		response.body = { dataSourceTypes: types };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in getDataSourceTypes: ${errorMessage(error)}`);
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
export const listDataSources = async (
	{ params, response }: RouterContext<'/:projectId/datasource', { projectId: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: listDataSources called');
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
		//const dataSources = project.getDataSources();

		// Convert to client format
		const clientDataSources = project.toClientData().dataSources;

		response.status = 200;
		response.body = { dataSources: clientDataSources };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in listDataSources: ${errorMessage(error)}`);
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
export const getDataSource = async (
	{ params, response }: RouterContext<'/:projectId/datasource/:id', { projectId: string; id: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: getDataSource called');
		const { projectId, id: dataSourceId } = params;

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data source
		//const dataSource = project.getDataSource(dataSourceId);
		//if (!dataSource) {
		//  response.status = 404;
		//  response.body = { error: 'Data source not found' };
		//  return;
		//}

		// Find the matching client data source
		const clientDataSources = project.toClientData().dataSources;
		const clientDataSource = clientDataSources.find((ds) => ds.id === dataSourceId);

		response.status = 200;
		response.body = { dataSource: clientDataSource };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in getDataSource: ${errorMessage(error)}`);
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
export const addDataSource = async (
	{ params, request, response }: RouterContext<'/:projectId/datasource', { projectId: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: addDataSource called');
		const { projectId } = params;
		const body = await request.body.json();
		const dataSourceData = body as ClientDataSource;

		// Handle rootPath for filesystem data sources
		if (
			dataSourceData.type === 'filesystem' && dataSourceData.config?.dataSourceRoot &&
			typeof dataSourceData.config.dataSourceRoot === 'string'
		) {
			const rootPath = body.rootPath || Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

			// If the path doesn't start with rootPath, assume it's relative and join them
			if (!dataSourceData.config.dataSourceRoot.startsWith('/')) {
				dataSourceData.config.dataSourceRoot = join(rootPath, dataSourceData.config.dataSourceRoot);
			} else if (!dataSourceData.config.dataSourceRoot.startsWith(rootPath)) {
				dataSourceData.config.dataSourceRoot = join(rootPath, dataSourceData.config.dataSourceRoot);
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
		const dataSource = DataSource.fromObject(dataSourceData);
		await project.registerDataSource(dataSource);

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
		logger.error(`DataSourceHandler: Error in addDataSource: ${errorMessage(error)}`);
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
export const updateDataSource = async (
	{ params, request, response }: RouterContext<'/:projectId/datasource/:id', { projectId: string; id: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: updateDataSource called');
		const { projectId, id: dataSourceId } = params;
		const body = await request.body.json();
		const updates = body as Partial<ClientDataSource>;
		//logger.info('DataSourceHandler: updateDataSource:', {updates});

		// Handle rootPath for filesystem data sources
		if (
			updates.type === 'filesystem' && updates.config?.dataSourceRoot &&
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
		//logger.info('DataSourceHandler: updateDataSource - resolved paths:', {updates});

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data source
		const dataSource = project.getDataSource(dataSourceId);
		if (!dataSource) {
			response.status = 404;
			response.body = { error: 'Data source not found' };
			return;
		}

		// Update the data source - now with awaited persistence
		await project.updateDataSource(dataSourceId, updates);

		// Check if project is valid and update status accordingly
		const isValid = isProjectValid(project);

		// If project is currently draft and is now valid, promote to active
		if (project.status === 'draft' && isValid) await project.setStatus('active');

		// If project is currently active and is no longer valid, demote to draft
		if (project.status === 'active' && !isValid) await project.setStatus('draft');

		//logger.info('DataSourceHandler: updateDataSource: Getting updated configs');
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
		logger.error(`DataSourceHandler: Error in updateDataSource: ${errorMessage(error)}`);
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
export const removeDataSource = async (
	{ params, response }: RouterContext<'/:projectId/datasource/:id', { projectId: string; id: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: removeDataSource called');
		const { projectId, id: dataSourceId } = params;

		// Get project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Get data source
		const dataSource = project.getDataSource(dataSourceId);
		if (!dataSource) {
			response.status = 404;
			response.body = { error: 'Data source not found' };
			return;
		}

		// Remove the data source
		await project.removeDataSource(dataSourceId);

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
		logger.error(`DataSourceHandler: Error in removeDataSource: ${errorMessage(error)}`);
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
 *               - dataSourceId
 *             properties:
 *               dataSourceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Primary data source set successfully
 *       404:
 *         description: Project or data source not found
 *       500:
 *         description: Internal server error
 */
export const setPrimaryDataSource = async (
	{ params, request, response }: RouterContext<'/:projectId/primary-datasource', { projectId: string }>,
) => {
	try {
		//logger.info('DataSourceHandler: setPrimaryDataSource called');
		const { projectId } = params;
		const body = await request.body.json();
		const { dataSourceId } = body;

		if (!dataSourceId) {
			response.status = 400;
			response.body = { error: 'Missing dataSourceId in request body' };
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
		const dataSource = project.getDataSource(dataSourceId);
		if (!dataSource) {
			response.status = 404;
			response.body = { error: 'Data source not found' };
			return;
		}

		// Set as primary
		await project.setPrimaryDataSource(dataSourceId);

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
		logger.error(`DataSourceHandler: Error in setPrimaryDataSource: ${errorMessage(error)}`);
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
export const getDataSourceTypesForProject = async (
	{ params, request, response }: RouterContext<'/:projectId/datasource/types'>,
) => {
	try {
		//logger.info('DataSourceHandler: getDataSourceTypesForProject called');
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
		//logger.info('DataSourceHandler: getDataSourceTypesForProject', { mcpServers });

		// Get available data source types with filtering
		const dataSourceRegistry = await getDataSourceRegistry();
		const dataSourceTypes = dataSourceRegistry.getFilteredTypes(mcpServers);
		//logger.info('DataSourceHandler: getDataSourceTypesForProject', { dataSourceTypes });

		response.status = 200;
		response.body = { dataSourceTypes };
	} catch (error) {
		logger.error(`DataSourceHandler: Error in getDataSourceTypesForProject: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to get data source types for project', details: errorMessage(error) };
	}
};
