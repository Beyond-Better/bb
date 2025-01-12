import { Router } from '@oak/oak';
import { getGlobalConfig, getProjectConfig, updateGlobalConfig, updateProjectConfig } from './config.handlers.ts';

const configRouter = new Router();

configRouter
	.get('/global', getGlobalConfig)
	.put('/global', updateGlobalConfig)
	.get('/project/:id', getProjectConfig)
	.put('/project/:id', updateProjectConfig);

export default configRouter;
