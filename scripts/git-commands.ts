#!/usr/bin/env -S deno run --allow-read --allow-write  --allow-env

//import { walk } from '@std/fs';
import { join, relative } from '@std/path';
import git from 'https://esm.sh/isomorphic-git';
import fs from 'node:fs';
//import * as fs from '@std/fs';
//import { join } from 'npm:path-browserify';

// Explicitly provide the path polyfill
globalThis.path = { join };

// interface ConfigUsage {
//   file: string;
//   line: number;
//   type: 'read' | 'write';
//   configPath: string[];
//   context: string;
// }
//
// interface AnalysisResult {
//   totalFiles: number;
//   configFiles: number;
//   usages: ConfigUsage[];
//   patterns: {
//     pattern: string;
//     count: number;
//   }[];
// }

// Main execution
if (import.meta.main) {
	try {
		const workingRoot = Deno.args[0] || Deno.cwd();
		console.log(`Git init for: ${workingRoot}`);

		//     const result = await analyzeDirectory(workingRoot);
		//     const report = await generateReport(result);
		//
		//     // Save report
		//     const reportPath = join(workingRoot, 'docs/development/config_migration/usage_analysis.md');
		//     await Deno.mkdir(join(workingRoot, 'docs/development/config_migration'), { recursive: true });
		//     await Deno.writeTextFile(reportPath, report);
		//
		//     console.log(`Analysis complete. Report saved to: ${reportPath}`);
		//     console.log(`Found ${result.configFiles} files with configuration usage`);
		//     console.log(`Total of ${result.usages.length} configuration usages detected`);

		//await git.init({ fs, dir: workingRoot, defaultBranch: 'main' });

		//await git.add({ fs, dir: workingRoot, filepath: 'README.md' });
		//let addedSha = await git.commit({
		//	fs,
		//	dir: workingRoot,
		//	message: 'Updated README [1].',
		//	author: {
		//		name: 'Mr. Test',
		//		email: 'mrtest@example.com',
		//	},
		//});

		const status = await git.status({ fs, dir: workingRoot, filepath: '.' });
		console.log({ status });

		const sha = await git.resolveRef({ fs, dir: workingRoot, ref: 'HEAD' });
		console.log({ sha });

		//const commits = await git.log({ fs, dir: workingRoot });
		//console.log({ commits });

		const filepath = 'README.md';
		const commits = await git.log({ fs, dir: workingRoot, filepath, ref: 'HEAD', depth: 1 });
		console.log({ commit: commits[0]?.oid });

		//let lastSHA = null;
		//let lastCommit = null;
		//const commitsThatMatter = [];
		//for (const commit of commits) {
		//	//console.log({ commit });
		//	try {
		//		const o = await git.readObject({ fs, dir: workingRoot, oid: commit.oid, filepath });
		//		console.log({ o });
		//		if (o.oid !== lastSHA) {
		//			if (lastSHA !== null) commitsThatMatter.push(lastCommit);
		//			lastSHA = o.oid;
		//		}
		//	} catch (err) {
		//		// file no longer there
		//		commitsThatMatter.push(lastCommit);
		//		break;
		//	}
		//	lastCommit = commit;
		//}
		////console.log(commitsThatMatter);
		//console.log({ lastSHA, commits });
	} catch (error) {
		console.error('Error:', error);
		Deno.exit(1);
	}
}
