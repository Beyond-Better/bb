/**
 * FilesystemProvider class for BB-managed filesystem data sources.
 */
import { logger } from 'shared/logger.ts';
import { BBDataSourceProvider } from '../base/bbDataSourceProvider.ts';
import { FilesystemAccessor } from './filesystemAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import type {
	DataSourceCapability,
	DataSourceEditCapability,
	DataSourceLoadCapability,
	DataSourceProviderStructuredQuerySchema,
	DataSourceSearchCapability,
} from 'shared/types/dataSource.ts';
import type { AcceptedContentType, AcceptedEditType, ContentTypeGuidance } from 'shared/types/dataSource.ts';
import {
	generateBinaryContentWritingInstructions,
	generatePlainTextWritingInstructions,
	generateSearchReplaceInstructions,
	generateWorkflowInstructions,
} from 'api/utils/datasourceInstructions.ts';
import type { InstructionFilters } from 'api/types/instructionFilters.ts';

/**
 * FilesystemProvider for BB-managed filesystem data sources
 * Extends BBDataSourceProvider to provide filesystem-specific functionality
 */
export class FilesystemProvider extends BBDataSourceProvider {
	/**
	 * Content types this provider accepts
	 */
	public readonly acceptedContentTypes: AcceptedContentType[] = ['plainTextContent', 'binaryContent'];

	/**
	 * Edit approaches this provider supports
	 */
	public readonly acceptedEditTypes: AcceptedEditType[] = ['searchReplace'];

	/**
	 * Preferred content type for filesystem operations
	 */
	public readonly preferredContentType: AcceptedContentType = 'plainTextContent';

	public capabilities: DataSourceCapability[] = [
		'read',
		'write',
		'list',
		'search',
		'move',
		'delete',
	];
	public loadCapabilities: DataSourceLoadCapability[] = [
		'plainText',
		//'structured',
		//'both',
	];
	public editCapabilities: DataSourceEditCapability[] = [
		'searchReplaceOperations',
		//'rangeOperations',
		//'blockOperations',
		//'textFormatting', // Plain text only
		//'paragraphFormatting',
		//'tables',
		//'colors',
		//'fonts',
	];
	public searchCapabilities: DataSourceSearchCapability[] = [
		'textSearch',
		'regexSearch',
		'structuredQuerySearch',
	];

	public structuredQuerySchema: DataSourceProviderStructuredQuerySchema | undefined = {
		description: 'File search with filters',
		examples: [{
			description: 'Find TypeScript files modified this week containing TODO',
			query: {
				text: 'TODO',
				filters: {
					extension: '.ts',
					modifiedAfter: '2024-08-01',
					path: 'src/',
				},
			},
		}],
		schema: {
			type: 'object',
			properties: {
				text: { type: 'string' },
				filters: {
					type: 'object',
					properties: {
						extension: { type: 'string' },
						path: { type: 'string' },
						modifiedAfter: { type: 'string', format: 'date' },
						modifiedBefore: { type: 'string', format: 'date' },
						sizeMin: { type: 'number' },
						sizeMax: { type: 'number' },
					},
				},
			},
		},
	};

	/**
	 * Create a new FilesystemProvider instance
	 */
	constructor() {
		super(
			'filesystem', // Provider ID
			'Filesystem', // Human-readable name
			'Local filesystem access', // Description
			['dataSourceRoot'], // Required config fields
		);

		logger.debug('FilesystemProvider: Created filesystem provider');
	}

	/**
	 * Create a ResourceAccessor for a filesystem data source
	 * @param connection The connection to create an accessor for
	 * @returns A FilesystemAccessor instance
	 */
	createAccessor(connection: DataSourceConnection): ResourceAccessor {
		// Verify the connection is for this provider
		if (connection.providerType !== this.providerType) {
			throw new Error(
				`Connection provider ID mismatch: expected ${this.providerType}, got ${connection.providerType}`,
			);
		}

		// Create a new FilesystemAccessor
		return new FilesystemAccessor(connection);
	}

