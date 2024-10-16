import { Command } from 'cliffy/command/mod.ts';
import { getApiStatus } from '../utils/apiControl.utils.ts';

export const apiStatus = new Command()
	.name('status')
	.description('Check the status of the BB API server')
	.option('--text', 'Return plain text instead of JSON')
	.action(async (options) => {
		const startDir = Deno.cwd();
		const status = await getApiStatus(startDir);

		if (options.text) {
			console.log(JSON.stringify(status, null, 2));
		} else {
			console.log(JSON.stringify(status));
		}
	});
