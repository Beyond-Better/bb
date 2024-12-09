import { Command } from 'cliffy/command/mod.ts';
import { stopApiServer } from '../utils/apiControl.utils.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';

export const apiStop = new Command()
	.name('stop')
	.description('Stop the BB API server')
	.action(async () => {
		const startDir = Deno.cwd();
		const projectRoot = await getProjectRootFromStartDir(startDir);
		const projectId = await getProjectId(projectRoot);
		await stopApiServer(projectId);
	});