	/**
	 * Validate configuration for filesystem data source
	 * @param config The configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	override validateConfig(config: Record<string, unknown>): boolean {
		// First check using the base validation
		if (!super.validateConfig(config)) {
			return false;
		}

		// Check that dataSourceRoot is a string
		if (typeof config.dataSourceRoot !== 'string') {
			logger.warn(`FilesystemProvider: dataSourceRoot must be a string, got ${typeof config.dataSourceRoot}`);
			return false;
		}

		// Check that dataSourceRoot is not empty
		if (config.dataSourceRoot === '') {
			logger.warn('FilesystemProvider: dataSourceRoot cannot be empty');
			return false;
		}

		// Check that strictRoot is a boolean if present
		if (config.strictRoot !== undefined && typeof config.strictRoot !== 'boolean') {
			logger.warn(`FilesystemProvider: strictRoot must be a boolean, got ${typeof config.strictRoot}`);
			return false;
		}
		// Check that followSymlinks is a boolean if present
		if (config.followSymlinks !== undefined && typeof config.followSymlinks !== 'boolean') {
			logger.warn(`FilesystemProvider: followSymlinks must be a boolean, got ${typeof config.followSymlinks}`);
			return false;
		}

		// All checks passed
		return true;
	}

	/**
	 * Get detailed instructions for filesystem data source (both writing and editing)
	 * @param filters Optional filters to customize instruction content
	 * @returns Comprehensive instruction text with examples specific to filesystem capabilities
	 */
	getDetailedInstructions(filters?: InstructionFilters): string {
		// For backward compatibility, return full instructions if no filters provided
		// Filesystem provider primarily supports searchReplace, so filtering is minimal for now
		if (!filters) {
			return this.generateCompleteInstructions();
		}

		// Add minimal filtering support for utility operations
		if (filters.operations && (filters.operations.includes('utility') || filters.operations.includes('rename'))) {
			return this.generateUtilityInstructions();
		}

		// For filesystem provider, return full instructions for most cases
		// TODO: Implement more granular filtering based on contentTypes, operations, etc.
		return this.generateCompleteInstructions();
	}

