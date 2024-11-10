# BB Tools Documentation

This document provides a comprehensive overview of the tools available in BB, including their purposes, parameters, use cases, and best practices.

## Table of Contents

1. [File Discovery and Access](#file-discovery-and-access)
2. [File Modification Tools](#file-modification-tools)
3. [File Organization Tools](#file-organization-tools)
4. [Web Interaction Tools](#web-interaction-tools)
5. [Analysis Tools](#analysis-tools)
6. [Context Management](#context-management)
7. [Best Practices](#best-practices)
8. [Tool Selection Guidelines](#tool-selection-guidelines)

## File Discovery and Access

### search_project

Discover files in the project using various search criteria.

**Description**: Search project files by content pattern (grep-style regex), file name pattern (glob), modification date, or file size.

**Parameters**:
- `contentPattern` (string, optional): Grep-compatible regex for content search
- `caseSensitive` (boolean, default: false): Controls case sensitivity
- `filePattern` (string, optional): Glob pattern(s) for file names
- `dateAfter` (string, optional): Include files modified after date (YYYY-MM-DD)
- `dateBefore` (string, optional): Include files modified before date (YYYY-MM-DD)
- `sizeMin` (number, optional): Minimum file size in bytes
- `sizeMax` (number, optional): Maximum file size in bytes

**Use Cases**:
- Finding files containing specific code patterns
- Locating recently modified files
- Discovering files by name patterns
- Finding files within size ranges

**Examples**:
```typescript
// Find TypeScript files containing "function"
{
  contentPattern: "function.*search",
  filePattern: "*.ts",
  caseSensitive: false
}

// Find recently modified test files
{
  filePattern: "**/*.test.ts",
  dateAfter: "2024-01-01"
}
```

### request_files

Add specific files to the conversation context.

**Description**: Request one or more files to be added to the conversation. Use when exact file paths are known.

**Parameters**:
- `fileNames` (string[]): Array of file paths relative to project root

**Use Cases**:
- Loading known files for review
- Adding multiple related files together
- Including test files with source files
- Loading configuration files

**Examples**:
```typescript
// Request a source file and its test
{
  fileNames: [
    "src/utils/helper.ts",
    "tests/utils/helper.test.ts"
  ]
}

// Load configuration files
{
  fileNames: [
    "package.json",
    "tsconfig.json"
  ]
}
```

## File Modification Tools

### search_and_replace

Apply precise text replacements with support for literal or regex matching.

**Description**: Apply a list of search and replace operations to a file. Each operation can use exact literal text matching or regex patterns.

**Parameters**:
- `filePath` (string): Target file path
- `operations` (array): List of search/replace operations
- `createIfMissing` (boolean, default: true): Create file if it doesn't exist

**Operation Properties**:
- `search` (string): Text to find
- `replace` (string): Replacement text
- `regexPattern` (boolean, default: false): Use regex matching
- `replaceAll` (boolean, default: false): Replace all occurrences
- `caseSensitive` (boolean, default: true): Case-sensitive matching

**Use Cases**:
- Updating variable names
- Modifying configuration values
- Fixing typos
- Updating import statements

**Example**:
```typescript
{
  filePath: "src/config.ts",
  operations: [
    {
      search: "const DEBUG = false;",
      replace: "const DEBUG = true;",
      replaceAll: false
    },
    {
      search: "import\\s+{\\s*([^}]+)\\s*}\\s+from\\s+'([^']+)'",
      replace: "import { $1 } from '$2'",
      regexPattern: true,
      replaceAll: true
    }
  ]
}
```

### search_and_replace_multiline_code

Apply search and replace operations with multiline code support.

**Description**: [Currently Disabled] Enhanced version of search_and_replace with better support for multiline code patterns.

**Status**: Disabled in current version

**Planned Features**:
- Multiline pattern matching
- Code-aware replacements
- Indentation preservation
- Language-specific handling

### search_and_replace with support for literal or regex matching.

**Description**: Apply a list of search and replace operations to a file. Each operation can use exact literal text matching or regex patterns.

**Parameters**:
- `filePath` (string): Target file path
- `operations` (array): List of search/replace operations
- `createIfMissing` (boolean, default: true): Create file if it doesn't exist

**Operation Properties**:
- `search` (string): Text to find
- `replace` (string): Replacement text
- `regexPattern` (boolean, default: false): Use regex matching
- `replaceAll` (boolean, default: false): Replace all occurrences
- `caseSensitive` (boolean, default: true): Case-sensitive matching

**Use Cases**:
- Updating variable names
- Modifying configuration values
- Fixing typos
- Updating import statements

**Example**:
```typescript
{
  filePath: "src/config.ts",
  operations: [
    {
      search: "const DEBUG = false;",
      replace: "const DEBUG = true;",
      replaceAll: false
    },
    {
      search: "import\\s+{\\s*([^}]+)\\s*}\\s+from\\s+'([^']+)'",
      replace: "import { $1 } from '$2'",
      regexPattern: true,
      replaceAll: true
    }
  ]
}
```

### apply_patch

Apply unified diff format patches for complex changes.

**Description**: Apply patches to one or more files. Supports both modifying existing files and creating new ones.

**Parameters**:
- `filePath` (string, optional): Target file path
- `patch` (string): Unified diff format patch content

**Use Cases**:
- Complex multi-line changes
- Creating new files
- Modifying multiple files
- Applying pre-formatted patches

**Example**:
```diff
--- /dev/null
+++ new/file.ts
@@ -0,0 +1,3 @@
+export function newFunction() {
+  return true;
+}
```

### rewrite_file

Completely replace or create file contents.

**Description**: Completely replaces an existing file's contents or creates a new file.

**Parameters**:
- `filePath` (string): Target file path
- `content` (string): New file content
- `createIfMissing` (boolean, default: true): Create file if missing

**Use Cases**:
- Creating new files
- Complete file rewrites
- Generating configuration files
- Creating documentation files

## File Organization Tools

### move_files

Move files or directories while preserving names.

**Description**: Move one or more files or directories to a new location within the project.

**Parameters**:
- `sources` (string[]): Files/directories to move
- `destination` (string): Target directory
- `overwrite` (boolean, default: false): Allow overwriting
- `createMissingDirectories` (boolean, default: false): Create missing directories

**Use Cases**:
- Restructuring project directories
- Organizing related files
- Moving multiple files together
- Relocating project components

### rename_files

Rename files or directories with batch support.

**Description**: Rename one or more files or directories within the project.

**Parameters**:
- `operations` (array): List of rename operations
- `createMissingDirectories` (boolean, default: false): Create missing directories
- `overwrite` (boolean, default: false): Allow overwriting

**Operation Properties**:
- `source` (string): Current path
- `destination` (string): New path

**Use Cases**:
- Updating file naming conventions
- Restructuring project layout
- Batch renaming related files
- Moving and renaming together

## Web Interaction Tools

### fetch_web_page

Fetch and clean text content from web pages.

**Description**: Fetches the content of a specified web page, returning cleaned text content.

**Parameters**:
- `url` (string): Complete URL to fetch

**Features**:
- Strips scripts and styles
- Maintains structure
- Handles various content types
- Size-limited responses

**Use Cases**:
- Retrieving documentation
- Gathering reference material
- Extracting web content
- Research and analysis

### fetch_web_screenshot

Capture visual screenshots of web pages.

**Description**: Captures a screenshot of a specified web page.

**Parameters**:
- `url` (string): Complete URL to capture

**Use Cases**:
- Visual layout analysis
- Design review
- UI/UX discussions
- Complex visual content capture

## Analysis Tools

### vector_search

Perform vector similarity searches.

**Description**: [Currently Disabled] Performs vector search operations for finding similar content.

**Status**: Disabled in current version

**Planned Features**:
- Semantic similarity search
- Embedding-based retrieval
- Configurable similarity thresholds
- Support for various content types

### conversation_summary

Summarize and manage conversation context.

**Description**: Summarize and optionally truncate the current conversation. Can be used both explicitly by user request or proactively by the LLM when the conversation becomes long.

**Parameters**:
- `summaryLength` (string, default: "long"): Controls summary detail level ("short", "medium", "long")
- `maxTokensToKeep` (number, default: 64000): Maximum tokens to keep when truncating
- `requestSource` (string, default: "tool"): Indicates whether summary was requested by user or tool

**Use Cases**:
- Managing long conversations
- Reducing token usage
- Maintaining context awareness
- Preserving key information

**Examples**:
```typescript
// Generate a concise summary
{
  summaryLength: "short",
  requestSource: "user"
}

// Truncate while preserving recent context
{
  maxTokensToKeep: 32000,
  summaryLength: "medium"
}
```

### conversation_metrics

Analyze conversation patterns and usage.

**Description**: Analyze conversation metrics including turns, message types, token usage, and more.

**Parameters**:
- `includeTools` (boolean, default: true): Include tool usage metrics
- `includeFiles` (boolean, default: true): Include file metrics
- `includeTokens` (boolean, default: true): Include token usage
- `includeTiming` (boolean, default: true): Include timing metrics
- `includeQuality` (boolean, default: true): Include quality metrics
- `startTurn` (number, optional): Starting turn number
- `endTurn` (number, optional): Ending turn number

**Metrics Provided**:
- Message types and counts
- Tool usage patterns
- File operations
- Token usage
- Response times
- Quality indicators

### delegate_tasks

Delegate tasks to child interactions.

**Description**: [Currently Disabled] Delegate tasks to child interactions with specific context and resources.

**Status**: Disabled in current version

**Planned Features**:
- Task delegation with context
- Resource allocation
- Progress tracking
- Result aggregation

### multi_model_query

Query multiple LLM models simultaneously.

**Description**: Query multiple LLM models with the same prompt and compare responses.

**Parameters**:
- `query` (string): Prompt text for models
- `models` (string[]): List of model identifiers

**Supported Models**:
- Anthropic:
  - claude-3-5-sonnet-20241022 (Latest Sonnet)
  - claude-3-opus-20240229 (Most capable)
  - claude-3-sonnet-20240229
  - claude-3-haiku-20240307 (Fastest)
- OpenAI:
  - gpt-4o (Latest GPT-4)
  - gpt-4o-mini
  - gpt-4-turbo
  - gpt-4
  - gpt-3.5-turbo
- Google:
  - gemini-pro

**Use Cases**:
- Comparing model responses
- Validating outputs
- Testing prompts
- Getting diverse perspectives

## Context Management

### forget_files

Remove files from conversation context.

**Description**: Remove files from the conversation context to reduce token usage.

**Parameters**:
- `files` (array): Files to remove
  - `filePath` (string): File path
  - `revision` (string): File revision

**Use Cases**:
- Managing context size
- Reducing token usage
- Removing irrelevant files
- Optimizing conversation scope

## Best Practices

1. **File Operations**:
   - Always verify paths before operations
   - Consider impact on project structure
   - Handle related files together
   - Check for dependencies and references
   - Update imports when moving files

2. **Content Changes**:
   - Use `search_and_replace` for simple changes
   - Use `apply_patch` for complex changes
   - Verify changes before applying
   - Consider impact on other files
   - Maintain consistent formatting

3. **Web Operations**:
   - Check site accessibility
   - Handle authentication requirements
   - Consider rate limiting
   - Use appropriate tool for content type
   - Respect robots.txt and terms of service

4. **Model Queries**:
   - Choose appropriate models for tasks
   - Ensure prompt compatibility
   - Consider response variations
   - Handle errors gracefully
   - Compare responses when accuracy is critical

5. **Context Management**:
   - Monitor token usage
   - Remove unnecessary files
   - Keep related files together
   - Track file status changes
   - Maintain clean conversation context

## Tool Selection Guidelines

1. **For File Discovery**:
   - Known paths → `request_files`
   - Unknown paths → `search_project`
   - Pattern matching → `search_project`

2. **For File Changes**:
   - Simple replacements → `search_and_replace`
   - Complex changes → `apply_patch`
   - Complete rewrites → `rewrite_file`
   - Moving files → `move_files`
   - Renaming files → `rename_files`

3. **For Web Content**:
   - Text content → `fetch_web_page`
   - Visual content → `fetch_web_screenshot`
   - Documentation → `fetch_web_page`
   - UI/UX analysis → `fetch_web_screenshot`

4. **For Analysis**:
   - Conversation analysis → `conversation_metrics`
   - Model comparison → `multi_model_query`
   - Performance monitoring → `conversation_metrics`
   - Quality assessment → `conversation_metrics`

This documentation provides a comprehensive overview of BB's tools, their capabilities, and appropriate usage patterns. Each tool is designed for specific scenarios, and understanding their proper application helps in maintaining efficient and effective project management.