#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write

import { parseArgs } from '@std/cli';
import { walk } from '@std/fs';
import { join } from '@std/path';

const TOOLS_DIR = './src/llms/tools';
const MAIN_FILE = 'src/main.ts';
const OUTPUT_FILE = '../build/bb-api';

const args = parseArgs(Deno.args, {
	string: ['target', 'output'],
	alias: { t: 'target', o: 'output' },
});

const outputFile = args.output || OUTPUT_FILE;

async function getIncludeFiles() {
	const includeFiles = [];
	for await (
		const entry of walk(TOOLS_DIR, {
			exts: ['.ts', '.tsx', '.json'],
			followSymlinks: false,
		})
	) {
		if (entry.isFile) {
			includeFiles.push(entry.path);
		}
	}
	return includeFiles;
}

// Run the generate-tools-manifest task
const manifestProcess = new Deno.Command('deno', {
	args: ['task', 'generate-tools-manifest'],
	stdout: 'piped',
	stderr: 'piped',
});
const { code: manifestCode, stdout: manifestStdout, stderr: manifestStderr } = await manifestProcess.output();

const manifestOutput = new TextDecoder().decode(manifestStdout);
const manifestErrorOutput = new TextDecoder().decode(manifestStderr);

if (manifestCode !== 0) {
	if (manifestErrorOutput !== '') console.error(manifestErrorOutput);
	console.error('Failed to generate tools manifest');
	Deno.exit(manifestCode);
}

console.log(manifestOutput);
if (manifestErrorOutput !== '') console.error(manifestErrorOutput);

const includeFiles = await getIncludeFiles();
const includeArgs = includeFiles.map((file) => `--include ${file}`).join(' ');
console.log(`Including files for core tools:\n${JSON.stringify(includeFiles, null, 2)}`);

// Compile the API
const compileProcess = new Deno.Command('deno', {
	args: [
		'compile',
		'-A',
		'--unstable',
		...(args.target ? ['--target', args.target] : []),
		'--output',
		outputFile,
		...includeArgs.split(' '),
		MAIN_FILE,
	].filter(Boolean),
	stdout: 'piped',
	stderr: 'piped',
});

const { code: compileCode, stdout: compileStdout, stderr: compileStderr } = await compileProcess.output();

const compileOutput = new TextDecoder().decode(compileStdout);
const compileErrorOutput = new TextDecoder().decode(compileStderr);

if (compileCode !== 0) {
	if (compileErrorOutput !== '') console.error(compileErrorOutput);
	console.error('Compilation failed');
	Deno.exit(compileCode);
}

console.log(compileOutput);
if (compileErrorOutput !== '') console.error(compileErrorOutput);

console.log('Compilation successful');
