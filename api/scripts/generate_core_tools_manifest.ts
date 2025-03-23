import { join } from '@std/path';
//import { stripIndents } from 'common-tags';

// paths relative to api/deno.jsonc
const TOOLS_DIR = './src/llms/tools';
const OUTPUT_FILE = './src/llms/tools_manifest.ts';

async function generateCoreTools() {
	const tools = [];

	//for await (const entry of walk(TOOLS_DIR, { maxDepth: 1 })) {
	for await (const entry of Deno.readDir(TOOLS_DIR)) {
		if (entry.isDirectory && entry.name.endsWith('.tool')) {
			const infoPath = join(TOOLS_DIR, entry.name, 'info.json');
			try {
				const info = JSON.parse(await Deno.readTextFile(infoPath));
				if (!info.type) info.type = 'internal';
				tools.push({
					toolNamePath: entry.name,
					metadata: info,
				});
			} catch (error) {
				console.error(`Error reading ${infoPath}:`, error as Error);
			}
		}
	}

	const fileContent = `// This file is auto-generated. Do not edit manually.
import type { ToolMetadata } from './llmToolManager.ts';

interface CoreTool {
	toolNamePath: string;
	metadata: ToolMetadata;
}

export const CORE_TOOLS: Array<CoreTool> = ${JSON.stringify(tools, null, '\t')};
`;

	await Deno.writeTextFile(OUTPUT_FILE, fileContent);
	console.log(`Generated ${OUTPUT_FILE} with ${tools.length} tools.`);
}

await generateCoreTools();
