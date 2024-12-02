import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { type FileSuggestion, suggestFiles } from 'api/utils/fileSuggestions.ts';
import { withTestProject } from 'api/tests/testSetup.ts';

async function setFileModificationTime(filePath: string, date: Date) {
	await Deno.utime(filePath, date, date);
}

async function createTestFiles(testProjectRoot: string) {
	Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');
	Deno.writeTextFileSync(join(testProjectRoot, 'file2.js'), 'console.log("Hello, JavaScript!");');
	Deno.mkdirSync(join(testProjectRoot, 'subdir'));
	Deno.writeTextFileSync(join(testProjectRoot, 'subdir', 'file3.txt'), 'Hello from subdirectory!');
	Deno.writeTextFileSync(join(testProjectRoot, 'subdir', '.hidden.txt'), 'Hidden file');
	Deno.writeTextFileSync(join(testProjectRoot, 'large_file.txt'), 'A'.repeat(10000)); // 10KB file
	Deno.writeTextFileSync(join(testProjectRoot, 'empty_file.txt'), '');

	// Create docs directory structure
	Deno.mkdirSync(join(testProjectRoot, 'docs', 'development'), { recursive: true });
	Deno.writeTextFileSync(join(testProjectRoot, 'docs', 'README.md'), '# Docs');
	Deno.writeTextFileSync(join(testProjectRoot, 'docs', 'development', 'guide.md'), '# Development Guide');
	Deno.writeTextFileSync(join(testProjectRoot, 'docs', 'development', 'setup.md'), '# Setup Guide');

	// Add files with special characters and multiple extensions
	Deno.writeTextFileSync(join(testProjectRoot, 'docs', 'special chars & symbols.md'), 'Special chars');
	Deno.writeTextFileSync(join(testProjectRoot, 'docs', 'development', 'config.test.ts.bak'), 'Backup file');

	// Add hidden directory with contents
	Deno.mkdirSync(join(testProjectRoot, '.config'));
	Deno.writeTextFileSync(join(testProjectRoot, '.config', 'settings.json'), '{}');
	Deno.writeTextFileSync(join(testProjectRoot, '.config', '.secret'), 'secret');

	const pastDate = new Date('2023-01-01T00:00:00Z');
	const futureDate = new Date('2025-01-01T00:00:00Z');
	const currentDate = new Date();

	await setFileModificationTime(join(testProjectRoot, 'file1.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'file2.js'), futureDate);
	await setFileModificationTime(join(testProjectRoot, 'subdir', 'file3.txt'), pastDate);
	await setFileModificationTime(join(testProjectRoot, 'large_file.txt'), currentDate);
	await setFileModificationTime(join(testProjectRoot, 'empty_file.txt'), currentDate);
}

// export interface FileSuggestionsOptions {
//   partialPath: string;
//   startDir: string;
//   limit?: number;
//   caseSensitive?: boolean;
//   type?: 'all' | 'file' | 'directory';
// }
// export interface FileSuggestion {
//     path: string;
//     isDirectory: boolean;
//     size?: number;
//     modified?: string;
// }
// export interface FileSuggestionsResponse {
//   suggestions: Array<FileSuggestion>;
//   hasMore: boolean;
// }

Deno.test({
	name: 'suggestFiles - Test markdown file patterns',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test 'docs/*.md' pattern
			let result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/*.md',
			});
			// console.log('docs/*.md pattern results:', result);

			// Should find markdown files in docs root
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/README.md' && !suggestion.isDirectory
				),
				'Should find README.md in docs root',
			);

			// Test 'docs/**/*.md' pattern - recursive
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/**/*.md', // Find markdown files at any depth
			});
			//console.log('docs/**/*.md pattern results:', result);

			// Should find all markdown files recursively
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/README.md' && !suggestion.isDirectory
				),
				'Should find README.md in docs root',
			);
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/guide.md' && !suggestion.isDirectory
				),
				'Should find guide.md in development directory',
			);
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/setup.md' && !suggestion.isDirectory
				),
				'Should find setup.md in development directory',
			);
			assertEquals(result.suggestions.length, 4, 'Should find all markdown files');

			// Test 'docs/dev*/*.md' pattern
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/dev*/*.md',
			});
			//console.log('docs/dev*/*.md pattern results:', result);

			// Should find markdown files in directories starting with 'd'
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/guide.md' && !suggestion.isDirectory
				),
				'Should find guide.md in development directory',
			);
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/setup.md' && !suggestion.isDirectory
				),
				'Should find setup.md in development directory',
			);
			assertEquals(result.suggestions.length, 2, 'Should find only markdown files in development directory');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test type filtering',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test directory-only
			let result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/**',
				type: 'directory',
			});
			assert(
				result.suggestions.every((s) => s.isDirectory),
				'Should only return directories',
			);

			// Test file-only
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/**',
				type: 'file',
			});
			assert(
				result.suggestions.every((s) => !s.isDirectory),
				'Should only return files',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test path separator handling',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test with forward slashes
			let result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/development/*.md',
			});
			const forwardCount = result.suggestions.length;

			// Test with backslashes
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs\\\\development\\\\*.md',
			});
			assertEquals(result.suggestions.length, forwardCount, 'Should handle both slash types');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test multiple extensions and complex patterns',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test multiple extensions
			let result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: '**/*.test.ts.bak',
			});
			assert(
				result.suggestions.some((s) => s.path === 'docs/development/config.test.ts.bak'),
				'Should match files with multiple extensions',
			);

			// Test multiple wildcards
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: '**/d*/*/*.md',
			});
			assert(result.suggestions.length > 0, 'Should match nested wildcards');

			// // Test alternative patterns
			// result = await suggestFiles({
			// 	startDir: testProjectRoot,
			// 	partialPath: 'docs/{README,guide}.md'
			// });
			// assert(result.suggestions.length > 0, 'Should handle brace expansion');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test special characters in paths',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/*chars*.md',
			});
			assert(
				result.suggestions.some((s) => s.path === 'docs/special chars & symbols.md'),
				'Should handle paths with spaces and special characters',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test limit handling',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test with small limit
			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: '**/*',
				limit: 2,
			});
			assertEquals(result.suggestions.length, 2, 'Should respect result limit');
			assertEquals(result.hasMore, true, 'Should indicate more results available');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test case sensitivity',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Case-sensitive search
			let result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'DOCS/*.md',
				caseSensitive: true,
			});
			assertEquals(result.suggestions.length, 0, 'Case-sensitive search should find no matches');

			// Case-insensitive search (default)
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'DOCS/*.md',
			});
			assert(result.suggestions.length > 0, 'Case-insensitive search should find matches');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test hidden files and directories',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test hidden directory
			let result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: '.config/*',
			});
			assert(
				result.suggestions.some((s) => s.path === '.config/settings.json'),
				'Should find files in hidden directory',
			);

			// Test hidden files
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: '**/.hidden*',
			});
			assert(
				result.suggestions.some((s) => s.path === 'subdir/.hidden.txt'),
				'Should find hidden files',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test empty and invalid patterns',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test empty pattern
			let result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: '/', // Use / to show root contents
			});
			// console.log('empty pattern results:', result);

			// Should show root directory contents
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs' && suggestion.isDirectory
				),
				'Should find docs directory',
			);

			// Test invalid pattern with parent directory reference
			result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: '../outside',
			});
			// console.log('invalid pattern results:', result);

			// Should return empty results for invalid patterns
			assertEquals(result.suggestions.length, 0, 'Should return no results for invalid patterns');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test exact directory name "docs"',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test exact directory name 'docs'
			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs',
			});
			// console.log('exact "docs" pattern results:', result);

			// Should find the docs directory itself
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs' && suggestion.isDirectory
				),
				'Should find the docs directory',
			);

			// Should find all contents recursively
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/README.md' && !suggestion.isDirectory
				),
				'Should find README.md in docs directory',
			);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development' && suggestion.isDirectory
				),
				'Should find development directory',
			);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/guide.md' && !suggestion.isDirectory
				),
				'Should find guide.md in development directory',
			);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/setup.md' && !suggestion.isDirectory
				),
				'Should find setup.md in development directory',
			);

			// Verify we found all expected items
			assertEquals(result.suggestions.length, 7, 'Should find all docs directory contents');
			assertEquals(result.hasMore, false);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test partial directory name "doc"',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test partial directory name 'doc'
			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'doc',
			});
			// console.log('doc pattern results:', result);

			// Should find the docs directory itself
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs' && suggestion.isDirectory
				),
				'Should find the docs directory',
			);

			// Should find all contents recursively
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/README.md' && !suggestion.isDirectory
				),
				'Should find README.md in docs directory',
			);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development' && suggestion.isDirectory
				),
				'Should find development directory',
			);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/guide.md' && !suggestion.isDirectory
				),
				'Should find guide.md in development directory',
			);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/setup.md' && !suggestion.isDirectory
				),
				'Should find setup.md in development directory',
			);

			// Verify we found all expected items
			assertEquals(result.suggestions.length, 7, 'Should find all docs directory contents');
			assertEquals(result.hasMore, false);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test `docs/` pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/',
			});
			// console.log('docs/ pattern results:', result);

			assertEquals(result.suggestions.length, 7);
			//assertStringIncludes(result.files[0], 'file2.js');
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path.endsWith('README.md') && !suggestion.isDirectory
				),
			);
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path.endsWith('development') && suggestion.isDirectory
				),
			);
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path.endsWith('development/guide.md') && !suggestion.isDirectory
				),
			);
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path.endsWith('development/setup.md') && !suggestion.isDirectory
				),
			);
			assertEquals(result.hasMore, false);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test `docs/d` pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test 'docs/d' pattern
			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/d*',
			});
			// console.log('docs/d pattern results:', result);

			// Should find the development directory itself
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development' && suggestion.isDirectory
				),
				'Should find the development directory',
			);

			// When typing 'docs/d', we should see the development directory and its contents
			// First verify the directory itself is found
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development' && suggestion.isDirectory
				),
				'Should find the development directory',
			);

			// Then verify its contents are also found
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/guide.md' && !suggestion.isDirectory
				),
				'Should find guide.md in development directory',
			);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path === 'docs/development/setup.md' && !suggestion.isDirectory
				),
				'Should find setup.md in development directory',
			);

			// Verify we found all expected items
			assertEquals(result.suggestions.length, 4, 'Should find directory and its two files');

			assertEquals(result.hasMore, false);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'suggestFiles - Test `docs/development` pattern',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			await createTestFiles(testProjectRoot);

			// Test 'docs/development' pattern
			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'docs/development/*',
			});
			// console.log('docs/development/* pattern results:', result);

			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path.endsWith('docs/development/guide.md')
				),
				'Should find files directly in development directory',
			);
			assert(
				result.suggestions.some((suggestion: FileSuggestion) =>
					suggestion.path.endsWith('docs/development/setup.md')
				),
				'Should find all files directly in development directory',
			);
			//assertEquals(result.errorMessage, null);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'searchFiles - return an empty array when no files match',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			Deno.writeTextFileSync(join(testProjectRoot, 'file1.txt'), 'Hello, world!');

			const result = await suggestFiles({
				startDir: testProjectRoot,
				partialPath: 'Nonexistent',
			});
			assertEquals(result.suggestions.length, 0, 'Should return no results for non-existent');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
