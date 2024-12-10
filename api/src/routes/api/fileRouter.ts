import { Router } from '@oak/oak';
import { addFile, listDirectoryContents, listFiles, removeFile, resolvePath, suggestFiles, suggestFilesForPath } from './file.handlers.ts';

const fileRouter = new Router();

fileRouter
	.post('/', addFile)
	.delete('/:id', removeFile)
	.get('/', listFiles)
	.post('/suggest', suggestFiles)
	.post('/suggest-for-path', suggestFilesForPath)
	.post('/resolve-path', resolvePath)
	.post('/list-directory', listDirectoryContents);

export default fileRouter;
