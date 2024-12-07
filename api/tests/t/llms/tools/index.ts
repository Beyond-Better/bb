import { walk } from '@std/fs';

async function importTestFiles() {
	const toolsDir = new URL('../../../../src/llms/tools', import.meta.url);

	for await (
		const entry of walk(toolsDir.pathname, {
			includeDirs: false,
			includeFiles: true,
			match: [/\.tool\/tests\/.*\.test\.ts$/],
		})
	) {
		const importPath = `file://${entry.path}`;
		await import(importPath);
	}
}

await importTestFiles();
