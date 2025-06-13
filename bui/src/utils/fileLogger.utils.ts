import { dirname } from '@std/path';
import { getBbDir } from 'shared/dataDir.ts';

const APP_NAME = 'dev.beyondbetter.app';

// Get the appropriate log directory based on the platform
async function getLogDir(projectId?: string): Promise<string> {
	if (projectId) {
		return await getBbDir(projectId);
	} else if (Deno.build.os === 'darwin') {
		const homeDir = Deno.env.get('HOME');
		if (!homeDir) {
			throw new Error('HOME environment variable not set');
		}
		return `${homeDir}/Library/Logs/${APP_NAME}`;
	} else if (Deno.build.os === 'windows') {
		const programData = Deno.env.get('ProgramData');
		if (!programData) {
			throw new Error('ProgramData environment variable not set');
		}
		return `${programData}\\${APP_NAME}\\logs`;
	} else {
		// Linux and others
		const homeDir = Deno.env.get('HOME');
		if (!homeDir) {
			throw new Error('HOME environment variable not set');
		}
		return `${homeDir}/.bb/logs`;
	}
}

// Ensure the log directory exists
async function ensureLogDir(logFile: string): Promise<void> {
	const dir = dirname(logFile);
	try {
		await Deno.mkdir(dir, { recursive: true });
	} catch (error) {
		if (!(error instanceof Deno.errors.AlreadyExists)) {
			throw new Error(`Failed to create log directory: ${(error as Error).message}`);
		}
	}
}

export const buiFileLogPath = async (buiLogFile: string, projectId?: string): Promise<string> => {
	// If buiLogFile is not absolute, make it relative to the standard log directory
	const logPath = buiLogFile.startsWith('/') || buiLogFile.includes(':\\')
		? buiLogFile
		: `${await getLogDir(projectId)}/${buiLogFile}`;

	// Ensure the log directory exists
	await ensureLogDir(logPath);
	return logPath;
};

// Redirect console.log and console.error to the bui log file
export const buiFileLogger = async (buiLogFile: string) => {
	const logPath = await buiFileLogPath(buiLogFile);

	// Open the log file
	const buiLogFileStream = await Deno.open(logPath, { write: true, create: true, append: true });
	const encoder = new TextEncoder();

	const consoleFunctions = ['log', 'debug', 'info', 'warn', 'error'];
	consoleFunctions.forEach((funcName) => {
		(console as any)[funcName] = (...args: unknown[]) => {
			const timestamp = new Date().toISOString();
			const prefix = funcName === 'log' ? '' : `[${funcName.toUpperCase()}] `;
			const message = `${timestamp} ${prefix}${
				args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')
			}\n`;
			buiLogFileStream.write(encoder.encode(message));
		};
	});

	// Redirect Deno.stderr to the log file
	const originalStderrWrite = Deno.stderr.write;
	Deno.stderr.write = (p: Uint8Array): Promise<number> => {
		buiLogFileStream.write(p);
		return originalStderrWrite.call(Deno.stderr, p);
	};
};
