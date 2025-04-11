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
	addDataSource,
	getDataSource,
	getDataSourceTypesForProject,
	listDataSources,
	removeDataSource,
	setPrimaryDataSource,
	updateDataSource,
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
	.get('/:projectId/datasource', listDataSources)
	.post('/:projectId/datasource', addDataSource)
	.get('/:projectId/datasource/types', getDataSourceTypesForProject)
	.get('/:projectId/datasource/:id', getDataSource)
	.put('/:projectId/datasource/:id', updateDataSource)
	.delete('/:projectId/datasource/:id', removeDataSource)
	.put('/:projectId/primary-datasource', setPrimaryDataSource);

export default projectRouter;
