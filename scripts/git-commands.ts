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
		const projectRoot = Deno.args[0] || Deno.cwd();
		console.log(`Git init for: ${projectRoot}`);

		//     const result = await analyzeDirectory(projectRoot);
		//     const report = await generateReport(result);
		//
		//     // Save report
		//     const reportPath = join(projectRoot, 'docs/development/config_migration/usage_analysis.md');
		//     await Deno.mkdir(join(projectRoot, 'docs/development/config_migration'), { recursive: true });
		//     await Deno.writeTextFile(reportPath, report);
		//
		//     console.log(`Analysis complete. Report saved to: ${reportPath}`);
		//     console.log(`Found ${result.configFiles} files with configuration usage`);
		//     console.log(`Total of ${result.usages.length} configuration usages detected`);

		//await git.init({ fs, dir: projectRoot, defaultBranch: 'main' });

		//await git.add({ fs, dir: projectRoot, filepath: 'README.md' });
		//let addedSha = await git.commit({
		//	fs,
		//	dir: projectRoot,
		//	message: 'Updated README [1].',
		//	author: {
		//		name: 'Mr. Test',
		//		email: 'mrtest@example.com',
		//	},
		//});

		const status = await git.status({ fs, dir: projectRoot, filepath: '.' });
		console.log({ status });

		const sha = await git.resolveRef({ fs, dir: projectRoot, ref: 'HEAD' });
		console.log({ sha });

		//const commits = await git.log({ fs, dir: projectRoot });
		//console.log({ commits });

		const filepath = 'README.md';
		const commits = await git.log({ fs, dir: projectRoot, filepath, ref: 'HEAD', depth: 1 });
		console.log({ commit: commits[0]?.oid });

		//let lastSHA = null;
		//let lastCommit = null;
		//const commitsThatMatter = [];
		//for (const commit of commits) {
		//	//console.log({ commit });
		//	try {
		//		const o = await git.readObject({ fs, dir: projectRoot, oid: commit.oid, filepath });
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
