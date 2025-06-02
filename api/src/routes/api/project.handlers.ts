import type { Context, RouterContext } from '@oak/oak';
import { join, normalize } from '@std/path';

import { logger } from 'shared/logger.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import type ProjectPersistence from 'api/storage/projectPersistence.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { ClientProjectData } from 'shared/types/project.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
//import type { DataSourceValues } from 'api/resources/dataSource.ts';
import { enhanceProjectWithSources, isProjectValid } from 'shared/projectData.ts';
//import { getDataSourceRegistry } from 'api/resources/dataSourceRegistry.ts';
import { errorMessage } from 'shared/error.ts';

/**
 * @openapi
 * /api/v1/projects:
 *   get:
 *     summary: List projects
 *     description: Retrieves a list of all projects
 *     responses:
 *       200:
 *         description: Successful response with list of projects
 *       500:
 *         description: Internal server error
 */
export const listProjects = async (
	{ response }: { response: Context['response'] },
) => {
	try {
		//logger.info('ProjectHandler: listProjects called');
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();

		//logger.info(`ProjectHandler: Listing all projects`);
		// Get projects as ProjectPersistence instances
		const projectPersistenceManager = await getProjectPersistenceManager();
		const projectInstances = await projectPersistenceManager.listProjects();

		//logger.info(`ProjectHandler: Getting client data for all projects`);
		const projects = await Promise.all(projectInstances.map(async (project) => {
			if (!project) {
				return {
					data: null,
					config: null,
				};
			}
			let projectConfig = {};
			try {
				projectConfig = await configManager.loadProjectConfig(project.projectId);
			} catch (_e) {
				logger.error(`ProjectHandler: Failed to load project config for: ${project.projectId}`);
				// Failed to load project config: No such file or directory
			}
			//const projectDataPath = await project.getProjectDataPath();
			//logger.info(`ProjectHandler: Getting project with data at: ${projectDataPath}`);
			//logger.info(`ProjectHandler: Getting client data for project: ${project.projectId}`);

			let clientData: ClientProjectData | null = null;
			try {
				// Convert to client format before enhancing
				clientData = project.toClientData();
			} catch (_error) {
				logger.error(
					`ProjectHandler: Error in listProjects, could not get client data for: ${project.projectId}`,
				);
			}
			if (!clientData) {
				return {
					data: null,
					config: null,
				};
			}
			//logger.info(`ProjectHandler: Getting client data for project: ${project.projectId}`, {clientData});

			return enhanceProjectWithSources(
				clientData,
				projectConfig,
				globalConfig,
			);
		}));

		response.status = 200;
		response.body = { projects };
	} catch (error) {
		logger.error(`ProjectHandler: Error in listProjects: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to list projects', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/new:
 *   get:
 *     summary: Get project details for new project
 *     description: Retrieves boilerplate of a blank project
 *     responses:
 *       200:
 *         description: Successful response with project details
 *       500:
 *         description: Internal server error
 */
export const blankProject = async (
	{ request: _request, response }: RouterContext<'/new'>,
) => {
	try {
		//logger.info('ProjectHandler: blankProject called');

		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();

		// Create blank client data
		//const clientData: Omit<ClientProjectData, 'projectId'> = {
		const clientData: ClientProjectData = {
			projectId: '',
			name: '',
			status: 'draft',
			dsConnections: [],
			mcpServers: [],
			//defaultModels: DefaultModelsConfigDefaults,
			repoInfo: { tokenLimit: 1024 },
		};

		const project = enhanceProjectWithSources(
			clientData,
			{},
			globalConfig,
		);

		response.status = 200;
		response.body = { project };
	} catch (error) {
		logger.error(`ProjectHandler: Error in getProject: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to get project', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Get project details
 *     description: Retrieves details of a specific project
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to retrieve
 *     responses:
 *       200:
 *         description: Successful response with project details
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const getProject = async (
	{ params, request: _request, response }: RouterContext<'/:id', { id: string }>,
) => {
	try {
		//logger.info('ProjectHandler: getProject called');

		const { id: projectId } = params;

		// Get project as ProjectPersistence instance
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(projectId);

		// Convert to client format before enhancing
		const clientData = project.toClientData();

		//// Get available data source types
		//const dataSourceRegistry = await getDataSourceRegistry()
		//clientData.dataSourceTypes = dataSourceRegistry.getAllTypes();

		const enhancedProject = enhanceProjectWithSources(
			clientData,
			projectConfig,
			globalConfig,
		);

		response.status = 200;
		response.body = {
			project: enhancedProject,
		};
	} catch (error) {
		logger.error(`ProjectHandler: Error in getProject: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to get project', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects:
 *   post:
 *     summary: Create a new project
 *     description: Creates a new project with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - path
 *             properties:
 *               name:
 *                 type: string
 *               path:
 *                 type: string
 *     responses:
 *       200:
 *         description: Project created successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Internal server error
 */
export const createProject = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		//logger.info('ProjectHandler: createProject called');
		const body = await request.body.json();
		const { name = 'New Project', status } = body;

		if (!name) {
			response.status = 400;
			response.body = { error: 'Missing required fields' };
			return;
		}

		// Create project data with a filesystem data source
		const projectData: Omit<ClientProjectData, 'projectId'> = {
			name,
			status,
			dsConnections: [],
			mcpServers: [],
			//defaultModels: DefaultModelsConfigDefaults,
			repoInfo: { tokenLimit: 1024 },
		};

		// Create project
		const projectPersistenceManager = await getProjectPersistenceManager();
		const newProject = await projectPersistenceManager.createProject(projectData);
		const projectId = newProject.projectId;

		// Get the created project instance
		const project = await projectPersistenceManager.getProject(projectId);

		if (!project) {
			throw new Error('Failed to get created project');
		}

		// Update project config values
		const configManager = await getConfigManager();
		// For new projects, always set name
		await configManager.setProjectConfigValue(projectId, 'name', name);
		if (body.config.llmGuidelinesFile !== undefined) {
			await configManager.setProjectConfigValue(projectId, 'llmGuidelinesFile', body.config.llmGuidelinesFile);
		}
		if (body.config.myPersonsName !== undefined) {
			await configManager.setProjectConfigValue(projectId, 'myPersonsName', body.config.myPersonsName);
		}
		if (body.config.myAssistantsName !== undefined) {
			await configManager.setProjectConfigValue(projectId, 'myAssistantsName', body.config.myAssistantsName);
		}

		// Handle defaultModels settings if provided
		if (body.config.defaultModels) {
			//logger.info('ProjectHandler: Processing api settings:', body.config.api);
			if (body.config.defaultModels?.orchestrator !== undefined) {
				//logger.info('ProjectHandler: Setting defaultModels.orchestrator:', {
				//	value: body.config.defaultModels.orchestrator,
				//	type: typeof body.config.defaultModels.orchestrator,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'defaultModels.orchestrator',
					body.config.defaultModels.orchestrator,
				);
			}
			if (body.config.defaultModels?.agent !== undefined) {
				//logger.info('ProjectHandler: Setting defaultModels.agent:', {
				//	value: body.config.defaultModels.agent,
				//	type: typeof body.config.defaultModels.agent,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'defaultModels.agent',
					body.config.defaultModels.agent,
				);
			}
			if (body.config.defaultModels?.chat !== undefined) {
				//logger.info('ProjectHandler: Setting defaultModels.chat:', {
				//	value: body.config.defaultModels.chat,
				//	type: typeof body.config.defaultModels.chat,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'defaultModels.chat',
					body.config.defaultModels.chat,
				);
			}
		}

		// Handle api settings if provided
		if (body.config.api) {
			//logger.info('ProjectHandler: Processing api settings:', body.config.api);
			if (body.config.api?.maxTurns !== undefined) {
				//logger.info('ProjectHandler: Setting maxTurns:', {
				//	value: body.config.api.maxTurns,
				//	type: typeof body.config.api.maxTurns,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'api.maxTurns',
					body.config.api.maxTurns,
				);
			}
			if (body.config.api.toolConfigs !== undefined) {
				//logger.info('ProjectHandler: Setting toolConfigs:', {
				//	value: body.config.api.toolConfigs,
				//	type: typeof body.config.api.toolConfigs,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'api.toolConfigs',
					body.config.api.toolConfigs,
				);
			}
		}

		// Return the created project with source information
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(projectId);

		// Convert to client data format
		const clientData = project.toClientData();

		const enhancedProject = enhanceProjectWithSources(
			clientData,
			projectConfig,
			globalConfig,
		);

		response.status = 200;
		response.body = { project: enhancedProject };
	} catch (error) {
		logger.error(`ProjectHandler: Error in createProject: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to create project', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{id}:
 *   put:
 *     summary: Update a project
 *     description: Updates an existing project with the provided details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - path
 *             properties:
 *               name:
 *                 type: string
 *               path:
 *                 type: string
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const updateProject = async (
	{ params, request, response }: RouterContext<'/:id', { id: string }>,
) => {
	try {
		//logger.info('ProjectHandler: updateProject called');

		const { id: projectId } = params;
		const body = await request.body.json();

		// Get project as ProjectPersistence instance
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Update project values if changed
		if (project.name !== body.data.name) {
			await project.setName(body.data.name);
		}
		if (JSON.stringify([...project.mcpServers].sort()) !== JSON.stringify([...body.data.mcpServers].sort())) {
			await project.setMCPServers(body.data.mcpServers);
		}

		//logger.info('ProjectHandler: updateProject with:', { body });
		// Update project config values
		const configManager = await getConfigManager();
		const projectConfigToChange = await configManager.loadProjectConfig(projectId);
		// Only update name if different from current config
		if (body.data.name !== undefined && projectConfigToChange.name !== body.data.name) {
			await configManager.setProjectConfigValue(projectId, 'name', body.data.name);
		}
		if (body.config.llmGuidelinesFile !== undefined) {
			await configManager.setProjectConfigValue(projectId, 'llmGuidelinesFile', body.config.llmGuidelinesFile);
		}
		if (body.config.myPersonsName !== undefined) {
			await configManager.setProjectConfigValue(projectId, 'myPersonsName', body.config.myPersonsName);
		}
		if (body.config.myAssistantsName !== undefined) {
			await configManager.setProjectConfigValue(projectId, 'myAssistantsName', body.config.myAssistantsName);
		}
		// Handle defaultModels settings if provided
		if (body.config.defaultModels) {
			//logger.info('ProjectHandler: Processing api settings:', body.config.api);
			if (body.config.defaultModels?.orchestrator !== undefined) {
				//logger.info('ProjectHandler: Setting defaultModels.orchestrator:', {
				//	value: body.config.defaultModels.orchestrator,
				//	type: typeof body.config.defaultModels.orchestrator,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'defaultModels.orchestrator',
					body.config.defaultModels.orchestrator,
				);
			}
			if (body.config.defaultModels?.agent !== undefined) {
				//logger.info('ProjectHandler: Setting defaultModels.agent:', {
				//	value: body.config.defaultModels.agent,
				//	type: typeof body.config.defaultModels.agent,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'defaultModels.agent',
					body.config.defaultModels.agent,
				);
			}
			if (body.config.defaultModels?.chat !== undefined) {
				//logger.info('ProjectHandler: Setting defaultModels.chat:', {
				//	value: body.config.defaultModels.chat,
				//	type: typeof body.config.defaultModels.chat,
				//});
				await configManager.setProjectConfigValue(
					projectId,
					'defaultModels.chat',
					body.config.defaultModels.chat,
				);
			}
		}
		// Handle api settings if provided
		if (body.config.api) {
			if (body.config.api.maxTurns !== undefined) {
				await configManager.setProjectConfigValue(
					projectId,
					'api.maxTurns',
					body.config.api.maxTurns,
				);
			}
			if (body.config.api.toolConfigs !== undefined) {
				await configManager.setProjectConfigValue(
					projectId,
					'api.toolConfigs',
					body.config.api.toolConfigs,
				);
			}
		}

		// Check if project is valid and update status accordingly
		const isValid = isProjectValid(project);

		// If project is currently draft and is now valid, promote to active
		if (project.status === 'draft' && isValid) await project.setStatus('active');

		// If project is currently active and is no longer valid, demote to draft
		if (project.status === 'active' && !isValid) await project.setStatus('draft');

		// Return the updated project with source information
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.loadProjectConfig(projectId);

		// Convert to client data format
		const clientData = project.toClientData();

		const enhancedProject = enhanceProjectWithSources(
			clientData,
			projectConfig,
			globalConfig,
		);

		response.status = 200;
		response.body = { project: enhancedProject };
	} catch (error) {
		logger.error(`ProjectHandler: Error in updateProject: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to update project', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     description: Deletes a specific project
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to delete
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
export const deleteProject = async (
	{ params, request: _request, response }: RouterContext<'/:id', { id: string }>,
) => {
	try {
		//logger.info('ProjectHandler: deleteProject called');

		const { id: projectId } = params;

		// Get project as ProjectPersistence instance
		const projectPersistenceManager = await getProjectPersistenceManager();
		const project = await projectPersistenceManager.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		// Delete the project
		await project.delete();

		response.status = 200;
		response.body = { message: 'Project deleted successfully' };
	} catch (error) {
		logger.error(`ProjectHandler: Error in deleteProject: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to delete project', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/projects/find:
 *   post:
 *     summary: Find v1 projects
 *     description: Searches for v1 projects in the user's home directory
 *     responses:
 *       200:
 *         description: List of found v1 projects
 *       500:
 *         description: Internal server error
 */
/**
 * @openapi
 * /api/v1/projects/migrate:
 *   post:
 *     summary: Migrate and add a v1 project
 *     description: Migrates a v1 project to v2 format and adds it to the projects list
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectPath
 *             properties:
 *               projectPath:
 *                 type: string
 *                 description: The path to the v1 project to migrate
 *     responses:
 *       200:
 *         description: Project migrated and added successfully
 *       400:
 *         description: Invalid request body or project path
 *       500:
 *         description: Internal server error
 */
// export const migrateProject = async (
// 	{ request, response }: { request: Context['request']; response: Context['response'] },
// ) => {
// 	try {
// 		logger.info('ProjectHandler: migrateProject called');
// 		const body = await request.body.json();
// 		const { projectPath } = body;
//
// 		if (!projectPath) {
// 			response.status = 400;
// 			response.body = { error: 'Missing projectPath in request body' };
// 			return;
// 		}
//
// 		// Migrate and get project as ProjectPersistence instance
// 		const projectPersistenceManager = await getProjectPersistenceManager();
// 		const project = await projectPersistenceManager.migrateV1Project(projectPath);
//
// 		// Convert to client format
// 		const clientData = project.toClientData();
//
// 		response.status = 200;
// 		response.body = { project: clientData };
// 	} catch (error) {
// 		logger.error(`ProjectHandler: Error in migrateProject: ${errorMessage(error)}`);
// 		response.status = 500;
// 		response.body = { error: 'Failed to migrate project', details: errorMessage(error) };
// 	}
// };

export const findV1Projects = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		//logger.info('ProjectHandler: findV1Projects called');

		const params = request.url.searchParams;
		const searchDir = params.get('searchDir') || '';
		//logger.info('ProjectHandler: searchDir', searchDir);

		if (!searchDir) {
			throw new Error('searchDir param not set');
		}
		const rootDir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
		const findInDir = normalize(join(rootDir, searchDir));
		//logger.info('ProjectHandler: findInDir', findInDir);

		// Find projects and convert results to client format if needed
		const projectPersistenceManager = await getProjectPersistenceManager();
		const foundProjects = await projectPersistenceManager.findV1Projects(findInDir);
		//logger.info('ProjectHandler: projects', foundProjects);

		// Since these are legacy projects, they're probably already in a simple format,
		// but we should ensure they match the expected format for the BUI
		const projects = foundProjects.map((project) => {
			// If the result is a ProjectPersistence instance with toClientData method
			if (typeof project === 'object' && project !== null && 'toClientData' in project) {
				return (project as ProjectPersistence).toClientData();
			}
			// Otherwise return as-is
			return project;
		});

		response.status = 200;
		response.body = { projects };
	} catch (error) {
		logger.error(`ProjectHandler: Error in findV1Projects: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to find v1 projects', details: errorMessage(error) };
	}
};
