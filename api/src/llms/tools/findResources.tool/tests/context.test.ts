import { join } from '@std/path';

import { assert, assertStringIncludes } from 'api/tests/deps.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

// Helper function to create test files with predictable content for context testing
async function createContextTestFiles(testProjectRoot: string) {
	// File with multiple matches and clear context lines
	await Deno.writeTextFile(
		join(testProjectRoot, 'multi-match.txt'),
		[
			'Line 1: Introduction',
			'Line 2: Setup code',
			'Line 3: function searchPattern() {',
			'Line 4:   // Implementation here',
			'Line 5:   return searchPattern;',
			'Line 6: }',
			'Line 7: ',
			'Line 8: function otherFunction() {',
			'Line 9:   const result = searchPattern();',
			'Line 10:   return result;',
			'Line 11: }',
			'Line 12: ',
			'Line 13: // Another searchPattern reference',
			'Line 14: const final = searchPattern;',
			'Line 15: export { final };',
		].join('\n'),
	);

	// File with matches at boundaries (beginning and end)
	await Deno.writeTextFile(
		join(testProjectRoot, 'boundary-match.txt'),
		[
			'MATCH at start of file',
			'Line 2: middle content',
			'Line 3: more content',
			'Line 4: final line with MATCH',
		].join('\n'),
	);

	// Single line file with match
	await Deno.writeTextFile(join(testProjectRoot, 'single-line.txt'), 'Only one line with TARGET pattern');

	// File with many matches for testing maxMatchesPerFile
	const manyMatchLines: string[] = [];
	for (let i = 1; i <= 20; i++) {
		if (i % 3 === 0) {
			manyMatchLines.push(`Line ${i}: This contains FREQUENT pattern here`);
		} else {
			manyMatchLines.push(`Line ${i}: Regular content without pattern`);
		}
	}
	await Deno.writeTextFile(join(testProjectRoot, 'many-matches.txt'), manyMatchLines.join('\n'));

	// File with overlapping context (matches close together)
	await Deno.writeTextFile(
		join(testProjectRoot, 'close-matches.txt'),
		[
			'Line 1: Context before',
			'Line 2: First CLOSE match here',
			'Line 3: Between the matches',
			'Line 4: Second CLOSE match here',
			'Line 5: Context after',
		].join('\n'),
	);

	// Empty file for edge case
	await Deno.writeTextFile(join(testProjectRoot, 'empty.txt'), '');

	// File with very long lines for testing match position
	await Deno.writeTextFile(
		join(testProjectRoot, 'long-lines.txt'),
		[
			'Short line',
			'This is a very long line with lots of text before the POSITION marker and more text after',
			'Another short line',
		].join('\n'),
	);
}

// Helper function to parse enhanced search results
function parseEnhancedResults(toolResults: string): {
	matches: Array<{
		resourcePath: string;
		contentMatches: Array<{
			lineNumber: number;
			content: string;
			contextBefore: string[];
			contextAfter: string[];
			matchStart?: number;
			matchEnd?: number;
		}>;
	}>;
} {
	// Parse the JSON from <enhanced-results> tags
	const enhancedMatch = toolResults.match(/<enhanced-results>\s*({[\s\S]*?})\s*<\/enhanced-results>/);
	if (!enhancedMatch) {
		return { matches: [] };
	}

	try {
		const parsedResults = JSON.parse(enhancedMatch[1]);
		return parsedResults;
	} catch (error) {
		console.error('Failed to parse enhanced results:', error);
		return { matches: [] };
	}
}

// Helper function to check if result contains enhanced content
function hasEnhancedContent(toolResults: string): boolean {
	return toolResults.includes('<enhanced-results>');
}

// Type guard to check if bbResponse is a string
function isString(value: unknown): value is string {
	return typeof value === 'string';
}

