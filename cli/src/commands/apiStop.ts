import { Command } from 'cliffy/command/mod.ts';
import { stopApiServer } from '../utils/apiControl.utils.ts';
import { getProjectId, getProjectRootFromStartDir } from 'shared/dataDir.ts';

export const apiStop = new Command()
	.name('stop')
	.description('Stop the BB API server')
	.action(async () => {
		let projectId;
		try {
			const startDir = Deno.cwd();
			const projectRoot = await getProjectRootFromStartDir(startDir);
			projectId = await getProjectId(projectRoot);
		} catch (_error) {
			//console.error(`Could not set ProjectId: ${(error as Error).message}`);
			projectId = undefined;
		}
		await stopApiServer(projectId);
	});
