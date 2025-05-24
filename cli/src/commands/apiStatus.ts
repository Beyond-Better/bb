import { Command } from 'cliffy/command';
import { getApiStatus } from '../utils/apiControl.utils.ts';
import { getProjectId, getWorkingRootFromStartDir } from 'shared/dataDir.ts';

export const apiStatus = new Command()
	.name('status')
	.description('Check the status of the BB API server')
	.option('--text', 'Return plain text instead of JSON')
	.action(async (options) => {
		let projectId;
		try {
			const startDir = Deno.cwd();
			const workingRoot = await getWorkingRootFromStartDir(startDir);
			projectId = await getProjectId(workingRoot);
		} catch (_error) {
			//console.error(`Could not set ProjectId: ${(error as Error).message}`);
			projectId = undefined;
		}
		const status = await getApiStatus(projectId);

		if (options.text) {
			console.log(JSON.stringify(status, null, 2));
		} else {
			console.log(JSON.stringify(status));
		}
	});
