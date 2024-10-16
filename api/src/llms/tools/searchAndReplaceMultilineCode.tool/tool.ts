import type { JSX } from 'preact';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';

import { dirname, join } from '@std/path';
import { ensureDir } from '@std/fs';

interface LanguageConfig {
	stringDelimiters: string[];
	multiLineDelimiters: string[];
	heredocStart: RegExp;
	heredocEnd: RegExp;
}

const languageConfigs: Record<string, LanguageConfig> = {
	typescript: {
		stringDelimiters: ['`', '"', "'"],
		multiLineDelimiters: ['`'],
		heredocStart: /<<-?\s*(\w+)/,
		heredocEnd: /^\s*(\w+)$/,
	},
	javascript: {
		stringDelimiters: ['`', '"', "'"],
		multiLineDelimiters: ['`'],
		heredocStart: /<<-?\s*(\w+)/,
		heredocEnd: /^\s*(\w+)$/,
	},
	python: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: ['"""', "'''"],
		heredocStart: /<<-?\s*(\w+)/,
		heredocEnd: /^\s*(\w+)$/,
	},
	ruby: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: ['<<-', '<<~'],
		heredocStart: /<<-?(\w+)/,
		heredocEnd: /^\s*(\w+)$/,
	},
	php: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: ['<<<', "<<<'"],
		heredocStart: /<<<['"]?(\w+)['"]?/,
		heredocEnd: /^(\w+);?$/,
	},
	java: {
		stringDelimiters: ['"'],
		multiLineDelimiters: [],
		heredocStart: /$/, // Java doesn't support heredocs
		heredocEnd: /$/,
	},
	csharp: {
		stringDelimiters: ['"'],
		multiLineDelimiters: ['@"'],
		heredocStart: /$/, // C# doesn't support heredocs
		heredocEnd: /$/,
	},
	go: {
		stringDelimiters: ['"', '`'],
		multiLineDelimiters: ['`'],
		heredocStart: /$/, // Go doesn't support heredocs
		heredocEnd: /$/,
	},
	rust: {
		stringDelimiters: ['"'],
		multiLineDelimiters: ['r#"'],
		heredocStart: /$/, // Rust doesn't support heredocs
		heredocEnd: /$/,
	},
	swift: {
		stringDelimiters: ['"'],
		multiLineDelimiters: ['"""'],
		heredocStart: /$/, // Swift doesn't support heredocs
		heredocEnd: /$/,
	},
	kotlin: {
		stringDelimiters: ['"'],
		multiLineDelimiters: ['"""'],
		heredocStart: /$/, // Kotlin doesn't support heredocs
		heredocEnd: /$/,
	},
	scala: {
		stringDelimiters: ['"'],
		multiLineDelimiters: ['"""'],
		heredocStart: /$/, // Scala doesn't support heredocs
		heredocEnd: /$/,
	},
	haskell: {
		stringDelimiters: ['"'],
		multiLineDelimiters: [],
		heredocStart: /$/, // Haskell doesn't support heredocs
		heredocEnd: /$/,
	},
	ocaml: {
		stringDelimiters: ['"'],
		multiLineDelimiters: [],
		heredocStart: /$/, // OCaml doesn't support heredocs
		heredocEnd: /$/,
	},
	bash: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: [],
		heredocStart: /<<-?\s*(['"]?)(\w+)\1/,
		heredocEnd: /^(\w+)$/,
	},
	powershell: {
		stringDelimiters: ["'", '"'],
		multiLineDelimiters: ['@"'],
		heredocStart: /$/, // PowerShell doesn't support heredocs
		heredocEnd: /$/,
	},
	sql: {
		stringDelimiters: ["'"],
		multiLineDelimiters: [],
		heredocStart: /$/, // SQL typically doesn't support heredocs
		heredocEnd: /$/,
	},
	html: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: [],
		heredocStart: /$/, // HTML doesn't support heredocs
		heredocEnd: /$/,
	},
	css: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: [],
		heredocStart: /$/, // CSS doesn't support heredocs
		heredocEnd: /$/,
	},
	scss: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: [],
		heredocStart: /$/, // SCSS doesn't support heredocs
		heredocEnd: /$/,
	},
	json: {
		stringDelimiters: ['"'],
		multiLineDelimiters: [],
		heredocStart: /$/, // JSON doesn't support heredocs
		heredocEnd: /$/,
	},
	xml: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: [],
		heredocStart: /$/, // XML doesn't support heredocs
		heredocEnd: /$/,
	},
	yaml: {
		stringDelimiters: ["'", '"'],
		multiLineDelimiters: ['|', '>'],
		heredocStart: /$/, // YAML doesn't support heredocs in the traditional sense
		heredocEnd: /$/,
	},
	markdown: {
		stringDelimiters: ['"', "'"],
		multiLineDelimiters: ['```'],
		heredocStart: /$/, // Markdown doesn't support heredocs
		heredocEnd: /$/,
	},
	plaintext: {
		stringDelimiters: [],
		multiLineDelimiters: [],
		heredocStart: /$/, // Plaintext doesn't have heredocs
		heredocEnd: /$/,
	},
	// Add more language configs as needed
};

