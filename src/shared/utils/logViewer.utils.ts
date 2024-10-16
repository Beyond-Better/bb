import { join } from '@std/path';
import { getBbDir } from 'shared/dataDir.ts';
import { ConfigManager } from 'shared/configManager.ts';
import ConversationLogger from 'api/storage/conversationLogger.ts';

export async function watchLogs(logFilePath: string, onNewContent: (content: string) => void) {
	const watcher = Deno.watchFs(logFilePath);
	const file = await Deno.open(logFilePath, { read: true });
	let position = await file.seek(0, Deno.SeekMode.End);
	//console.log(`Watching file ${logFilePath} from position ${position}`);

	try {
		for await (const event of watcher) {
			//console.log(`Got file event: `, event);
			if (event.kind === 'modify') {
				const newPosition = await file.seek(0, Deno.SeekMode.End);
				//console.log(`Reading file from new position: ${newPosition}`);
				if (newPosition > position) {
					const buffer = new Uint8Array(newPosition - position);
					await file.seek(position, Deno.SeekMode.Start);
					await file.read(buffer);
					onNewContent(new TextDecoder().decode(buffer));
					position = newPosition;
				}
			}
		}
	} finally {
		file.close();
	}
}

export async function viewLastLines(logFilePath: string, lines: number): Promise<string> {
	const file = await Deno.open(logFilePath, { read: true });
	try {
		const fileInfo = await file.stat();
		const fileSize = fileInfo.size;

		let position = fileSize;
		let lineCount = 0;
		const chunks: Uint8Array[] = [];

		while (position > 0 && lineCount < lines) {
			const chunkSize = Math.min(1024, position);
			position -= chunkSize;
			await file.seek(position, Deno.SeekMode.Start);
			const chunk = new Uint8Array(chunkSize);
			await file.read(chunk);
			chunks.unshift(chunk);
			lineCount += chunk.filter((byte) => byte === 10).length;
		}

		const content = new TextDecoder().decode(new Uint8Array(chunks.flatMap((chunk) => [...chunk])));
		const lastLines = content.split('\n').slice(-lines).join('\n');
		return lastLines;
	} finally {
		file.close();
	}
}

export async function getLogFilePath(startDir: string, isApiLog: boolean, conversationId?: string): Promise<string> {
	const fullConfig = await ConfigManager.fullConfig(startDir);
	return !isApiLog && conversationId
		? await ConversationLogger.getLogFileRawPath(startDir, conversationId)
		: join(await getBbDir(startDir), fullConfig.api?.logFile ?? 'api.log');
}
