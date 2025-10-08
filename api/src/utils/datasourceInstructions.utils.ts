/**
 * Utility functions for generating detailed instructions for editing and writing operations.
 * These can be composed by data source providers based on their capabilities.
 */

/**
 * Generate detailed instructions for searchReplace operations
 */
export function generateSearchReplaceInstructions(): string {
	return `## Search and Replace Operations Guide

### 🚨 CRITICAL WORKFLOW FOR SEARCH AND REPLACE

**BEFORE any search and replace:**
1. **MUST load resource first** with load_resources tool (any contentFormat)
2. **Review exact content** to see current text with precise whitespace
3. **Match search patterns exactly** - including spaces, tabs, line breaks
4. **Apply operations** using edit_resource tool with searchReplace editType
5. **Verify changes** by reloading resource

❌ **COMMON MISTAKES:**
- Guessing at content without loading first
- Ignoring whitespace in search patterns
- Using regex syntax when regexPattern=false

✅ **CORRECT APPROACH:** Load resource → Review content → Match exactly → Replace → Verify

### Basic Search and Replace

Use searchReplace editType for text-based content:

\`\`\`json
{
  "editType": "searchReplace",
  "searchReplace_search": "exact text to find",
  "searchReplace_replace": "replacement text", 
  "searchReplace_caseSensitive": true,
  "searchReplace_regexPattern": false,
  "searchReplace_replaceAll": false
}
\`\`\`

### Parameters

- **searchReplace_search**: Exact text to find (must match precisely including whitespace)
- **searchReplace_replace**: Text to replace matches with
- **searchReplace_caseSensitive**: true = exact case matching, false = ignore case
- **searchReplace_regexPattern**: true = treat search as regex, false = literal text
- **searchReplace_replaceAll**: true = replace all occurrences, false = first only

### Best Practices

✅ **DO load resource first** to see current content
✅ **DO match exact whitespace** and indentation in search patterns
✅ **DO use regex for complex patterns** (when regexPattern=true)
✅ **DO test with replaceAll=false** first, then use true if needed

❌ **DON'T guess at content** - always load first
❌ **DON'T ignore whitespace** - search must match exactly
❌ **DON'T use regex syntax** when regexPattern=false

### Examples

**Simple replacement:**
\`\`\`json
{
  "editType": "searchReplace",
  "searchReplace_search": "oldFunction()",
  "searchReplace_replace": "newFunction()",
  "searchReplace_replaceAll": true
}
\`\`\`

**Regex pattern:**
\`\`\`json
{
  "editType": "searchReplace", 
  "searchReplace_search": "function\\s+(\\w+)\\s*\\(",
  "searchReplace_replace": "async function $1(",
  "searchReplace_regexPattern": true,
  "searchReplace_replaceAll": true
}
\`\`\`

`;
}

/**
 * Generate detailed instructions for structuredData operations
 */
export function generateStructuredDataInstructions(): string {
	return `## Structured Data Operations Guide

### Working with Structured Data

Structured data operations allow direct manipulation of document structure:

\`\`\`json
{
  "editType": "structuredData",
  "structuredData_operation": {
    "type": "update",
    "path": ["properties", "title"],
    "value": "New Title"
  }
}
\`\`\`

### Common Patterns

**Update Property:**
\`\`\`json
{
  "editType": "structuredData",
  "structuredData_operation": {
    "type": "update",
    "path": ["metadata", "description"], 
    "value": "Updated description"
  }
}
\`\`\`

**Add Array Item:**
\`\`\`json
{
  "editType": "structuredData", 
  "structuredData_operation": {
    "type": "insert",
    "path": ["tags"],
    "index": 0,
    "value": "new-tag"
  }
}
\`\`\`

### Best Practices

✅ **DO load structured content first** to see current data structure
✅ **DO use valid JSON paths** for property access
✅ **DO validate data types** match expected values

❌ **DON'T modify structure** without understanding current format
❌ **DON'T assume property paths** - always check current structure

`;
}

/**
 * Generate detailed instructions for writing plain text content
 */