export default class LLMToolSearchAndReplaceCode extends LLMTool {
	private static readonly MIN_SEARCH_LENGTH = 1;

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'The path of the file to be modified or created',
				},
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							search: {
								type: 'string',
								description:
									'The exact literal text to search for, with all leading and trailing whitespace from the original file.',
							},
							replace: {
								type: 'string',
								description:
									'The text to replace with, matching the same indent level as the original file',
							},
							replaceAll: {
								type: 'boolean',
								description: 'Whether to replace all occurrences or just the first one',
								default: false,
							},
							language: {
								type: 'string',
								description:
									'The coding language used for the search and replace text. Default will be determined from file extension if not provided',
							},
						},
						required: ['search', 'replace'],
					},
					description: 'List of literal search and replace operations to apply',
				},
				createIfMissing: {
					type: 'boolean',
					description: 'Create the file if it does not exist (recommended to set this to true)',
					default: true,
				},
			},
			required: ['filePath', 'operations'],
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(resultContent) : formatToolResultBrowser(resultContent);
	}

	/**
	 * Detects the programming language of a file based on its extension and content.
	 *
	 * This function uses a two-step approach to determine the language:
	 * 1. File extension matching: Checks the file extension against a predefined map.
	 * 2. Content-based detection: For files without extensions or with unknown extensions,
	 *    it examines the file content for language-specific patterns (e.g., shebangs).
	 *
	 * Supported languages include but are not limited to:
	 * TypeScript, JavaScript, Python, Ruby, PHP, Java, C#, Go, Rust, Swift, Kotlin,
	 * Scala, Haskell, OCaml, Bash, PowerShell, SQL, HTML, CSS, SCSS, JSON, XML, YAML, and Markdown.
	 *
	 * The function prioritizes explicit file extensions over content-based detection.
	 * If no match is found, it defaults to 'plaintext'.
	 *
	 * Use cases:
	 * - Automatic language detection for syntax highlighting
	 * - Determining appropriate parsing strategies for code analysis tools
	 * - Selecting language-specific processing in multi-language projects
	 *
	 * @param filePath - The full path of the file to be analyzed.
	 * @param content - The content of the file as a string. Used for fallback detection.
	 * @returns The detected language as a string (e.g., 'typescript', 'python').
	 *          Returns 'plaintext' if the language cannot be determined.
	 *
	 * @example
	 * const language = detectLanguage('/path/to/file.ts', 'const x: number = 5;');
	 * // Returns: 'typescript'
	 *
	 * @example
	 * const language = detectLanguage('/path/to/script', '#!/usr/bin/env python\nprint("Hello")');
	 * // Returns: 'python'
	 */
	detectLanguage(filePath: string, content: string): string {
		const extensionMap: Record<string, string> = {
			'.ts': 'typescript',
			'.tsx': 'typescript',
			'.js': 'javascript',
			'.jsx': 'javascript',
			'.py': 'python',
			'.rb': 'ruby',
			'.php': 'php',
			'.java': 'java',
			'.cs': 'csharp',
			'.go': 'go',
			'.rs': 'rust',
			'.swift': 'swift',
			'.kt': 'kotlin',
			'.scala': 'scala',
			'.hs': 'haskell',
			'.ml': 'ocaml',
			'.sh': 'bash',
			'.ps1': 'powershell',
			'.sql': 'sql',
			'.html': 'html',
			'.css': 'css',
			'.scss': 'scss',
			'.json': 'json',
			'.xml': 'xml',
			'.yaml': 'yaml',
			'.md': 'markdown',
		};

		const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();

		if (extension in extensionMap) {
			return extensionMap[extension];
		}

		// Fallback detection for extensionless files or unknown extensions
		if (content.startsWith('#!/usr/bin/env node')) return 'javascript';
		if (content.startsWith('#!/usr/bin/env deno')) return 'typescript';
		if (content.startsWith('#!/usr/bin/env python')) return 'python';
		if (content.startsWith('#!/bin/bash')) return 'bash';

		// Default fallback
		return 'plaintext';
	}

	/**
	 * Tokenizes a search string for use in literal replacement operations.
	 *
	 * This function processes the input string to handle language-specific string
	 * delimiters, multi-line strings, and heredocs. It performs the following tasks:
	 *
	 * 1. Preserves literal whitespace characters (newlines, tabs) outside of string contexts.
	 * 2. Escapes backslashes and special characters within string literals.
	 * 3. Handles single-line and multi-line string delimiters based on the specified language.
	 * 4. Supports heredoc syntax, preserving its content without modification.
	 *
	 * The function traverses the input string character by character, keeping track of
	 * the current context (e.g., whether it's inside a string, multi-line string, or heredoc).
	 * It applies different rules for character handling based on this context.
	 *
	 * Key behaviors:
	 * - Outside strings: Escapes literal whitespace characters.
	 * - Inside strings: Escapes backslashes and preserves other characters.
	 * - Multi-line strings: Preserves newlines and content as-is.
	 * - Heredocs: Preserves entire content without modification.
	 *
	 * The resulting tokenized string can be used to create a regex pattern that
	 * accurately matches the original content, including literal whitespace and
	 * string escape sequences, in the context of the specified programming language.
	 *
	 * @param search - The original search string to be tokenized.
	 * @param language - The programming language context (default: 'typescript').
	 * @returns A tokenized string with appropriate escaping and preservation of language constructs.
	 * @throws {Error} If an unsupported language is specified.
	 */
	tokenizeSearchString(search: string, language: string = 'typescript'): string {
		console.log('tokenizeSearchString - Input:', JSON.stringify(search));
		// Replace all whitespace sequences with a flexible whitespace matcher
		const flexibleSearch = search.replace(/\s+/g, '\\s*');
		console.log('tokenizeSearchString - Flexible search:', JSON.stringify(flexibleSearch));
		//return flexibleSearch;
		console.log('tokenizeSearchString - Input:', JSON.stringify(search));
		console.log('tokenizeSearchString - Input (char codes):', search.split('').map((c) => c.charCodeAt(0)));
		console.log('tokenizeSearchString - Input:', JSON.stringify({ search, language }));
		const config = languageConfigs[language];
		if (!config) throw new Error(`Unsupported language: ${language}`);

		let inString = false;
		let inMultiLine = false;
		let inHeredoc = false;
		let currentDelimiter = '';
		let heredocEndMarker = '';
		let result = '';

		const lines = search.split('\n');

		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			for (let i = 0; i < line.length; i++) {
				if (!inString && !inMultiLine && !inHeredoc) {
					const heredocMatch = line.slice(i).match(config.heredocStart);
					if (heredocMatch != null && heredocMatch.length > 1) {
						inHeredoc = true;
						heredocEndMarker = heredocMatch[1];
						result += line.slice(i, i + heredocMatch[0].length);
						i += heredocMatch[0].length - 1;
						continue;
					}
				}

				if (inHeredoc) {
					const heredocEndMatch = line.match(config.heredocEnd);
					if (heredocEndMatch && heredocEndMatch.length > 1 && heredocEndMatch[1] === heredocEndMarker) {
						inHeredoc = false;
						heredocEndMarker = '';
					}
					result += line[i];
					continue;
				}

				if (config.stringDelimiters.includes(line[i])) {
					if (!inString && !inMultiLine) {
						inString = true;
						currentDelimiter = line[i];
					} else if (line[i] === currentDelimiter) {
						inString = false;
					}
					result += line[i];
				} else if (config.multiLineDelimiters.some((delim) => line.startsWith(delim, i))) {
					const delimiter = config.multiLineDelimiters.find((delim) => line.startsWith(delim, i))!;
					inMultiLine = !inMultiLine;
					currentDelimiter = delimiter;
					result += delimiter;
					i += delimiter.length - 1;
				} else if ((inString || inMultiLine) && line[i] === '\\' && i + 1 < line.length) {
					result += '\\\\' + line[i + 1];
					i++;
				} else if (!inString && !inMultiLine && (line[i] === '\t' || line[i] === '\r')) {
					result += line[i] === '\t' ? '\\t' : '\\r';
				} else {
					result += line[i];
				}
			}
			if (lineIndex < lines.length - 1) {
				result += inString || inMultiLine || inHeredoc ? '\n' : '\\n';
			}
		}
		console.log('tokenizeSearchString - Result:', JSON.stringify(result));
		console.log('tokenizeSearchString - Result (char codes):', result.split('').map((c) => c.charCodeAt(0)));
		return result;
	}

	/**
	 * Performs a literal search and replace operation on a given content string.
	 *
	 * This function is designed to handle complex search and replace operations
	 * while respecting the syntax and structure of various programming languages.
	 * It uses the `tokenizeSearchString` function to preprocess the search string,
	 * ensuring accurate matching of literal whitespace, string contents, and
	 * language-specific constructs.
	 *
	 * Key features:
	 * 1. Language-aware: Handles different string delimiters and language constructs.
	 * 2. Literal matching: Correctly matches literal whitespace and escape sequences.
	 * 3. Flexible replacement: Supports both single and global (all occurrences) replacements.
	 *
	 * The function works as follows:
	 * 1. Tokenizes the search string using language-specific rules.
	 * 2. Escapes special regex characters in the tokenized search string.
	 * 3. Creates a RegExp object from the escaped search string.
	 * 4. Performs the replacement using JavaScript's native string replace method.
	 *
	 * Use cases:
	 * - Refactoring code across multiple files.
	 * - Updating specific patterns in configuration files.
	 * - Modifying string contents while preserving surrounding code structure.
	 *
	 * @param content - The original content string to perform replacement on.
	 * @param search - The search string or pattern to look for.
	 * @param replace - The string to replace matched content with.
	 * @param replaceAll - Whether to replace all occurrences (true) or just the first one (false). Default is false.
	 * @param language - The programming language context for accurate tokenization. Default is 'typescript'.
	 * @returns The modified content string after performing the replacement.
	 *
	 * @example
	 * const content = "function test(\n\t arg1,\n\t arg2\n) {\n\tconsole.log(`Line1\\nLine2`);\n}";
	 * const search = "function test(\n\t arg1,\n\t arg2\n) {";
	 * const replace = "function newTest(arg1, arg2) {";
	 * const result = literalReplace(content, search, replace, false, 'typescript');
	 * // result: "function newTest(arg1, arg2) {\n\tconsole.log(`Line1\\nLine2`);\n}"
	 */
	literalReplace(
		content: string,
		search: string,
		replace: string,
		replaceAll = false,
		language = 'typescript',
	): string {
		const tokenizedSearch = this.tokenizeSearchString(search, language);
		console.log('literalReplace - Tokenized search:', JSON.stringify(tokenizedSearch));
		// Replace all whitespace with a flexible whitespace matcher
		const flexibleSearch = tokenizedSearch.replace(/\s+/g, '\\s+');
		console.log('literalReplace - Flexible search:', JSON.stringify(flexibleSearch));
		console.log('literalReplace - Tokenized search:', JSON.stringify(tokenizedSearch));
		const regex = new RegExp(tokenizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), replaceAll ? 'g' : '');
		const result = content.replace(regex, replace);
		console.log('literalReplace - Result:', JSON.stringify(result));
		console.log('literalReplace - Are strings identical?', content === result);
		console.log('literalReplace - Result:', JSON.stringify(result));
		console.log('literalReplace - Are strings identical?', content === result);
		if (content === result) {
			console.log('literalReplace - Detailed comparison:');
			for (let i = 0; i < Math.max(content.length, result.length); i++) {
				if (content[i] !== result[i]) {
					console.log(`Difference at index ${i}:`);
					console.log(`  Content: ${JSON.stringify(content[i])} (${content.charCodeAt(i)})`);
					console.log(`  Result:  ${JSON.stringify(result[i])} (${result.charCodeAt(i)})`);
				}
			}
		}
		return result;
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { filePath, operations, createIfMissing = true } = toolInput as {
			filePath: string;
			operations: Array<{ search: string; replace: string; replaceAll?: boolean; language?: string }>;
			createIfMissing?: boolean;
		};

		if (!await isPathWithinProject(projectEditor.projectRoot, filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				name: 'search-and-replace',
				filePath,
				operation: 'search-replace',
			} as FileHandlingErrorOptions);
		}

		const fullFilePath = join(projectEditor.projectRoot, filePath);
		logger.info(`Handling search and replace for file: ${fullFilePath}`);

		try {
			let content: string;
			let isNewFile = false;
			try {
				content = await Deno.readTextFile(fullFilePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					content = '';
					isNewFile = true;
					logger.info(`File ${fullFilePath} not found. Creating new file.`);
					// Create missing directories
					await ensureDir(dirname(fullFilePath));
					logger.info(`Created directory structure for ${fullFilePath}`);
				} else {
					throw error;
				}
			}

			let changesMade = false;
			let allOperationsSkipped = true;
			const toolWarnings = [];
			for (const operation of operations) {
				const { search, replace, replaceAll = false, language } = operation;

				// Validate search string
				if (!isNewFile && search.length < LLMToolSearchAndReplaceCode.MIN_SEARCH_LENGTH) {
					const warningMessage =
						`Warning: Search string is too short (minimum ${LLMToolSearchAndReplaceCode.MIN_SEARCH_LENGTH} character(s)) for existing file. Operation skipped.`;
					logger.warn(warningMessage);
					toolWarnings.push(warningMessage);
					continue;
				}

				// Validate that search and replace strings are different
				if (search === replace) {
					const warningMessage = `Warning: Search and replace strings are identical. Operation skipped.`;
					logger.warn(warningMessage);
					toolWarnings.push(warningMessage);
					continue;
				}

				// 				const literalReplace = (
				// 					content: string,
				// 					search: string,
				// 					replace: string,
				// 					replaceAll = false,
				// 				): string => {
				// 					/*
				// 					The regex `/[.*+?^${}()|[\]\\]/g` is used to escape special regex characters:
				//
				// 					- `[...]` defines a character set
				// 					- Characters inside are regex metacharacters: . * + ? ^ $ { } ( ) | [ ] \
				// 					- `\\` escapes the backslash itself
				// 					- `/g` flag makes it global, replacing all occurrences
				//
				// 					`'\\$&'` in the replacement string:
				// 					- `\\` produces a literal backslash
				// 					- `$&` refers to the matched substring
				//
				// 					This effectively prepends a backslash to any regex special character, ensuring they're treated as literal characters in the subsequent regex operation.
				// 					 */
				// 					const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				// 					const regex = new RegExp(escapedSearch, replaceAll ? 'g' : '');
				// 					return content.replace(regex, replace);
				// 				};
				console.log('Original content:', content);
				console.log('Search string:', search);
				console.log('Replace string:', replace);
				const originalContent = content;
				const opLanguage = language || this.detectLanguage(filePath, content);
				content = this.literalReplace(content, search, replace, replaceAll, opLanguage);
				console.log('Result:', content);
				console.log('Are strings identical?', originalContent === content);
				// Check if the content actually changed
				if (content !== originalContent) {
					changesMade = true;
					allOperationsSkipped = false;
				}
			}
			let toolWarning = '';
			if (toolWarnings.length > 0) {
				toolWarning = `Tool Use Warnings: \n${toolWarnings.join('\n')}\n`;
			}

			if (changesMade || isNewFile) {
				await Deno.writeTextFile(fullFilePath, content);
				logger.info(`Saving conversation search and replace: ${interaction.id}`);

				await projectEditor.orchestratorController.logChangeAndCommit(
					interaction,
					filePath,
					JSON.stringify(operations),
				);

				const toolResults = toolWarning;
				const toolResponse = isNewFile
					? `File created and search and replace operations applied successfully to file: ${filePath}`
					: `Search and replace operations applied successfully to file: ${filePath}`;
				const bbResponse = `BB applied search and replace operations: ${toolWarning}`;

				return { toolResults, toolResponse, bbResponse };
			} else {
				const noChangesMessage = allOperationsSkipped
					? `${toolWarning}No changes were made to the file: ${filePath}. All operations were skipped due to identical source and destination strings.`
					: `${toolWarning}No changes were made to the file: ${filePath}. The search strings were not found in the file content.`;
				logger.info(noChangesMessage);

				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'search-and-replace',
					filePath: filePath,
					operation: 'search-replace',
				} as FileHandlingErrorOptions);
			}
		} catch (error) {
			if (error.name === 'search-and-replace') {
				throw error;
			}
			let errorMessage = `Failed to apply search and replace to ${filePath}: ${error.message}`;
			logger.error(errorMessage);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'search-and-replace',
				filePath: filePath,
				operation: 'search-replace',
			} as FileHandlingErrorOptions);
		}
	}
}