	/**
	 * Generate complete instructions (backward compatibility)
	 */
	private generateCompleteInstructions(): string {
		const instructions = [
			`# Filesystem Complete Instructions\n`,
			`## Provider: ${this.name}\n`,
			`Filesystem supports both file creation and editing operations.\n`,
			`Choose the appropriate operation type based on your needs.\n\n`,

			`# 📝 CREATING NEW FILES\n\n`,
			generatePlainTextWritingInstructions(),
			'\n',
			generateBinaryContentWritingInstructions(),
			'\n',
			`## Filesystem File Creation Features\n\n`,
			`✅ **Text File Creation**: Create code, configuration, documentation files\n`,
			`✅ **Binary File Support**: Create images, documents, executables\n`,
			`✅ **Directory Creation**: Automatically creates missing parent directories\n`,
			`✅ **Path Safety**: All files constrained to configured data source root\n`,
			`✅ **Format Preservation**: Maintains exact formatting, whitespace, line endings\n\n`,
			`### File Creation Workflow\n\n`,
			`1. **Determine file type** (text or binary)\n`,
			`2. **Choose content format**:\n`,
			`   - Use **plainTextContent** for code, config, documentation, and text files\n`,
			`   - Use **binaryContent** for images, PDFs, executables, and binary files\n`,
			`3. **Provide complete file content** - no placeholders or partial content\n`,
			`4. **Use proper file paths** - relative to data source root\n`,
			`5. **Include correct file extensions** - affects MIME type detection\n\n`,
			`### Supported File Types\n\n`,
			`**Text Files (use plainTextContent):**\n`,
			`- **Code**: .ts, .js, .py, .java, .cpp, .rs, .go, .php\n`,
			`- **Configuration**: .json, .yaml, .toml, .env, .ini, .config\n`,
			`- **Documentation**: .md, .txt, .rst, .org\n`,
			`- **Web**: .html, .css, .xml, .svg\n`,
			`- **Data**: .csv, .tsv, .sql\n\n`,
			`**Binary Files (use binaryContent):**\n`,
			`- **Images**: .png, .jpg, .gif, .webp, .ico\n`,
			`- **Documents**: .pdf, .docx, .xlsx, .pptx\n`,
			`- **Archives**: .zip, .tar, .gz, .7z\n`,
			`- **Executables**: .exe, .app, .deb, .rpm\n\n`,

			`# ✏️ EDITING EXISTING FILES\n\n`,
			`Filesystem data sources support file-based operations with search and replace editing.\n`,
			`Operations work on individual files within the configured root directory.\n\n`,
			generateSearchReplaceInstructions(),
			'\n',
			`## Filesystem Editing Specific Notes\n\n`,
			`- **File-based Operations**: Each edit targets a specific file\n`,
			`- **Path Restrictions**: All paths must be within the configured data source root\n`,
			`- **Text Files Only**: Binary files cannot be edited (use write_resource to replace)\n`,
			`- **Exact Matching**: Search patterns must match file content exactly\n`,
			`- **Whitespace Sensitive**: Include all spaces, tabs, and newlines in search patterns\n`,
			`- **Regex Support**: Use searchReplace_regexPattern=true for complex patterns\n\n`,
			`### File Editing Workflow\n\n`,
			`1. **Always load the file first** to see current content\n`,
			`2. **Plan your changes** based on exact file content\n`,
			`3. **Use precise search patterns** matching whitespace exactly\n`,
			`4. **Apply search/replace operations** for text modifications\n\n`,

			`# 🔍 FINDING RESOURCES\n\n`,
			`Filesystem supports comprehensive resource discovery with advanced file system search capabilities.\n`,
			`The system provides powerful content and metadata search across the entire directory tree.\n\n`,
			`## Filesystem Search Capabilities\n\n`,
			`✅ **Directory Tree Search**: Recursive search through all subdirectories\n`,
			`✅ **Content Search**: Full-text search within file contents (grep-style)\n`,
			`✅ **Glob Pattern Support**: Advanced file name and path pattern matching\n`,
			`✅ **Regex Support**: Complete regex support for content and name patterns\n`,
			`✅ **Multi-file Type Support**: Searches across all text file types\n`,
			`✅ **Exclusion Handling**: Automatically excludes .git, node_modules, build artifacts\n\n`,
			`## Search Types and Patterns\n\n`,
			`**Content Pattern Search**: Searches within file contents using grep-compatible regex\n`,
			`**Resource Pattern Search**: Filters files by name/path using glob patterns\n`,
			`**Date/Size Filtering**: Filter by modification date, creation date, file size\n`,
			`**Extension Filtering**: Target specific file types with structured queries\n\n`,
			`### Search Examples\n\n`,
			`\`\`\`\n`,
			`# Find functions in TypeScript files\n`,
			`contentPattern: "function.*search"  # Regex pattern\n`,
			`resourcePattern: "**/*.ts"  # TypeScript files anywhere\n`,
			`regexPattern: true\n\n`,
			`# Find configuration files\n`,
			`resourcePattern: "**/config.*"  # Config files at any depth\n\n`,
			`# Find recent changes with TODO\n`,
			`contentPattern: "TODO|FIXME|BUG"  # Multiple patterns\n`,
			`dateAfter: "2024-08-01"\n`,
			`regexPattern: true\n\n`,
			`# Find large files by extension\n`,
			`structuredQuery: {\n`,
			`  "filters": {\n`,
			`    "extension": ".js",\n`,
			`    "sizeMin": 1048576  // > 1MB\n`,
			`  }\n`,
			`}\n`,
			`\`\`\`\n\n`,
			`### Advanced Glob Patterns\n\n`,
			`| Pattern | Matches | Example |\n`,
			`|---------|---------|---------|\n`,
			`| \`*.ts\` | TypeScript files in current dir | \`config.ts\` |\n`,
			`| \`**/*.ts\` | TypeScript files anywhere | \`src/utils/helper.ts\` |\n`,
			`| \`src/**/*.test.ts\` | Test files in src tree | \`src/components/Button.test.ts\` |\n`,
			`| \`**/config.*\` | Config files anywhere | \`config.json\`, \`app/config.yaml\` |\n`,
			`| \`{*.js,*.ts}\` | JavaScript or TypeScript | \`app.js\`, \`types.ts\` |\n\n`,
			`### Search Capabilities & Limitations\n\n`,
			`| Feature | Supported | Implementation |\n`,
			`|---------|-----------|---------------|\n`,
			`| File name/path search | ✅ | Native glob pattern matching |\n`,
			`| File content search | ✅ | Grep-style regex search |\n`,
			`| Date filtering | ✅ | File modification and creation time |\n`,
			`| Size filtering | ✅ | File size in bytes with min/max |\n`,
			`| Regex patterns | ✅ | Full JavaScript regex support |\n`,
			`| Content context | ✅ | Configurable context lines before/after |\n`,
			`| Case sensitivity | ✅ | Configurable for both content and names |\n`,
			`| Binary file handling | ⚠️ | Automatically excluded from content search |\n`,
			`| Gitignore respect | ✅ | Excludes ignored files automatically |\n`,
			`| Symlink handling | ✅ | Configurable symlink following |\n\n`,
			`### Result Detail Levels\n\n`,
			`- **resource**: File list with metadata only\n`,
			`- **container**: Files with directory structure information\n`,
			`- **fragment**: Files with content snippets showing matches\n`,
			`- **detailed**: Full context with configurable lines before/after matches\n\n`,
			`### Best Practices for File Discovery\n\n`,
			`1. **Use Specific Patterns**: Target exact file types and directories for better performance\n`,
			`2. **Combine Approaches**: Use both content and resource patterns for precise targeting\n`,
			`3. **Leverage Exclusions**: System automatically excludes .git, node_modules, build folders\n`,
			`4. **Size Awareness**: Use size filters to find large files or exclude them from content search\n`,
			`5. **Date Filtering**: Focus searches on recent changes or specific time periods\n`,
			`6. **Context Control**: Adjust contextLines to get appropriate surrounding content\n`,
			`7. **Performance**: Use specific patterns rather than broad searches for large codebases\n\n`,
			`### Performance Considerations\n\n`,
			`- **Content searches** scan file contents and can be slower for large repositories\n`,
			`- **Resource pattern searches** only check filenames and are much faster\n`,
			`- **Exclusion patterns** significantly improve performance by skipping irrelevant files\n`,
			`- **Binary files** are automatically excluded from content searches\n`,
			`- **Large files** (>10MB) may cause timeouts in content searches\n\n`,
			`# 🔄 GENERAL WORKFLOW\n\n`,
			generateWorkflowInstructions(),
			'\n',
			`## Filesystem Best Practices\n\n`,
			`✅ **For new files**: Choose appropriate content type (plain text vs binary)\n`,
			`✅ **For code files**: Use plainTextContent with proper formatting and line counts\n`,
			`✅ **For existing files**: Load first to see current content structure\n`,
			`✅ **For text changes**: Use search/replace with exact pattern matching\n`,
			`✅ **For binary files**: Use write_resource to replace entire file\n`,
			`✅ **For safety**: All operations are constrained to data source root\n\n`,
		].join('');

		return instructions;
	}