export function generatePlainTextWritingInstructions(): string {
	return `## Creating Resources with Plain Text Content

### Basic Plain Text Creation

Use the write_resource tool with plainTextContent for creating text files:

\`\`\`json
{
  "resourcePath": "path/to/new-file.ext",
  "plainTextContent": {
    "content": "Your plain text content here",
    "expectedLineCount": 3,
    "allowEmptyContent": false,
    "acknowledgement": "I have checked for existing resource contents and confirm this is the complete resource content with no omissions or placeholders"
  }
}
\`\`\`

### Required Parameters

- **content**: The complete text content to write to the file
- **expectedLineCount**: Number of lines in your content (used for validation)
- **acknowledgement**: Required confirmation string (must match exactly)
- **allowEmptyContent**: Set to true only if creating an intentionally empty file

### Content Guidelines

✅ **DO provide complete content** - no placeholders or partial content
✅ **DO count lines accurately** - include empty lines in your count
✅ **DO use proper line endings** - \\n for line breaks
✅ **DO include all formatting** - spaces, tabs, indentation

❌ **DON'T use placeholders** like "// Add more content here"
❌ **DON'T provide partial content** - write_resource creates complete files
❌ **DON'T guess line counts** - count them precisely
❌ **DON'T forget the acknowledgement** - it must match exactly

### Examples

**TypeScript configuration file:**
\`\`\`json
{
  "resourcePath": "src/config.ts",
  "plainTextContent": {
    "content": "export const config = {\\n  apiUrl: 'https://api.example.com',\\n  timeout: 5000\\n};",
    "expectedLineCount": 4,
    "acknowledgement": "I have checked for existing resource contents and confirm this is the complete resource content with no omissions or placeholders"
  }
}
\`\`\`

**Markdown documentation:**
\`\`\`json
{
  "resourcePath": "docs/readme.md",
  "plainTextContent": {
    "content": "# Project Title\\n\\nBrief description of the project.\\n\\n## Installation\\n\\nRun \`npm install\` to get started.",
    "expectedLineCount": 7,
    "acknowledgement": "I have checked for existing resource contents and confirm this is the complete resource content with no omissions or placeholders"
  }
}
\`\`\`

`;
}

/**
 * Generate detailed instructions for writing binary content
 */
export function generateBinaryContentWritingInstructions(): string {
	return `## Creating Resources with Binary Content

### Binary Content Creation

Use the write_resource tool with binaryContent for images, documents, and other non-text files:

\`\`\`json
{
  "resourcePath": "assets/logo.png",
  "binaryContent": {
    "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "mimeType": "image/png"
  }
}
\`\`\`

### Required Parameters

- **data**: Base64-encoded binary data or Uint8Array
- **mimeType**: MIME type of the content (e.g., "image/png", "application/pdf")

### Supported MIME Types

**Images:**
- image/png - PNG images
- image/jpeg - JPEG images  
- image/gif - GIF images
- image/svg+xml - SVG vector images
- image/webp - WebP images

**Documents:**
- application/pdf - PDF documents
- application/msword - Word documents
- application/vnd.openxmlformats-officedocument.wordprocessingml.document - Word .docx

**Archives:**
- application/zip - ZIP archives
- application/gzip - Gzip files

**Other:**
- application/octet-stream - Generic binary data

### Data Encoding

**Base64 String (most common):**
\`\`\`json
{
  "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "mimeType": "image/png"
}
\`\`\`

### Best Practices

✅ **DO use correct MIME types** - match the actual file format
✅ **DO validate Base64 encoding** - ensure data is properly encoded
✅ **DO use appropriate file extensions** in resourcePath
✅ **DO consider file sizes** - large files may have limitations

❌ **DON'T mix content types** - use only binaryContent for binary files
❌ **DON'T use wrong MIME types** - this can cause display/processing issues
❌ **DON'T forget Base64 encoding** - raw binary data won't work in JSON

### Examples

**Creating a small PNG image:**
\`\`\`json
{
  "resourcePath": "icons/check.png",
  "binaryContent": {
    "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "mimeType": "image/png"
  }
}
\`\`\`

**Creating a PDF document:**
\`\`\`json
{
  "resourcePath": "documents/report.pdf",
  "binaryContent": {
    "data": "JVBERi0xLjQKJcOkw7zDtsO8w7zCsAoxIDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcy",
    "mimeType": "application/pdf"
  }
}
\`\`\`

`;
}

/**
 * Generate provider-agnostic workflow instructions
 */
export function generateWorkflowInstructions(): string {
	return `## General Workflow

### Before Making Changes

1. **Load resource first** to understand current content and structure
2. **Review capabilities** to understand supported operations
3. **Plan operations** based on current content and desired changes
4. **Validate parameters** like indices, paths, and ranges

### Making Changes

1. **Use appropriate edit type** for your use case
2. **Structure operations correctly** using examples above
3. **Apply operations** using edit_resource tool
4. **Verify results** by reloading resource

### Multiple Operations

- **Operations are processed as a batch** in a single atomic update
- **Order matters** for some edit types (especially range operations)
- **Test complex changes** with simple operations first
- **Use createIfMissing=false** to prevent accidental file creation

### Error Handling

If operations fail:
1. **Check parameter format** against examples
2. **Verify indices/paths** are valid for current content  
3. **Ensure edit type** is supported by the data source
4. **Load resource again** to see current state

`;
}
