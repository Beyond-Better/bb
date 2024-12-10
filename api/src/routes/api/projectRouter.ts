import { Router } from '@oak/oak';
import {
	createProject,
	deleteProject,
	findV1Projects,
	getProject,
	listProjects,
	updateProject,
	migrateProject,
} from './project.handlers.ts';

const projectRouter = new Router();

projectRouter
	.get('/', listProjects)
	.get('/find', findV1Projects)
	.post('/migrate', migrateProject)
	.get('/:id', getProject)
	.post('/', createProject)
	.put('/:id', updateProject)
	.delete('/:id', deleteProject);

export default projectRouter;