Deno.test({
	name: 'FindResourcesTool - Context extraction with default contextLines (2)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'searchPattern',
					resourcePattern: 'multi-match.txt',
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Context extraction with default contextLines (2) - bbResponse:', result.bbResponse);
			// console.log('Context extraction with default contextLines (2) - toolResponse:', result.toolResponse);
			// console.log('Context extraction with default contextLines (2) - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			// Should find the file with matches
			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					'BB found 1 resources matching the search criteria',
				);
			}

			const toolResults = result.toolResults as string;

			// Verify enhanced content format is returned
			assert(hasEnhancedContent(toolResults), 'Should return enhanced content format for content searches');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'multi-match.txt');

			// Should find multiple matches for 'searchPattern' in the file
			assert(fileMatch.contentMatches.length >= 3, 'Should find multiple matches in file');

			// Validate first match (line 3: function searchPattern() {)
			const firstMatch = fileMatch.contentMatches[0];
			assert(firstMatch.lineNumber === 3, `Expected line 3, got ${firstMatch.lineNumber}`);
			assertStringIncludes(firstMatch.content, 'function searchPattern');

			// With default contextLines=2, should have 2 lines before and after (where available)
			assert(
				firstMatch.contextBefore.length === 2,
				`Expected 2 context lines before, got ${firstMatch.contextBefore.length}`,
			);
			assertStringIncludes(firstMatch.contextBefore[0], 'Line 1: Introduction');
			assertStringIncludes(firstMatch.contextBefore[1], 'Line 2: Setup code');

			assert(
				firstMatch.contextAfter.length === 2,
				`Expected 2 context lines after, got ${firstMatch.contextAfter.length}`,
			);
			assertStringIncludes(firstMatch.contextAfter[0], 'Line 4:   // Implementation here');
			assertStringIncludes(firstMatch.contextAfter[1], 'Line 5:   return searchPattern;');

			// Validate match positions
			assert(typeof firstMatch.matchStart === 'number', 'Match start position should be provided');
			assert(typeof firstMatch.matchEnd === 'number', 'Match end position should be provided');
			assert(firstMatch.matchEnd > firstMatch.matchStart, 'Match end should be after start');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Context extraction with contextLines=0 (no context)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'searchPattern',
					resourcePattern: 'multi-match.txt',
					contextLines: 0,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Context extraction with contextLines=0 (no context) - bbResponse:', result.bbResponse);
			// console.log('Context extraction with contextLines=0 (no context) - toolResponse:', result.toolResponse);
			// console.log('Context extraction with contextLines=0 (no context) - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'multi-match.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'multi-match.txt');

			// Should find matches but with no context
			assert(fileMatch.contentMatches.length >= 1, 'Should find at least 1 match');

			// Verify no context lines are included
			fileMatch.contentMatches.forEach((match, index) => {
				assert(match.contextBefore.length === 0, `Match ${index + 1} should have no context before`);
				assert(match.contextAfter.length === 0, `Match ${index + 1} should have no context after`);
				assertStringIncludes(match.content, 'searchPattern', `Match ${index + 1} should contain pattern`);
			});
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Context extraction with contextLines=5 (extended context)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'searchPattern',
					resourcePattern: 'multi-match.txt',
					contextLines: 5,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Context extraction with contextLines=5 (extended context) - bbResponse:', result.bbResponse);
			// console.log('Context extraction with contextLines=5 (extended context) - toolResponse:', result.toolResponse);
			// console.log('Context extraction with contextLines=5 (extended context) - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'multi-match.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'multi-match.txt');

			// Should find matches with extended context
			assert(fileMatch.contentMatches.length >= 1, 'Should find at least 1 match');

			// Verify first match has more context (up to 5 lines each way)
			const firstMatch = fileMatch.contentMatches[0];
			// Line 3 should have 2 lines before (lines 1,2) and more lines after
			assert(
				firstMatch.contextBefore.length === 2,
				`Expected 2 context lines before (limited by file start), got ${firstMatch.contextBefore.length}`,
			);
			assert(
				firstMatch.contextAfter.length >= 3,
				`Expected more context lines after with contextLines=5, got ${firstMatch.contextAfter.length}`,
			);

			// Verify context content
			assertStringIncludes(firstMatch.contextBefore[0], 'Line 1');
			assertStringIncludes(firstMatch.contextBefore[1], 'Line 2');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - maxMatchesPerFile=2 limits results',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'FREQUENT',
					resourcePattern: 'many-matches.txt',
					maxMatchesPerFile: 2,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('maxMatchesPerFile=2 limits results - bbResponse:', result.bbResponse);
			// console.log('maxMatchesPerFile=2 limits results - toolResponse:', result.toolResponse);
			// console.log('maxMatchesPerFile=2 limits results - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'many-matches.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'many-matches.txt');

			// Should limit to exactly 2 matches per file
			assert(
				fileMatch.contentMatches.length === 2,
				`Expected exactly 2 matches, got ${fileMatch.contentMatches.length}`,
			);

			// Verify all matches contain the pattern
			fileMatch.contentMatches.forEach((match, index) => {
				assertStringIncludes(match.content, 'FREQUENT', `Match ${index + 1} should contain pattern`);
				assert(match.lineNumber > 0, `Match ${index + 1} should have valid line number`);
			});
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - maxMatchesPerFile=1 returns only first match',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'searchPattern',
					resourcePattern: 'multi-match.txt',
					maxMatchesPerFile: 1,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('maxMatchesPerFile=1 returns only first match - bbResponse:', result.bbResponse);
			// console.log('maxMatchesPerFile=1 returns only first match - toolResponse:', result.toolResponse);
			// console.log('maxMatchesPerFile=1 returns only first match - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'multi-match.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'multi-match.txt');

			// Should limit to exactly 1 match per file
			assert(
				fileMatch.contentMatches.length === 1,
				`Expected exactly 1 match, got ${fileMatch.contentMatches.length}`,
			);

			// Should be the first occurrence
			const match = fileMatch.contentMatches[0];
			assert(match.lineNumber === 3, `Expected first match on line 3, got line ${match.lineNumber}`);
			assertStringIncludes(match.content, 'function searchPattern');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Match at beginning of file (boundary case)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'MATCH at start',
					resourcePattern: 'boundary-match.txt',
					contextLines: 3,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Match at beginning of file (boundary case) - bbResponse:', result.bbResponse);
			// console.log('Match at beginning of file (boundary case) - toolResponse:', result.toolResponse);
			// console.log('Match at beginning of file (boundary case) - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'boundary-match.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'boundary-match.txt');

			assert(fileMatch.contentMatches.length === 1, 'Should find exactly 1 match');
			const match = fileMatch.contentMatches[0];

			// Match should be on line 1
			assert(match.lineNumber === 1, `Expected match on line 1, got ${match.lineNumber}`);
			assertStringIncludes(match.content, 'MATCH at start');

			// Should have no context before (start of file)
			assert(
				match.contextBefore.length === 0,
				`Expected no context before start of file, got ${match.contextBefore.length}`,
			);

			// Should have context after (up to 3 lines)
			assert(match.contextAfter.length >= 2, `Expected context after, got ${match.contextAfter.length}`);
			assertStringIncludes(match.contextAfter[0], 'Line 2');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Match at end of file (boundary case)',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'final line with MATCH',
					resourcePattern: 'boundary-match.txt',
					contextLines: 3,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Match at end of file (boundary case) - bbResponse:', result.bbResponse);
			// console.log('Match at end of file (boundary case) - toolResponse:', result.toolResponse);
			// console.log('Match at end of file (boundary case) - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'boundary-match.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'boundary-match.txt');

			assert(fileMatch.contentMatches.length === 1, 'Should find exactly 1 match');
			const match = fileMatch.contentMatches[0];

			// Match should be on line 4 (last line)
			assert(match.lineNumber === 4, `Expected match on line 4, got ${match.lineNumber}`);
			assertStringIncludes(match.content, 'final line with MATCH');

			// Should have context before (up to 3 lines)
			assert(match.contextBefore.length >= 2, `Expected context before, got ${match.contextBefore.length}`);
			assertStringIncludes(match.contextBefore[match.contextBefore.length - 1], 'Line 3');

			// Should have no context after (end of file)
			assert(
				match.contextAfter.length === 0,
				`Expected no context after end of file, got ${match.contextAfter.length}`,
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Single line file with match',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'TARGET',
					resourcePattern: 'single-line.txt',
					contextLines: 3,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Single line file with match - bbResponse:', result.bbResponse);
			// console.log('Single line file with match - toolResponse:', result.toolResponse);
			// console.log('Single line file with match - toolResults:', result.toolResults);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'single-line.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'single-line.txt');

			assert(fileMatch.contentMatches.length === 1, 'Should find exactly 1 match');
			const match = fileMatch.contentMatches[0];

			// Match should be on line 1
			assert(match.lineNumber === 1, `Expected match on line 1, got ${match.lineNumber}`);
			assertStringIncludes(match.content, 'TARGET');

			// Should have no context (single line file)
			assert(
				match.contextBefore.length === 0,
				`Expected no context before in single-line file, got ${match.contextBefore.length}`,
			);
			assert(
				match.contextAfter.length === 0,
				`Expected no context after in single-line file, got ${match.contextAfter.length}`,
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Close matches with overlapping context',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'CLOSE',
					resourcePattern: 'close-matches.txt',
					contextLines: 2,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'close-matches.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'close-matches.txt');

			// Should find 2 matches for 'CLOSE'
			assert(fileMatch.contentMatches.length === 2, `Expected 2 matches, got ${fileMatch.contentMatches.length}`);

			// Verify both matches
			const firstMatch = fileMatch.contentMatches[0];
			const secondMatch = fileMatch.contentMatches[1];

			assert(firstMatch.lineNumber === 2, `Expected first match on line 2, got ${firstMatch.lineNumber}`);
			assert(secondMatch.lineNumber === 4, `Expected second match on line 4, got ${secondMatch.lineNumber}`);

			assertStringIncludes(firstMatch.content, 'First CLOSE match');
			assertStringIncludes(secondMatch.content, 'Second CLOSE match');

			// Each should have appropriate context (handling overlap intelligently)
			assert(firstMatch.contextBefore.length >= 1, 'First match should have context before');
			assert(secondMatch.contextAfter.length >= 1, 'Second match should have context after');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Parameter validation: contextLines boundary values',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			// Test maximum valid value
			const toolUseMax: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id-max',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'searchPattern',
					resourcePattern: 'multi-match.txt',
					contextLines: 10, // Maximum allowed
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const resultMax = await tool.runTool(conversation, toolUseMax, projectEditor);

			assert(isString(resultMax.bbResponse), 'bbResponse should be a string');

			// Should accept maximum valid value and provide extensive context
			assertStringIncludes(resultMax.toolResults as string, 'multi-match.txt');

			// Parse and validate that contextLines=10 provides maximum context
			const enhancedResults = parseEnhancedResults(resultMax.toolResults as string);
			if (enhancedResults.matches.length > 0) {
				const fileMatch = enhancedResults.matches[0];
				if (fileMatch.contentMatches.length > 0) {
					const match = fileMatch.contentMatches[0];
					// Should provide more context than default (limited by actual file size)
					assert(
						match.contextBefore.length + match.contextAfter.length >= 4,
						'Maximum contextLines should provide more total context lines',
					);
				}
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Parameter validation: maxMatchesPerFile boundary values',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			// Test maximum valid value
			const toolUseMax: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id-max',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'FREQUENT',
					resourcePattern: 'many-matches.txt',
					maxMatchesPerFile: 20, // Maximum allowed
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const resultMax = await tool.runTool(conversation, toolUseMax, projectEditor);

			assert(isString(resultMax.bbResponse), 'bbResponse should be a string');

			// Should accept maximum valid value and include all matches
			assertStringIncludes(resultMax.toolResults as string, 'many-matches.txt');

			// Parse and validate that maxMatchesPerFile=20 includes all matches
			const enhancedResults = parseEnhancedResults(resultMax.toolResults as string);
			if (enhancedResults.matches.length > 0) {
				const fileMatch = enhancedResults.matches[0];
				// File has matches every 3rd line, so should find several
				assert(
					fileMatch.contentMatches.length >= 5,
					`Expected several matches with maxMatchesPerFile=20, got ${fileMatch.contentMatches.length}`,
				);

				// All matches should contain the pattern
				fileMatch.contentMatches.forEach((match, index) => {
					assertStringIncludes(match.content, 'FREQUENT', `Match ${index + 1} should contain pattern`);
				});
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Backward compatibility: metadata search unchanged',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			// Metadata-only search (no contentPattern)
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					resourcePattern: '*.txt',
					sizeMin: 1,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;

			// Should return simple resource list format (not enhanced)
			assertStringIncludes(toolResults, '<resources>');
			assertStringIncludes(toolResults, '</resources>');

			// Should not include enhanced content format for metadata searches
			assert(
				!hasEnhancedContent(toolResults),
				'Metadata searches should not return enhanced content format',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Content search vs metadata search format difference',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const conversation = await projectEditor.initCollaboration('test-conversation-id');

			// Test metadata search
			const metadataSearch: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-metadata',
				toolName: 'find_resources',
				toolInput: {
					resourcePattern: 'multi-match.txt',
				},
			};

			const metadataResult = await tool.runTool(conversation, metadataSearch, projectEditor);
			const metadataOutput = metadataResult.toolResults as string;

			// Test content search
			const contentSearch: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-content',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'searchPattern',
					resourcePattern: 'multi-match.txt',
				},
			};

			const contentResult = await tool.runTool(conversation, contentSearch, projectEditor);
			const contentOutput = contentResult.toolResults as string;

			// Both should find the file
			assertStringIncludes(metadataOutput, 'multi-match.txt');
			assertStringIncludes(contentOutput, 'multi-match.txt');

			// Content search should have enhanced format, metadata search should not
			// (This test validates that the two modes produce different output formats)
			// Parse both results and compare formats
			const hasMetadataEnhanced = hasEnhancedContent(metadataOutput);
			const hasContentEnhanced = hasEnhancedContent(contentOutput);

			// Metadata search should NOT have enhanced format
			assert(!hasMetadataEnhanced, 'Metadata search should not return enhanced content format');

			// Content search SHOULD have enhanced format
			assert(hasContentEnhanced, 'Content search should return enhanced content format');

			// Verify content search has the expected structure
			const enhancedResults = parseEnhancedResults(contentOutput);
			assert(enhancedResults.matches.length === 1, 'Content search should find file with enhanced data');
			assert(
				enhancedResults.matches[0].contentMatches.length >= 1,
				'Should have content matches with line details',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Empty file handling with content search',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'anything',
					resourcePattern: 'empty.txt',
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			// Should handle empty files gracefully (no matches found)
			if (isString(result.bbResponse)) {
				assertStringIncludes(
					result.bbResponse,
					'BB found 0 resources matching the search criteria',
				);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'FindResourcesTool - Context with regex pattern and case sensitivity',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			await createContextTestFiles(testProjectRoot);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('find_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'find_resources',
				toolInput: {
					contentPattern: 'function\\s+\\w+\\s*\\(',
					resourcePattern: 'multi-match.txt',
					caseSensitive: true,
					contextLines: 1,
					maxMatchesPerFile: 3,
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);

			assert(isString(result.bbResponse), 'bbResponse should be a string');

			const toolResults = result.toolResults as string;
			assertStringIncludes(toolResults, 'multi-match.txt');

			// Parse and validate the enhanced results
			const enhancedResults = parseEnhancedResults(toolResults);
			assert(enhancedResults.matches.length === 1, 'Should find exactly 1 matching file');

			const fileMatch = enhancedResults.matches[0];
			assertStringIncludes(fileMatch.resourcePath, 'multi-match.txt');

			// Should find function declarations (limited by maxMatchesPerFile=3)
			assert(
				fileMatch.contentMatches.length <= 3,
				`Expected max 3 matches, got ${fileMatch.contentMatches.length}`,
			);
			assert(fileMatch.contentMatches.length >= 1, 'Should find at least 1 function');

			// Verify all matches are function declarations
			fileMatch.contentMatches.forEach((match, index) => {
				assertStringIncludes(match.content, 'function', `Match ${index + 1} should contain 'function'`);
				assert(match.lineNumber > 0, `Match ${index + 1} should have valid line number`);

				// With contextLines=1, should have up to 1 line before/after
				assert(match.contextBefore.length <= 1, `Match ${index + 1} should have max 1 context line before`);
				assert(match.contextAfter.length <= 1, `Match ${index + 1} should have max 1 context line after`);
			});
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