	/**
	 * Generate utility operation instructions (rename, move, remove)
	 */
	private generateUtilityInstructions(): string {
		const instructions = [
			`# Filesystem Utility Operations Instructions\n`,
			`## Provider: ${this.name}\n`,
			`Filesystem supports rename, move, and remove operations with standard path formats.\n\n`,
			`# 🔄 RENAMING RESOURCES\n\n`,
			`Filesystem supports straightforward renaming of files and directories.\n`,
			`All paths use standard relative filesystem paths from the data source root.\n\n`,
			`## Path Format Requirements\n\n`,
			`📁 **FILESYSTEM PATH FORMAT**:\n`,
			`- ✅ **Files**: "src/config.ts", "tests/helper.test.ts"\n`,
			`- ✅ **Directories**: "src/utils", "docs/api"\n`,
			`- ✅ **Nested paths**: "project/src/components/Button.tsx"\n`,
			`- ✅ **Extensions**: Always include file extensions (.ts, .js, .md, etc.)\n\n`,
			`🔒 **PATH SECURITY**:\n`,
			`- All paths must be relative to data source root\n`,
			`- Cannot access files outside the configured directory\n`,
			`- Parent directory traversal (..) is not allowed\n\n`,
			`## Rename Examples\n\n`,
			`\`\`\`json\n`,
			`// Single file rename\n`,
			`{\n`,
			`  "operations": [{\n`,
			`    "source": "src/oldFile.ts",\n`,
			`    "destination": "src/newFile.ts"\n`,
			`  }]\n`,
			`}\n\n`,
			`// Directory rename\n`,
			`{\n`,
			`  "operations": [{\n`,
			`    "source": "old-utils",\n`,
			`    "destination": "utils"\n`,
			`  }]\n`,
			`}\n`,
			`\`\`\`\n\n`,
			`## Safety Features\n\n`,
			`✅ **Overwrite Protection**: Set overwrite=false by default\n`,
			`✅ **Directory Creation**: Set createMissingDirectories=true to create parent dirs\n`,
			`✅ **Path Validation**: All paths validated against data source root\n`,
			`✅ **Atomic Operations**: All rename operations complete or fail together\n\n`,
			`## Common Issues & Solutions\n\n`,
			`🔴 **"File not found" Errors**:\n`,
			`- Source path doesn't exist or is outside data source root\n`,
			`- Use \`find_resources\` to locate the correct file path\n`,
			`- Verify path is relative to data source root, not absolute\n\n`,
			`🔴 **"Permission denied" Errors**:\n`,
			`- File or directory permissions prevent filesystem operations\n`,
			`- Check that BB has read/write access to the filesystem location\n`,
			`- Ensure destination directory has write permissions\n\n`,
			`🔴 **"Path outside data source" Errors**:\n`,
			`- Attempted to access files outside the configured root directory\n`,
			`- Use relative paths only (e.g., "src/file.ts" not "/usr/src/file.ts")\n`,
			`- Cannot use .. to traverse parent directories\n\n`,
			`# 📦 MOVING RESOURCES\n\n`,
			`Move operations relocate files/directories to different locations within the data source.\n`,
			`Use standard filesystem paths for both source and destination.\n\n`,
			`# 🗑️ REMOVING RESOURCES\n\n`,
			`Remove operations delete files and directories from the filesystem.\n`,
			`Use standard filesystem paths for resources to delete.\n\n`,
			`⚠️ **CRITICAL**: Filesystem deletions are permanent - no trash/undo functionality.\n\n`,
			`# 💡 BEST PRACTICES\n\n`,
			`1. **Always load resources first** using find_resources to verify paths\n`,
			`2. **Use relative paths** from data source root (never absolute paths)\n`,
			`3. **Include file extensions** in all file paths for clarity\n`,
			`4. **Check for references** - update imports/requires after moving files\n`,
			`5. **Batch related operations** to maintain consistency\n\n`,
		].join('');

		return instructions;
	}

