// This file is auto-generated. Do not edit manually.
import type { ToolMetadata } from './llmToolManager.ts';

interface CoreTool {
	toolNamePath: string;
	metadata: ToolMetadata;
}

export const CORE_TOOLS: Array<CoreTool> = [
	{
		'toolNamePath': 'conversationSummary.tool',
		'metadata': {
			'name': 'conversation_summary',
			'description':
				'Summarize and optionally truncate the current conversation. Can be used both explicitly by user request or proactively by the LLM when the conversation becomes long. When truncating, preserves the most recent messages to maintain immediate context while reducing token usage. This helps maintain conversation effectiveness by staying within model context limits while keeping the most relevant recent interactions. The tool generates a summary of the conversation content to maintain awareness of earlier context even after truncation.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'enabled': true,
		},
	},
	{
		'toolNamePath': 'moveFiles.tool',
		'metadata': {
			'name': 'move_files',
			'description':
				'Move one or more files or directories to a new location within the project. Preserves file names while changing location. For renaming files, use rename_files instead. Consider impact on imports and references when moving files between directories.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'conversationMetrics.tool',
		'metadata': {
			'name': 'conversation_metrics',
			'description':
				'Analyze conversation metrics including turns, message types, token usage, tool usage patterns, file operations, and interaction quality. Use for understanding conversation efficiency, resource usage, and identifying improvement opportunities.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'searchProject.tool',
		'metadata': {
			'name': 'search_project',
			'description':
				"Search project files by content pattern (grep-style regex), file name pattern (glob), modification date, or file size. Use this tool to discover files when you don't know their exact paths. For known file paths, use request_files instead.",
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'requestFiles.tool',
		'metadata': {
			'name': 'request_files',
			'description':
				'Request one or more files to be added to the conversation. Use this tool when you know the exact file paths. For discovering files, use search_project instead. Always review file contents before making suggestions or changes.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'fetchWebScreenshot.tool',
		'metadata': {
			'name': 'fetch_web_screenshot',
			'description':
				"Captures a screenshot of a specified web page. Use this for visual content, layout analysis, or when text extraction isn't sufficient. Returns an image of the rendered page. Some sites may block automated access or require authentication. For text content, use fetch_web_page instead.",
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'fetchWebPage.tool',
		'metadata': {
			'name': 'fetch_web_page',
			'description':
				'Fetches the content of a specified web page. Returns the text content of HTML pages, stripping scripts and styles. For visual content, use fetch_web_screenshot instead. Some sites may block automated access or require authentication. Response size may be limited.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'searchAndReplace.tool',
		'metadata': {
			'name': 'search_and_replace',
			'description':
				'Apply a list of search and replace operations to a file. Each operation can use exact literal text matching (preserving whitespace) or regex patterns. For exact matches, whitespace and indentation must match the source file exactly. For regex patterns, use the regexPattern option.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'forgetFiles.tool',
		'metadata': {
			'name': 'forget_files',
			'description':
				'Remove files from the conversation context to reduce token usage. When prompt caching is enabled, files remain in the cached context but should be mentally excluded. When prompt caching is disabled, files are actively removed from the context. Use this to manage conversation scope and reduce cognitive load.',
			'version': '1.0.0',
			'category': 'FileManipulation',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'searchAndReplaceMultilineCode.tool',
		'metadata': {
			'name': 'search_and_replace_multiline_code',
			'description': 'Apply a list of search and replace operations to a file, supporting multiline code',
			'enabled': false,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'vectorSearch.tool',
		'metadata': {
			'name': 'vector_search',
			'description': 'Performs vector search operations',
			'enabled': false,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'runCommand.tool',
		'metadata': {
			'name': 'run_command',
			'description':
				"Run a system command from the user-configured allow list and return the output. For security, only commands explicitly added to the allow list can be executed. Users can configure any shell commands they wish to permit. If you need a command that isn't in the allowed list, suggest that the user add it to their configuration. Commands may output to both stdout and stderr; stderr doesn't always indicate an error.",
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'config': {
				'allowedCommands': [
					'deno task tool:check-types-project',
					'deno task tool:check-types-args',
					'deno task tool:test',
					'deno task tool:format',
				],
			},
		},
	},
	{
		'toolNamePath': 'delegateTasks.tool',
		'metadata': {
			'name': 'delegate_tasks',
			'description':
				'Delegate tasks to child interactions. Input includes background, instructions, and resources. Output is the completed task requirements.',
			'enabled': false,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'multiModelQuery.tool',
		'metadata': {
			'name': 'multi_model_query',
			'description':
				'Query multiple LLM models simultaneously using the exact prompt provided by the user. The prompt is passed to each model with minimal modification, and their complete responses are returned separately without summarization or analysis. Available models include Claude-3, GPT-4, and Gemini variants.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
		},
	},
	{
		'toolNamePath': 'applyPatch.tool',
		'metadata': {
			'name': 'apply_patch',
			'description':
				'Apply a unified diff format patch to one or more files. Supports both modifying existing files and creating new ones. Use for complex multi-line changes where context is important. For simpler changes, prefer search_and_replace. Patches must match file content closely, with a small fuzz factor for nearby lines.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'renameFiles.tool',
		'metadata': {
			'name': 'rename_files',
			'description':
				'Rename one or more files or directories within the project. Handles both single files and batch operations. Consider impact on imports and references. All paths must be relative to project root. Use createMissingDirectories for new path structures.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
	{
		'toolNamePath': 'rewriteFile.tool',
		'metadata': {
			'name': 'rewrite_file',
			'description':
				"Completely replaces an existing file's contents or creates a new file. Use with caution as this overwrites the entire file. Always check existing file contents before using this tool. For partial changes, prefer search_and_replace.",
			'version': '1.0.0',
			'category': 'FileManipulation',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
		},
	},
];
