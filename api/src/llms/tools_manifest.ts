// This file is auto-generated. Do not edit manually.
import type { ToolMetadata } from './llmToolManager.ts';

interface CoreTool {
	toolNamePath: string;
	metadata: ToolMetadata;
}

export const CORE_TOOLS: Array<CoreTool> = [
	{
		'toolNamePath': 'fetchWebScreenshot.tool',
		'metadata': {
			'name': 'fetch_web_screenshot',
			'description':
				'Captures screenshots using a full headless browser for complete page rendering including JavaScript, CSS animations, and dynamic content. Returns visual representation of the rendered page. Use this when you need to see how content appears visually (e.g., GitHub repository pages, web apps, dashboards). For static image files or direct downloads, use download_resource instead. For text content extraction, use fetch_web_page.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'enabled': true,
			'category': 'data-retrieval',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'moveResources.tool',
		'metadata': {
			'name': 'move_resources',
			'description':
				'Move one or more resources to a new location within the data source. Preserves resource names while changing location. For renaming resources, use rename_resources instead. Consider impact on imports and references when moving resources between directories or paths. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'findResources.tool',
		'metadata': {
			'name': 'find_resources',
			'description':
				"Find resources across one or more data sources by content pattern (grep-style regex), resource name pattern (glob), modification date, or resource size. \n\n**SEARCH MODES:**\n\n1. **Metadata Search** (default): Returns resource URLs only, not resource content; use load_resource for resource content.\n\n2. **Content Search with Context**: When `contentPattern` is provided with `contextLines` or `maxMatchesPerFile`, returns enhanced results showing:\n   * Exact line numbers where matches occur\n   * Matching line content\n   * Configurable context lines before/after each match\n   * Character positions of matches within lines\n   * Limited number of matches per file for focused results\n\n**IMPORTANT GLOB PATTERN NOTES:**\n\n1. Directory Traversal:\n   * `**` matches zero or more directory levels\n   * ONLY use `**` between directory separators\n   * Cannot use `**` within a filename\n\n2. Resource Matching:\n   * `*` matches any characters within a filename or directory name\n   * Use `*` for matching parts of filenames\n\n3. Common Patterns:\n   * `docs/*` - files IN docs directory only\n   * `docs/**/*` - files in docs SUBDIRECTORIES only\n   * `docs/*|docs/**/*` - files in docs AND its subdirectories\n   * `src/*.ts|src/**/*.ts` - TypeScript files in src and subdirectories\n   * `**/*.test.ts` - test files at any depth\n\n4. Pattern Components:\n   * `**/dir/*` - files in any 'dir' directory\n   * `path/to/**/file.ts` - specific file at any depth\n   * `**/*util*.ts` - files containing 'util' at any depth\n\n**CONTENT SEARCH PARAMETERS:**\n\n* `contextLines` (0-25): Number of lines to show before/after each match\n* `maxMatchesPerFile` (1-20): Maximum matches to return per file\n* `caseSensitive`: Controls case sensitivity of content pattern matching\n\nUse find_resources for unknown file paths. For known paths, use load_resources instead. When no data source is specified, operates on the primary data source.",
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'examples': [
				{
					'description': 'Find all TypeScript files in the docs directory (not subdirectories)',
					'input': {
						'resourcePattern': 'docs/*.ts',
					},
				},
				{
					'description': 'Find all files in docs directory AND its subdirectories',
					'input': {
						'resourcePattern': 'docs/*|docs/**/*',
					},
				},
				{
					'description': "Find TypeScript files containing 'util' in their name at any depth",
					'input': {
						'resourcePattern': '**/*util*.ts',
					},
				},
			],
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'writeResource.tool',
		'metadata': {
			'name': 'write_resource',
			'version': '1.0.0',
			'description':
				'Create new or rewrite existing resources with content-type-aware input handling. For filesystem data sources, use plainTextContent or binaryContent. For structured content data sources like Notion, use structuredContent. The tool validates content type compatibility with the target data source and provides clear error messages for mismatches.',
			'author': 'BB Core',
			'license': 'MIT',
			'toolSets': [
				'core',
			],
			'enabled': true,
			'mutates': true,
			'category': [
				'file_management',
				'content_creation',
			],
			'capabilities': [
				'create',
				'write',
				'overwrite',
			],
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'loadResources.tool',
		'metadata': {
			'name': 'load_resources',
			'description':
				'Load resources using information returned from a previous load_datasource call. Always review resource contents before making suggestions or changes. When no data source is specified, operates on the primary data source.\n\nIMPORTANT: Use load_datasource to learn about the resources available and their format before using the load_resources tool.\n\nTwo modes are supported based on the data source\'s capability:\n\n1. TEMPLATE MODE (set mode: \'template\'):\n   - Used when load_datasource returns URI templates\n   - Specify uriTemplate parameter if multiple templates are available\n   - Provide templateResources matching the template variables\n   \n   Examples:\n   \n   For a file system with template \'filesystem-local:./{path}\':\n   {\n     "mode": "template",\n     "uriTemplate": "filesystem-local:./{path}",\n     "templateResources": [\n       { "path": "src/config.ts" },\n       { "path": "tests/config.test.ts" }\n     ]\n   }\n   \n   For a database with template \'mcp-supabase://{schema}{?query}\':\n   {\n     "mode": "template",\n     "uriTemplate": "mcp-supabase://{schema}{?query}",\n     "templateResources": [\n       { "schema": "public", "query": "SELECT * FROM users LIMIT 10" },\n       { "schema": "auth", "query": "SELECT * FROM users WHERE role=\'admin\'" }\n     ]\n   }\n   \n   For an API with template \'api-service://{service}/{endpoint}{.format}\':\n   {\n     "mode": "template",\n     "uriTemplate": "api-service://{service}/{endpoint}{.format}",\n     "templateResources": [\n       { "service": "auth", "endpoint": "users", "format": "json" },\n       { "service": "data", "endpoint": "metrics", "format": "csv" }\n     ]\n   }\n\n2. DIRECT MODE (set mode: \'direct\'):\n   - Used when load_datasource returns complete resource URIs\n   - Provide directUris exactly as returned by load_datasource\n   \n   Examples:\n   \n   For a collection of files:\n   {\n     "mode": "direct",\n     "directUris": [\n       "filesystem-local:./src/config.ts", \n       "filesystem-local:./package.json"\n     ]\n   }\n   \n   For mixed resource types:\n   {\n     "mode": "direct",\n     "directUris": [\n       "mcp-supabase://public?query=SELECT%20*%20FROM%20users",\n       "api-service://auth/users.json",\n       "filesystem-local:./config/database.yml"\n     ]\n   }\n\n## Use relative paths for filesystem data sources.\n\n# CORRECT filesystem URIs:\nfilesystem-local:./path/to/file.ts\nfilesystem-local:./project/site/routes/_middleware.ts\nfilesystem-local:./docs/readme.md\n\n# When using the template pattern:\nuriTemplate: "filesystem-local:./{path}"\ntemplateResources: [{ "path": "project/site/routes/_middleware.ts" }]\n\n# INCORRECT - Using web URI format with double slash:\nfilesystem-local://path/to/file.ts        ❌ Will try to access absolute path /path/to/file.ts\nfilesystem-local://project/site/file.ts   ❌ Will fail with "File not found: /project/site/file.ts"\n\n# INCORRECT - Missing the dot in relative path:\nfilesystem-local:/path/to/file.ts         ❌ Missing the dot for relative paths\nfilesystem-local:/project/site/file.ts    ❌ Will also be treated as absolute\n\n### Understanding Path Errors\n\nWhen you see errors like:\n"Failed to load resource: File not found: /site/routes/_middleware.ts"\n\nNote the leading slash (/) indicates the system is trying to use an absolute path \nfrom the root directory. This typically means your URI format is incorrect.\n\nCorrect: filesystem-local:./project/site/routes/_middleware.ts\nIncorrect: filesystem-local://project/site/routes/_middleware.ts\n\n\nAlways use load_datasource first to discover available resources and their URI formats.\nThen use this tool to request specific resources to be added to the conversation.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'rewriteResource.tool',
		'metadata': {
			'name': 'rewrite_resource',
			'description':
				'[LEGACY] Use write_resource with overwriteExisting=true instead. Completely replaces an existing resource\'s contents or creates a new resource for one data source. Use with caution as this overwrites the entire resource. Always check existing resource contents before using this tool. For partial changes, prefer search_and_replace.\nIMPORTANT:\n- Must provide complete resource content including ALL imports, types, and code\n- Never use placeholder comments like "// Previous code remains..."\n- Never assume code exists outside what is provided in content\n- Cannot preserve any existing code that isn\'t explicitly included in content\n- Will completely delete and replace the entire resource\nFor modifying specific parts of a resource, use search_and_replace instead.\nDANGER: Completely replaces resource contents.\nREQUIRED STEPS:\n1. Use load_resources to show current content\n2. In <thinking> tags show:\n   - Diff/comparison with planned changes\n   - Justification for complete rewrite\n3. If skipping steps 1-2, tool will fail.\n\nWhen no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'category': [
				'deprecated',
			],
			'author': 'BB Team',
			'license': 'MIT',
			'toolSets': [
				'legacy',
			],
			'enabled': true,
			'deprecated': true,
			'replacedBy': 'write_resource',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'removeResources.tool',
		'metadata': {
			'name': 'remove_resources',
			'description':
				'Remove resources from the data source, either by moving them to a trash directory or permanently deleting them. Includes safety features like protected paths and acknowledgement for permanent deletion. Use with caution as permanent deletion cannot be undone. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'imageManipulation.tool',
		'metadata': {
			'name': 'image_manipulation',
			'description':
				'Manipulate image files for one data source with various operations like resize, crop, rotate, flip, blur, sharpen, grayscale, format conversion, and quality adjustment. Supports both data source resources and remote URLs as input sources. The processed image is saved to the specified output path. When no data source is specified, operates on the primary data source.',
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
				'Fetches web page content using a full headless browser for complete content hydration including JavaScript, dynamic loading, and complex authentication flows. Returns clean text content with scripts and styles removed. Use this when pages require browser context (e.g., GitHub pages, SPAs, dynamic content). For static resources, direct API calls, or raw files, use download_resource instead. For visual content, use fetch_web_screenshot.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'enabled': true,
			'category': 'data-retrieval',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'searchAndReplace.tool',
		'metadata': {
			'name': 'search_and_replace',
			'description':
				'[LEGACY] Use edit_resource with searchAndReplaceEdits instead. Apply a list of search and replace operations to a resource for one data source. Each operation can use exact literal text matching (preserving whitespace) or regex patterns. For exact matches, whitespace and indentation must match the source resource exactly. For regex patterns, use the regexPattern option. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'toolSets': [
				'legacy',
			],
			'enabled': true,
			'deprecated': true,
			'replacedBy': 'edit_resource',
			'category': [
				'deprecated',
			],
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
		'toolNamePath': 'blockEdit.tool',
		'metadata': {
			'name': 'block_edit',
			'description':
				'[LEGACY] Use edit_resource with blockEdits instead. Apply Portable Text operations to edit document blocks in supported data sources. Supports update, insert, delete, and move operations on structured document content. Designed for document-based systems like Notion that use block-based content representation.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'toolSets': [
				'legacy',
			],
			'enabled': true,
			'deprecated': true,
			'replacedBy': 'edit_resource',
			'category': [
				'deprecated',
			],
			'mutates': true,
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
		'toolNamePath': 'renameResources.tool',
		'metadata': {
			'name': 'rename_resources',
			'description':
				'Rename one or more resources within the data source. Handles both single resources and batch operations. Consider impact on imports and references. All paths must be relative to data source root. Use createMissingDirectories for new path structures. When no data source is specified, operates on the primary data source.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
			'mutates': true,
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
		'toolNamePath': 'editResource.tool',
		'metadata': {
			'name': 'edit_resource',
			'version': '1.0.0',
			'description':
				'Edit existing resources with multiple editing approaches and content-type awareness. Consolidates search-and-replace, block editing, and structured data editing capabilities.',
			'author': 'BB Core',
			'license': 'MIT',
			'toolSets': [
				'core',
			],
			'enabled': true,
			'mutates': true,
			'category': [
				'file_management',
				'content_editing',
			],
			'capabilities': [
				'edit',
				'search',
				'replace',
				'block_edit',
				'structured_data',
			],
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'interactionMetrics.tool',
		'metadata': {
			'name': 'interaction_metrics',
			'description':
				'Analyze conversation metrics including turns, message types, token usage, tool usage patterns, file operations, and interaction quality. By default, stops after providing analysis unless explicitly asked to perform additional tasks. Use for understanding conversation efficiency, resource usage, and identifying improvement opportunities.',
			'version': '1.0.0',
			'author': 'BB Team',
			'license': 'MIT',
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
		'toolNamePath': 'interactionSummary.tool',
		'metadata': {
			'name': 'interaction_summary',
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
		'toolNamePath': 'loadDataSource.tool',
		'metadata': {
			'name': 'load_datasource',
			'description':
				'Retrieves metadata and a list of available resources for a datasource. The available datasources are in the system prompt of each conversation.',
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
		'toolNamePath': 'downloadResource.tool',
		'metadata': {
			'name': 'download_resource',
			'description':
				'Download resources using direct HTTP requests (like curl) and save to data sources. Use for static resources, API endpoints, raw files, or when you need custom authentication/headers. Does NOT use a browser - no JavaScript execution or dynamic content loading. For pages requiring browser context (GitHub pages, SPAs, dynamic content), use fetch_web_page or fetch_web_screenshot instead. Supports all HTTP methods, authentication, and saves directly to datasources.',
			'version': '1.0.0',
			'enabled': true,
			'category': 'data-retrieval',
			'capabilities': [
				'resource-download',
			],
			'author': 'BB Team',
			'license': 'MIT',
			'protocolType': 'bb',
		},
	},
	{
		'toolNamePath': 'searchWeb.tool',
		'metadata': {
			'name': 'search_web',
			'description':
				'Searches the web using the Brave Search API. Returns comprehensive search results including web pages, news articles, videos, locations, discussions, and knowledge panels. Supports advanced search parameters and filtering options. Can use either user-provided API keys or the proxied service for seamless operation.',
			'version': '1.0.0',
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
];
