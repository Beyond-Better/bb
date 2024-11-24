import { logger } from 'shared/logger.ts';

export async function runFormatCommand(projectRoot: string, formatCommand: string): Promise<void> {
	try {
		const command = new Deno.Command(formatCommand.split(' ')[0], {
			args: formatCommand.split(' ').slice(1),
			cwd: projectRoot,
		});

		const process = command.spawn();
		const { code } = await process.output();
		if (code !== 0) {
			throw new Error(`Format command exited with status ${code}`);
		}
	} catch (error) {
		logger.error(`Failed to run format command: ${(error as Error).message}`);
	}
}
