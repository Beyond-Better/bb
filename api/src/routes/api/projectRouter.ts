import { Router } from '@oak/oak';
import {
	blankProject,
	createProject,
	deleteProject,
	findV1Projects,
	getProject,
	listProjects,
	//migrateProject,
	updateProject,
} from './project.handlers.ts';
import {
	addDsConnection,
	getDsConnection,
	getDsProvidersForProject,
	listDsConnections,
	removeDsConnection,
	setPrimaryDsConnection,
	updateDsConnection,
} from './dataSource.handlers.ts';

const projectRouter = new Router();

// Project routes
projectRouter
	.get('/', listProjects)
	.get('/find', findV1Projects)
	//.post('/migrate', migrateProject)
	.get('/new', blankProject)
	.get('/:id', getProject)
	.post('/', createProject)
	.put('/:id', updateProject)
	.delete('/:id', deleteProject);

// Data source routes
projectRouter
	.get('/:projectId/datasource', listDsConnections)
	.post('/:projectId/datasource', addDsConnection)
	.get('/:projectId/datasource/types', getDsProvidersForProject)
	.get('/:projectId/datasource/:id', getDsConnection)
	.put('/:projectId/datasource/:id', updateDsConnection)
	.delete('/:projectId/datasource/:id', removeDsConnection)
	.put('/:projectId/primary-datasource', setPrimaryDsConnection);

export default projectRouter;
