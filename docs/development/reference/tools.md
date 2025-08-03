# BB Tools Documentation

This document provides a comprehensive overview of the tools available in BB, including their unified content-type-aware architecture, parameters, use cases, and best practices.

## Table of Contents

1. [Unified Content Tools](#unified-content-tools)
2. [Resource Discovery and Management](#resource-discovery-and-management)
3. [External Content and Web Tools](#external-content-and-web-tools)
4. [System and Analysis Tools](#system-and-analysis-tools)
5. [Context Management](#context-management)
6. [Content Type Architecture](#content-type-architecture)
7. [Best Practices](#best-practices)
8. [Migration from Legacy Tools](#migration-from-legacy-tools)

## Unified Content Tools

BB uses a unified architecture where tools intelligently handle different content types based on data source capabilities. Each data source provides content type guidance to help you choose the right approach.

### write_resource

Create new or rewrite existing resources with content-type-aware input handling.

**Description**: Consolidates resource creation and rewriting with support for multiple content types: plain text, structured content (Notion/Google Docs), and binary content (images, documents).

**Parameters**:
- `dataSourceId` (string, optional): Target data source ID
- `resourcePath` (string): Path for the new/updated resource
- `overwriteExisting` (boolean, default: false): Allow overwriting existing resources
- `createMissingDirectories` (boolean, default: true): Create parent directories if needed
- `resourceName` (string, optional): Display name for structured content resources

**Content Type Options** (exactly one required):
- `plainTextContent`: For filesystem and text-based resources
  - `content` (string): The text content
  - `expectedLineCount` (number): Expected number of lines for validation
  - `acknowledgement` (string): Required confirmation string
  - `allowEmptyContent` (boolean, default: false): Allow empty content
- `structuredContent`: For block-based resources (Notion, Google Docs)
  - `blocks` (PortableTextBlock[]): Structured content blocks
  - `acknowledgement` (string): Required confirmation string
- `binaryContent`: For images, documents, and other non-text resources
  - `data` (string): Base64-encoded binary data or Uint8Array
  - `mimeType` (string): MIME type (e.g., "image/png", "application/pdf")

**Use Cases**:
- Creating new TypeScript/JavaScript files
- Writing configuration files
- Creating Notion pages with rich content
- Uploading images and binary files
- Completely rewriting existing resources

### edit_resource

Edit existing resources with multiple editing approaches and content-type awareness.

**Description**: Unified editing tool that routes to appropriate editing methods based on content type and data source capabilities. Supports search-and-replace, block editing, and structured data editing.

**Parameters**:
- `dataSourceId` (string, optional): Target data source ID
- `resourcePath` (string): Path to the resource to edit
- `createIfMissing` (boolean, default: false): Create resource if it doesn't exist

**Editing Approach Options** (exactly one required):
- `searchAndReplaceEdits`: For precise text modifications in plain text resources
  - `operations` (SearchReplaceOperation[]): List of search/replace operations
  - `caseSensitive` (boolean, default: true): Default case sensitivity
  - `regexPattern` (boolean, default: false): Default regex mode
  - `replaceAll` (boolean, default: false): Default replace all mode
- `blockEdits`: For structured content modifications (Notion, Google Docs)
  - `operations` (PortableTextOperation[]): Block manipulation operations
- `structuredDataEdits`: For database/CSV modifications (future)
  - `operations` (DatabaseOperation[]): Row/column/cell operations

## Resource Discovery and Management

### load_datasource

Retrieve metadata and discover available resources across data sources.

**Description**: Explore data sources to understand their capabilities, content types, and available resources. Provides content type guidance for optimal tool usage.

### load_resources

Load specific resources using URI templates or direct URIs.

**Description**: Load resource content for analysis or editing. Always use load_datasource first to discover available resources and their URI format.

### find_resources

Search for resources by content pattern, name pattern, dates, or size.

**Description**: Discover resources across data sources using flexible search criteria. Returns enhanced results with context when searching content.

## Migration from Legacy Tools

BB has transitioned from separate tools to unified content-aware tools:

### Legacy Tool Mapping

| Legacy Tool | New Tool | Migration Notes |
|---|---|---|
| `search_and_replace` | `edit_resource` | Use `searchAndReplaceEdits` parameter |
| `rewrite_resource` | `write_resource` | Use `overwriteExisting: true` |
| `block_edit` | `edit_resource` | Use `blockEdits` parameter |

### Key Improvements

1. **Content Type Awareness**: Tools automatically adapt to data source capabilities
2. **Unified Interface**: Consistent parameter patterns across all content operations
3. **Better Error Handling**: Clear validation and helpful error messages
4. **Enhanced Guidance**: Dynamic content type guidance from data sources
5. **Future Extensibility**: Architecture supports new content types without tool proliferation

This unified architecture provides a more consistent, extensible, and intelligent approach to content management across BB's diverse data source ecosystem.