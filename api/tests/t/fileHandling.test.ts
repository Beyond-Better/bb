import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
//import { generateFileListing, searchFilesContent, searchFilesMetadata } from 'api/utils/fileHandling.ts';
import { searchFilesMetadata } from 'api/utils/fileHandling.ts';
//import { GitUtils } from 'shared/git.ts';
import { withTestProject } from 'api/tests/testSetup.ts';

async function setFileModificationTime(filePath: string, date: Date) {
	await Deno.utime(filePath, date, date);
}

async function createTestFiles(testProjectRoot: string) {
	Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
	Deno.writeTextFileSync(join(testProjectRoot, 'file2.js'), 'console.log("Hello, JavaScript!");');
	Deno.mkdirSync(join(testProjectRoot, 'subdir'));
	Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file3.txt'), 'Hello from subdirectory!');
	Deno.writeTextFileSync(join(testProjectRoot, 'large_file.txt'), 'A'.repeat(10000)); // 10KB file
	Deno.writeTextFileSync(join(testProjectRoot, 'empty_file.txt'), '');

	const pastDate = new Date('2023-01-01T00:00:00Z');
	const futureDate = new Date('2025-01-01T00:00:00Z');
	const currentDate = new Date();

	await setFileModificationTime(join(testProjectRoot, 'file1.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'file2.js'), futureDate);
	await setFileModificationTime(join(testProjectRoot, 'subdir', 'file3.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'large_file.txt'), currentDate);
	await setFileModificationTime(join(testProjectRoot, 'empty_file.txt'), currentDate);
}

Deno.test({
	name: 'searchFilesMetadata - find files based on date range',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			const result = await searchFilesMetadata(testProjectRoot, {
				dateAfter: '2024-01-01',
				dateBefore: '2026-01-01',
			});
			//console.log('Date-based search results:', result);
			assertEquals(result.files.length, 3);
			//assertStringIncludes(result.files[0], 'file2.js');
			assert(result.files.some((file) => file.endsWith('file2.js')));
			assert(result.files.some((file) => file.endsWith('empty_file.txt')));
			assert(result.files.some((file) => file.endsWith('large_file.txt')));
			assertEquals(result.errorMessage, null);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFilesMetadata - find files based on size criteria',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			const result = await searchFilesMetadata(testProjectRoot, {
				sizeMin: 5000,
				sizeMax: 15000,
			});
			//console.log('Size-based search results:', result);
			assertEquals(result.files.length, 1);
			assertStringIncludes(result.files[0], 'large_file.txt');
			assertEquals(result.errorMessage, null);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

/*
Deno.test({
	name: 'searchFilesMetadata - combine multiple criteria',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			const result = await searchFilesMetadata(testProjectRoot, {
				filePattern: '*.txt',
				dateAfter: '2022-01-01',
				dateBefore: '2024-01-01',
				sizeMin: 1,
				sizeMax: 1000,
			});
			console.log('Combined criteria search results:', result);
			assertEquals(result.files.length, 2);
			assert(result.files.some((file) => file.endsWith('file1.txt')));
			assert(result.files.some((file) => file.endsWith('subdir/file3.txt')));
			assertEquals(result.errorMessage, null);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'generateFileListing - empty directory',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const { listing } = await generateFileListing(testProjectRoot);
			assertEquals(listing, '');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'generateFileListing - correct paths',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'content');
			Deno.mkdirSync(join(testProjectRoot, 'subdir'));
			Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file2.txt'), 'content');

			const { listing } = await generateFileListing(testProjectRoot);
			assertStringIncludes(listing!, 'file1.txt');
			assertStringIncludes(listing!, join('subdir', 'file2.txt'));
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'generateFileListing - exclude files based on .gitignore patterns',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			Deno.writeTextFileSync(join(testProjectRoot, '.gitignore'), '*.log\nnode_modules/');
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'content');
			Deno.writeTextFileSync(join(testProjectRoot, 'debug.log'), 'log content');
			Deno.mkdirSync(join(testProjectRoot, 'node_modules'));
			Deno.writeTextFileSync(join(testProjectRoot, 'node_modules', 'package.json'), '{}');

			const { listing } = await generateFileListing(testProjectRoot);
			assertStringIncludes(listing!, 'file1.txt');
			assertEquals(listing!.includes('debug.log'), false);
			assertEquals(listing!.includes('node_modules'), false);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - find files matching the search pattern',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
			Deno.writeTextFileSync(join(testProjectRoot, 'file2.txt'), 'Goodbye, world!');

			const result = await searchFilesContent(testProjectRoot, 'Hello');
			assertEquals(result.files, ['./file1.txt']);
			assertEquals(result.errorMessage, null);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - return an empty array when no files match',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');

			const result = await searchFilesContent(testProjectRoot, 'Nonexistent');
			assertEquals(result.files, []);
			assertEquals(result.errorMessage, null);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - respect file pattern when provided',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
			Deno.writeTextFileSync(join(testProjectRoot, 'file2.md'), 'Hello, markdown!');

			const result = await searchFilesContent(testProjectRoot, 'Hello', {
				filePattern: '*.md',
			});
			assertEquals(result.files, ['./file2.md']);
			assertEquals(result.errorMessage, null);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFilesContent - handle errors gracefully',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// This test simulates an error by searching in a non-existent directory
			const nonExistentDir = join(testProjectRoot, 'nonexistent');
			const result = await searchFilesContent(nonExistentDir, 'pattern');
			assertEquals(result.files, []);
			assertStringIncludes(result.errorMessage!, "Failed to spawn 'grep': No such cwd");
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
 */
