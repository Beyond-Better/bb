import { Command } from 'cliffy/command/mod.ts';
import { stopApiServer } from '../utils/apiControl.utils.ts';

export const apiStop = new Command()
	.name('stop')
	.description('Stop the BB API server')
	.action(async () => {
		const startDir = Deno.cwd();
		await stopApiServer(startDir);
	});