	/**
	 * Get content type guidance for filesystem data source
	 * @returns ContentTypeGuidance with filesystem-specific examples and constraints
	 */
	getContentTypeGuidance(): ContentTypeGuidance {
		return {
			primaryContentType: 'plain-text',
			acceptedContentTypes: this.acceptedContentTypes,
			acceptedEditTypes: this.acceptedEditTypes,
			preferredContentType: this.preferredContentType,
			capabilities: this.capabilities,
			loadCapabilities: this.loadCapabilities,
			editCapabilities: this.editCapabilities,
			searchCapabilities: this.searchCapabilities,
			structuredQuerySchema: this.structuredQuerySchema,
			examples: [
				{
					description: 'Create a new TypeScript file with plain text content',
					toolCall: {
						tool: 'write_resource',
						input: {
							resourcePath: 'src/newFile.ts',
							plainTextContent: {
								content: 'export const config = {\n  apiUrl: "https://api.example.com"\n};',
								expectedLineCount: 3,
								acknowledgement:
									'See write_resource input schema for exact acknowledgement requirements',
							},
						},
					},
				},
				{
					description: 'Edit existing file using search and replace',
					toolCall: {
						tool: 'edit_resource',
						input: {
							resourcePath: 'src/config.ts',
							operations: [
								{
									editType: 'searchReplace',
									searchReplace_search: 'localhost',
									searchReplace_replace: 'production.example.com',
									searchReplace_replaceAll: true,
								},
							],
						},
					},
				},
				{
					description: 'Create binary file (image, document, etc.)',
					toolCall: {
						tool: 'write_resource',
						input: {
							resourcePath: 'assets/icon.png',
							binaryContent: {
								data:
									'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
								mimeType: 'image/png',
							},
						},
					},
				},
			],
			notes: [
				'Filesystem data sources work with individual files and directories',
				'Plain text content is preferred for code, configuration, and documentation files',
				'Binary content is supported for images, PDFs, and other non-text files',
				'Search and replace operations work on multi-line string content with optional regex support',
				'All file operations are constrained to the configured data source root directory',
			],
		};
	}

