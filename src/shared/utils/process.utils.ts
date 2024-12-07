import { join } from '@std/path';
import { logger } from 'shared/logger.ts';

interface SpawnOptions {
	cmd: string[];
	cwd: string;
	detached?: boolean;
}

export async function spawnDetached(options: SpawnOptions): Promise<boolean> {
	try {
		const command = new Deno.Command(options.cmd[0], {
			args: options.cmd.slice(1),
			cwd: options.cwd,
			// Detach process and don't forward stdio to prevent hanging
			stderr: 'null',
			stdout: 'null',
			stdin: 'null',
		});

		const child = command.spawn();
		// Unref the child to allow parent to exit
		child.unref();

		return true;
	} catch (error) {
		logger.error(`Failed to spawn detached process: ${(error as Error).message}`);
		return false;
	}
}
