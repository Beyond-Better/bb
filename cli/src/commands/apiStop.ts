import { Command } from 'cliffy/command';
import { stopApiServer } from '../utils/apiControl.utils.ts';
import { getProjectId, getWorkingRootFromStartDir } from 'shared/dataDir.ts';

export const apiStop = new Command()
	.name('stop')
	.description('Stop the BB API server')
	.action(async () => {
		let projectId;
		try {
			const startDir = Deno.cwd();
			const workingRoot = await getWorkingRootFromStartDir(startDir);
			projectId = await getProjectId(workingRoot);
		} catch (_error) {
			//console.error(`Could not set ProjectId: ${(error as Error).message}`);
			projectId = undefined;
		}
		await stopApiServer(projectId);
	});
