import type { Context, RouterContext } from '@oak/oak';
import { join, normalize, relative } from '@std/path';
import { toUnixPath } from '../../utils/path.utils.ts';

import { logger } from 'shared/logger.ts';
import ProjectPersistence from 'api/storage/projectPersistence.ts';
import type { StoredProject } from 'api/storage/projectPersistence.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { Project } from 'shared/types/project.ts';

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
		logger.info('ProjectHandler: listProjects called');
		const projectPersistence = await new ProjectPersistence().init();
		const rootPath = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
		const configManager = await ConfigManagerV2.getInstance();
		const storedProjects: StoredProject[] = await projectPersistence.listProjects();
		const projects = await Promise.all(storedProjects.map(async (project) => {
			let projectConfig = {};
			try {
				projectConfig = await configManager.getProjectConfig(project.projectId);
			} catch (e) {
				// Failed to load project config: No such file or directory (os error 2): readfile '/Users/.../.bb/config.yaml'
			}
			return {
				...project,
				...projectConfig,
				path: toUnixPath(relative(rootPath, project.path)),
			};
		}));

		response.status = 200;
		response.body = { projects };
	} catch (error) {
		logger.error(`ProjectHandler: Error in listProjects: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to list projects', details: (error as Error).message };
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
		logger.info('ProjectHandler: getProject called');

		const { id: projectId } = params;

		const projectPersistence = await new ProjectPersistence().init();
		const storedProject: StoredProject | null = await projectPersistence.getProject(projectId);
		if (!storedProject) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		const rootPath = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
		const configManager = await ConfigManagerV2.getInstance();
		const projectConfig = await configManager.getProjectConfig(projectId);
		const project: Project = {
			...storedProject,
			...projectConfig,
			path: toUnixPath(relative(rootPath, storedProject.path)),
		};

		response.status = 200;
		response.body = { project };
	} catch (error) {
		logger.error(`ProjectHandler: Error in getProject: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to get project', details: (error as Error).message };
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
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               path:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [local, git]
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
		logger.info('ProjectHandler: createProject called');
		const body = await request.body.json();
		const { name, path, type, llmGuidelinesFile } = body;
		const rootPath = body.rootPath || Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

		if (!name || !path || !type) {
			response.status = 400;
			response.body = { error: 'Missing required fields' };
			return;
		}

		const projectPersistence = await new ProjectPersistence().init();

		const storedProject: Omit<StoredProject, 'projectId'> = {
			name,
			path: join(rootPath, path),
			type,
		};

		const projectId = await projectPersistence.createProject(storedProject);

		// If llmGuidelinesFile is provided, update project config
		if (llmGuidelinesFile !== undefined) {
			const configManager = await ConfigManagerV2.getInstance();
			await configManager.setProjectConfigValue(projectId, 'llmGuidelinesFile', llmGuidelinesFile);
		}
		const project: Project = { ...storedProject, projectId, llmGuidelinesFile };

		response.status = 200;
		response.body = { project };
	} catch (error) {
		logger.error(`ProjectHandler: Error in createProject: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to create project', details: (error as Error).message };
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
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *               path:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [local, git]
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
		logger.info('ProjectHandler: updateProject called');

		const { id: projectId } = params;

		const body = await request.body.json();
		const { name, path, type, llmGuidelinesFile } = body;
		const rootPath = body.rootPath || Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

		if (!name || !path || !type) {
			response.status = 400;
			response.body = { error: 'Missing required fields' };
			return;
		}

		// If llmGuidelinesFile is provided, update project config
		if (llmGuidelinesFile !== undefined) {
			const configManager = await ConfigManagerV2.getInstance();
			await configManager.setProjectConfigValue(projectId, 'llmGuidelinesFile', llmGuidelinesFile);
		}

		const projectPersistence = await new ProjectPersistence().init();

		const storedProject: StoredProject | null = await projectPersistence.getProject(projectId);
		if (!storedProject) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		const project: Project = {
			projectId,
			name,
			path: join(rootPath, path),
			type,
			llmGuidelinesFile,
		};

		// Save project metadata
		await projectPersistence.saveProject(project);

		response.status = 200;
		response.body = { project };
	} catch (error) {
		logger.error(`ProjectHandler: Error in updateProject: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to update project', details: (error as Error).message };
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
		logger.info('ProjectHandler: deleteProject called');

		const { id: projectId } = params;

		const projectPersistence = await new ProjectPersistence().init();

		const project: StoredProject | null = await projectPersistence.getProject(projectId);
		if (!project) {
			response.status = 404;
			response.body = { error: 'Project not found' };
			return;
		}

		await projectPersistence.deleteProject(projectId);

		response.status = 200;
		response.body = { message: 'Project deleted successfully' };
	} catch (error) {
		logger.error(`ProjectHandler: Error in deleteProject: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to delete project', details: (error as Error).message };
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
export const migrateProject = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		logger.info('ProjectHandler: migrateProject called');
		const body = await request.body.json();
		const { projectPath } = body;

		if (!projectPath) {
			response.status = 400;
			response.body = { error: 'Missing projectPath in request body' };
			return;
		}

		const projectPersistence = await new ProjectPersistence().init();
		const project = await projectPersistence.migrateV1Project(projectPath);

		response.status = 200;
		response.body = { project };
	} catch (error) {
		logger.error(`ProjectHandler: Error in migrateProject: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to migrate project', details: (error as Error).message };
	}
};

export const findV1Projects = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		logger.info('ProjectHandler: findV1Projects called');
		const projectPersistence = await new ProjectPersistence().init();

		const params = request.url.searchParams;
		const searchDir = params.get('searchDir') || '';
		logger.info('ProjectHandler: searchDir', searchDir);

		if (!searchDir) {
			throw new Error('searchDir param not set');
		}
		const rootDir = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
		const findInDir = normalize(join(rootDir, searchDir));
		logger.info('ProjectHandler: findInDir', findInDir);

		const projects = await projectPersistence.findV1Projects(findInDir);
		logger.info('ProjectHandler: projects', projects);

		response.status = 200;
		response.body = { projects };
	} catch (error) {
		logger.error(`ProjectHandler: Error in findV1Projects: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to find v1 projects', details: (error as Error).message };
	}
};
