import { Router } from '@oak/oak';
import {
	addResource,
	listDirectoryContents,
	listResources,
	removeResource,
	resolvePath,
	serveResource,
	suggestResources,
	suggestResourcesForPath,
} from './resource.handlers.ts';

const resourceRouter = new Router();

resourceRouter
	.post('/', addResource)
	.delete('/:id', removeResource)
	.get('/', listResources)
	.get('/serve/:resourceUrl', serveResource)
	.post('/suggest', suggestResources)
	.post('/suggest-for-path', suggestResourcesForPath)
	.post('/resolve-path', resolvePath)
	.post('/list-directory', listDirectoryContents);

export default resourceRouter;
