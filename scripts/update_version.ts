import { walk } from '@std/fs';

// Standard commit/change types for consistent changelog entries:
//
// Added: New features or capabilities
// Changed: Changes in existing functionality
// Deprecated: Soon-to-be removed features
// Removed: Removed features
// Fixed: Bug fixes
// Security: Security vulnerability fixes
//
// Common prefixes for commit messages:
// add: New feature or capability
// change/update: Modified existing functionality
// deprecate: Mark as deprecated
// remove: Remove feature or capability
// fix: Bug fix
// security: Security-related change

const updateVersion = async (newVersion: string) => {
	const files = ['deno.jsonc', 'cli/deno.jsonc', 'bui/deno.jsonc', 'api/deno.jsonc'];

	for await (const file of files) {
		const content = await Deno.readTextFile(file);
		const json = JSON.parse(content);
		json.version = newVersion;
		await Deno.writeTextFile(file, JSON.stringify(json, null, 2));
		//deno fmt file
		const formatCommand = new Deno.Command('deno', {
			args: ['fmt', file],
			stdout: 'piped',
			stderr: 'piped',
		});
		await formatCommand.output();
	}

	// Update version.ts
	await Deno.writeTextFile('version.ts', `export const VERSION = "${newVersion}";`);

	// Update other files that might need the version
	for await (const entry of walk('.', { exts: ['.ts', '.rb'] })) {
		if (entry.isFile) {
			let content = await Deno.readTextFile(entry.path);
			content = content.replace(/^\s*(?<!API_|MINIMUM_)VERSION\s*=\s*["'][\d.]+["']\s*;?\s*$/m, `VERSION = "${newVersion}"`);
			await Deno.writeTextFile(entry.path, content);
		}
	}

	await updateChangelog(newVersion);
};

const updateChangelog = async (newVersion: string) => {
	const changelogPath = 'CHANGELOG.md';
	const changelog = await Deno.readTextFile(changelogPath);

	// Extract current [Unreleased] content
	const unreleasedRegex = /## \[Unreleased\]\n([\s\S]*?)(?=\n## \[|$)/;
	const unreleasedMatch = changelog.match(unreleasedRegex);
	const unreleasedContent = unreleasedMatch ? unreleasedMatch[1].trim() : '';

	// Create new version entry with the unreleased content
	const newEntry = `\n\n## [${newVersion}] - ${new Date().toISOString().split('T')[0]}\n${unreleasedContent ? '\n' + unreleasedContent : '\n### Changed\n- No significant changes in this version'}`;

	// Update the changelog
	let updatedChangelog;
	if (unreleasedMatch) {
		// Replace the existing [Unreleased] section with a new empty one and add the new version
		updatedChangelog = changelog.replace(
			unreleasedRegex,
			`## [Unreleased]\n\n### Added\n\n\n### Changed\n\n\n### Fixed\n\n${newEntry}\n\n`,
		);
	} else {
		// Create a new [Unreleased] section if none exists
		updatedChangelog = changelog.replace(
			'# Changelog',
			`# Changelog\n\n## [Unreleased]\n\n### Added\n\n\n### Changed\n\n\n### Fixed\n\n\n${newEntry}`,
		);
	}

	await Deno.writeTextFile(changelogPath, updatedChangelog);
	console.log(`Updated CHANGELOG.md with version ${newVersion}`);
};

if (import.meta.main) {
	const newVersion = Deno.args[0];
	if (!newVersion) {
		console.error('Please provide a new version number.');
		Deno.exit(1);
	}
	updateVersion(newVersion);
	console.log('Version update complete. Please review the changes in CHANGELOG.md before committing.');
}
