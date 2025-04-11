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
				'Summarize and optionally truncate the current conversation. By default, stops after generating summary unless explicitly asked to continue with other tasks. Can be used both explicitly by user request or proactively by the LLM when the conversation becomes long. When truncating, preserves the most recent messages to maintain immediate context while reducing token usage. This helps maintain conversation effectiveness by staying within model context limits while keeping the most relevant recent interactions. The tool generates a summary of the conversation content to maintain awareness of earlier context even after truncation.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'enabled': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'moveFiles.tool',
		'metadata': {
			'name': 'move_files',
			'description':
				'Move one or more files or directories to a new location within the data source. Preserves file names while changing location. For renaming files, use rename_files instead. Consider impact on imports and references when moving files between directories. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'conversationMetrics.tool',
		'metadata': {
			'name': 'conversation_metrics',
			'description':
				'Analyze conversation metrics including turns, message types, token usage, tool usage patterns, file operations, and interaction quality. By default, stops after providing analysis unless explicitly asked to perform additional tasks. Use for understanding conversation efficiency, resource usage, and identifying improvement opportunities.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'searchProject.tool',
		'metadata': {
			'name': 'search_project',
			'description':
				"Search files across one or more data sources by content pattern (grep-style regex), file name pattern (glob), modification date, or file size. Important glob pattern notes:\n\n1. Directory Traversal:\n   * `**` matches zero or more directory levels\n   * ONLY use `**` between directory separators\n   * Cannot use `**` within a filename\n\n2. File Matching:\n   * `*` matches any characters within a filename or directory name\n   * Use `*` for matching parts of filenames\n\n3. Common Patterns:\n   * `docs/*` - files IN docs directory only\n   * `docs/**/*` - files in docs SUBDIRECTORIES only\n   * `docs/*|docs/**/*` - files in docs AND its subdirectories\n   * `src/*.ts|src/**/*.ts` - TypeScript files in src and subdirectories\n   * `**/*.test.ts` - test files at any depth\n\n4. Pattern Components:\n   * `**/dir/*` - files in any 'dir' directory\n   * `path/to/**/file.ts` - specific file at any depth\n   * `**/*util*.ts` - files containing 'util' at any depth\n\nUse search_project for unknown file paths. For known paths, use load_resources instead. When no data source is specified, operates on the primary data source.",
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'examples': [
				{
					'description': 'Find all TypeScript files in the docs directory (not subdirectories)',
					'input': {
						'filePattern': 'docs/*.ts',
					},
				},
				{
					'description': 'Find all files in docs directory AND its subdirectories',
					'input': {
						'filePattern': 'docs/*|docs/**/*',
					},
				},
				{
					'description': "Find TypeScript files containing 'util' in their name at any depth",
					'input': {
						'filePattern': '**/*util*.ts',
					},
				},
			],
			'protocolType': 'bb',
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
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'loadResources.tool',
		'metadata': {
			'name': 'load_resources',
			'description':
				'Request one or more resources from one data source to be added to the conversation. Resources are specified using information returned from a previous load_datasource call. For discovering available resources, use load_datasource first. Always review resource contents before making suggestions or changes. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'imageManipulation.tool',
		'metadata': {
			'name': 'image_manipulation',
			'description':
				'Manipulate image files for one data source with various operations like resize, crop, rotate, flip, blur, sharpen, grayscale, format conversion, and quality adjustment. Supports both local files and remote URLs as input sources. The processed image is saved to the specified output path. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'category': 'file',
			'enabled': true,
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
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
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'searchAndReplace.tool',
		'metadata': {
			'name': 'search_and_replace',
			'description':
				'Apply a list of search and replace operations to a file for one data source. Each operation can use exact literal text matching (preserving whitespace) or regex patterns. For exact matches, whitespace and indentation must match the source file exactly. For regex patterns, use the regexPattern option. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'forgetResources.tool',
		'metadata': {
			'name': 'forget_resources',
			'description':
				'Remove resources from the conversation context to reduce token usage. When prompt caching is enabled, resources remain in the cached context but should be mentally excluded. When prompt caching is disabled, resources are actively removed from the context. Use this to manage conversation scope and reduce cognitive load.',
			'version': '1.0.0',
			'category': 'ResourceManipulation',
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'displayResource.tool',
		'metadata': {
			'name': 'display_resource',
			'description':
				'Display the contents of a resource to the user while returning only metadata to the AI assistant. IMPORTANT: Do not use this tool to return resource contents to the AI assistant; instead use the request_resource tool.\n\nThe tool will show the user the resource contents with appropriate formatting (syntax highlighting for text resources, proper rendering for images) but the AI will only receive metadata like resource size, type, and last modified date. This separation ensures user privacy while allowing the AI to track resource states and metadata.  The tool will:\n1. Read and display the resource contents to the user, based on type:\n   * Text resources: Displayed with syntax highlighting when possible\n   * Images: Displayed inline with appropriate sizing\n   * Other formats: Shows metadata and format information\n\n2. Size Limits:\n   * Text resources: 1MB display limit, 10MB hard limit\n   * Images: 5MB display limit, 20MB hard limit\n   * Resources exceeding limits show truncated content or error\n\n3. Format Support:\n   * Text: All text formats including code and markdown\n   * Images: All browser-supported formats (PNG, JPEG, GIF, etc.)\n   * Other: Basic metadata display',
			'version': '1.0.0',
			'category': 'resource',
			'enabled': true,
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'searchAndReplaceMultilineCode.tool',
		'metadata': {
			'name': 'search_and_replace_multiline_code',
			'description':
				'Apply a list of search and replace operations to a file for one data source, supporting multiline code. When no data source is specified, operates on the primary data source.',
			'enabled': false,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
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
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'mcp.tool',
		'metadata': {
			'name': 'mcp',
			'description': 'Executes tools using Model Context Protocol',
			'version': '1.0.0',
			'enabled': false,
			'author': 'BB Team',
			'license': 'MIT',
			'category': 'integration',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'runCommand.tool',
		'metadata': {
			'name': 'run_command',
			'description':
				"Run a system command for one data source from the user-configured allow list and return the output. For security, only commands explicitly added to the allow list can be executed. Users can configure any shell commands they wish to permit. If you need a command that isn't in the allowed list, suggest that the user add it to their configuration. Commands may output to both stdout and stderr; stderr doesn't always indicate an error. Commands can be run from a specific working directory relative to the project root, which affects how relative paths in arguments are resolved. If no working directory is specified, commands run from the project root. The tool supports output truncation through the outputTruncation parameter, allowing you to keep specified numbers of lines from the beginning (head) and/or end (tail) of both stdout and stderr outputs. When truncation occurs, the response includes truncatedInfo detailing how many lines were kept from the original output. When no data source is specified, operates on the primary data source.",
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'config': {
				'allowedCommands': [
					'ls',
					'cd',
					'pwd',
					'cat',
					'find',
					'grep',
					'tree',
					'head',
					'tail',
					'which',
					'whereis',
					'env',
				],
			},
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'loadDataSource.tool',
		'metadata': {
			'name': 'load_datasource',
			'description':
				'Retrieves a list of available resources for a datasource. The available datasources are in the system prompt of each conversation.',
			'version': '1.0.0',
			'category': 'data-retrieval',
			'capabilities': [
				'resource-listing',
				'data-browsing',
			],
			'enabled': true,
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'delegateTasks.tool',
		'metadata': {
			'name': 'delegate_tasks',
			'description': 'Delegate specialized tasks to child agent conversations.',
			'enabled': true,
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
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
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'removeFiles.tool',
		'metadata': {
			'name': 'remove_files',
			'description':
				'Remove files from the data source, either by moving them to a trash directory or permanently deleting them. Includes safety features like protected paths and acknowledgement for permanent deletion. Use with caution as permanent deletion cannot be undone. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'applyPatch.tool',
		'metadata': {
			'name': 'apply_patch',
			'description':
				'Apply a unified diff format patch to one or more files for one data source. Supports both modifying existing files and creating new ones. Use for complex multi-line changes where context is important. For simpler changes, prefer search_and_replace. Patches must match file content closely, with a small fuzz factor for nearby lines. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'renameFiles.tool',
		'metadata': {
			'name': 'rename_files',
			'description':
				'Rename one or more files or directories within the data source. Handles both single files and batch operations. Consider impact on imports and references. All paths must be relative to data source root. Use createMissingDirectories for new path structures. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'rewriteFile.tool',
		'metadata': {
			'name': 'rewrite_file',
			'description':
				'Completely replaces an existing file\'s contents or creates a new file for one data source. Use with caution as this overwrites the entire file. Always check existing file contents before using this tool. For partial changes, prefer search_and_replace.\nIMPORTANT:\n- Must provide complete file content including ALL imports, types, and code\n- Never use placeholder comments like "// Previous code remains..."\n- Never assume code exists outside what is provided in content\n- Cannot preserve any existing code that isn\'t explicitly included in content\n- Will completely delete and replace the entire file\nFor modifying specific parts of a file, use search_and_replace instead.\nDANGER: Completely replaces file contents.\nREQUIRED STEPS:\n1. Use load_resources to show current content\n2. In <thinking> tags show:\n   - Diff/comparison with planned changes\n   - Justification for complete rewrite\n3. If skipping steps 1-2, tool will fail.\n\nWhen no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'category': 'FileManipulation',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
];