	/**
	 * Get filesystem-specific error guidance for LLM tool usage
	 * Provides enhanced error messaging focused on path and permission issues
	 */
	override getErrorGuidance(
		errorType:
			| 'not_found'
			| 'permission_denied'
			| 'invalid_format'
			| 'workflow_violation'
			| 'configuration'
			| 'unknown',
		operation: string,
		hasLoadedInstructions: boolean = false,
	): { message: string; type: 'workflow' | 'instructions' | 'configuration' | 'format' } {
		// Base instruction reminder
		const instructionsReminder = hasLoadedInstructions
			? "💡 Review the filesystem datasource instructions you've loaded, especially the workflow sections."
			: "🔍 **Load filesystem datasource instructions first**: Use `loadDatasource` with `returnType='instructions'` to get detailed filesystem workflows and requirements.";

		// Filesystem-specific guidance based on error type
		switch (errorType) {
			case 'not_found':
				return {
					message:
						`${instructionsReminder}\n\n📋 **Filesystem resource not found**: This typically indicates:\n- File or directory doesn't exist at the specified path\n- Path is outside the configured data source root directory\n- **Recommendation**: Use \`find_resources\` to search for the file or verify the correct path`,
					type: 'workflow',
				};

			case 'permission_denied':
				return {
					message:
						`${instructionsReminder}\n\n🔐 **Filesystem access denied**: This usually means:\n- File or directory permissions don't allow ${operation} access\n- Path is outside the configured data source root (security restriction)\n- **Check**: Verify the path is within the data source root and has appropriate file permissions`,
					type: 'configuration',
				};

			case 'invalid_format':
				return {
					message:
						`${instructionsReminder}\n\n⚠️ **Filesystem format issue**: For filesystem operations:\n- Use plainTextContent for text files (code, config, docs)\n- Use binaryContent for images, PDFs, executables\n- **Note**: Binary files cannot be edited - use \`write_resource\` to replace them`,
					type: 'format',
				};

			case 'workflow_violation':
				return {
					message:
						`${instructionsReminder}\n\n⚠️ **Filesystem workflow issue**: Common problems:\n- **For editing**: Load the file first to see current content, then use exact search patterns\n- **For new files**: Ensure parent directories exist or set \`createMissingDirectories=true\`\n- **Path format**: Use relative paths from data source root (e.g., "src/file.ts")`,
					type: 'workflow',
				};

			case 'configuration':
				return {
					message:
						`${instructionsReminder}\n\n⚙️ **Filesystem configuration issue**: Check:\n- Data source root directory is correctly configured and accessible\n- \`strictRoot\` and \`followSymlinks\` settings are appropriate\n- File system permissions allow BB to access the directory`,
					type: 'configuration',
				};

			default:
				return {
					message:
						`${instructionsReminder}\n\n🔧 **Filesystem ${operation} operation failed**: Filesystem operations are straightforward:\n- **Files must be within the data source root** (security boundary)\n- **Load files first** to see current content before editing\n- **Use exact search patterns** for text file modifications`,
					type: 'workflow',
				};
		}
	}

	/**
	 * Create a filesystem data source with the specified configuration
	 * @param name Human-readable name for the data source
	 * @param rootPath The filesystem root path
	 * @param options Additional options
	 * @returns A new DataSourceConnection for a filesystem data source
	 */
	static createFileSystemDataSource(
		name: string,
		rootPath: string,
		registry: DataSourceRegistry,
		options: {
			id?: string;
			enabled?: boolean;
			isPrimary?: boolean;
			priority?: number;
			strictRoot?: number;
			followSymlinks?: number;
			projectConfig?: ProjectConfig;
		} = {},
	): DataSourceConnection {
		const provider = registry.getProvider('filesystem', 'bb');
		if (!provider) throw new Error('Could not load provider');
		//logger.info('FilesystemProvider: Using provider', { provider });
		return registry.createConnection(
			provider,
			name,
			{
				dataSourceRoot: rootPath,
				strictRoot: options.strictRoot ?? true,
				followSymlinks: options.followSymlinks ?? true,
			},
			options,
		);
	}
}
