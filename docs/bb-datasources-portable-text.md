# Beyond Better: Data Sources and Tools

## Overview

This document summarizes key findings and recommendations for enhancing Beyond Better (BB) with flexible data sources and specialized tools. The goal is to create an assistant that works effectively with diverse content types and services while maintaining a consistent, powerful toolset.

## Current Data Source Architecture

BB already has a sophisticated data source architecture with clear separation of concerns:

### Core Components

1. **DataSourceProvider**:
   - Defines the capabilities and characteristics of a type of data source
   - Declares supported capabilities (read, write, search, etc.)
   - Declares access method ('bb' or 'mcp')
   - Provides factory methods for creating ResourceAccessors

2. **DataSourceConnection**:
   - Represents a specific configured instance of a data source
   - Stores connection details (paths, credentials, etc.)
   - Associates with a specific DataSourceProvider

3. **ResourceAccessor**:
   - Provides access to resources within a data source
   - Handles provider-specific resource formats and operations
   - Implements capabilities based on the provider's declared support

4. **DataSourceRegistry**:
   - Manages available data source providers
   - Creates new DataSourceConnections
   - Handles provider registration and lookup

5. **DataSourceFactory**:
   - Creates and caches ResourceAccessor implementations
   - Routes to appropriate implementation based on access method

### Access Method Distinction

BB maintains a fundamental architectural boundary between two categories:

1. **BB-managed data sources** (`accessMethod: 'bb'`):
   - Directly controlled by BB's internal code
   - Full access to all operations and capabilities
   - Examples: filesystem, internal Notion integration

2. **MCP-managed data sources** (`accessMethod: 'mcp'`):
   - Delegated to external Model Context Protocol servers
   - Limited to capabilities defined by the MCP server
   - Examples: Supabase, external services

## Portable Text as the Block Content Standard

After evaluating multiple approaches for representing rich, block-based document content, **Portable Text** emerges as the ideal format for BB's block editing capabilities.

### What is Portable Text?

Portable Text is a JSON-based specification for structured content that was originally developed by Sanity.io. It provides a standardized way to represent rich text content with formatting, links, and other elements.

```json
[
  {
    "_type": "block",
    "style": "h1",
    "children": [
      {
        "_type": "span",
        "text": "Document Title",
        "marks": []
      }
    ]
  },
  {
    "_type": "block",
    "style": "normal",
    "children": [
      {
        "_type": "span",
        "text": "This is a paragraph with ",
        "marks": []
      },
      {
        "_type": "span",
        "text": "bold",
        "marks": ["strong"]
      },
      {
        "_type": "span",
        "text": " and ",
        "marks": []
      },
      {
        "_type": "span",
        "text": "italic",
        "marks": ["em"]
      },
      {
        "_type": "span",
        "text": " text.",
        "marks": []
      }
    ]
  },
  {
    "_type": "block",
    "style": "normal",
    "listItem": "bullet",
    "level": 1,
    "children": [
      {
        "_type": "span",
        "text": "A bullet point",
        "marks": []
      }
    ]
  }
]
```

### Key Advantages for BB

1. **JSON-Based and LLM-Friendly**:
   - Clear structure that's easy for AI to parse and modify
   - Predictable format for generating changes
   - No HTML or markup parsing required

2. **System-to-System Exchange Format**:
   - Designed specifically for content exchange between systems
   - No UI or visual rendering assumptions
   - Perfect for BB's non-visual, programmatic editing needs

3. **Strong Typing with Clear Semantics**:
   - Explicit block types with consistent structure
   - Standard way to represent formatting (marks)
   - Clear parent-child relationships

4. **Service-Agnostic but Extensible**:
   - Works across different platforms (Notion, Google Docs, etc.)
   - Can be extended with service-specific attributes
   - Maintains core compatibility while allowing customization

5. **Mature Specification**:
   - Well-documented format with established patterns
   - Existing libraries for conversion to/from other formats
   - Proven in production environments

### Block Resource Accessors with Portable Text

Extend the ResourceAccessor interface with Portable Text-based methods:

```typescript
interface BlockResourceAccessor extends ResourceAccessor {
  // Get document as Portable Text
  getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]>;
  
  // Apply operations to Portable Text
  applyPortableTextOperations(
    resourceUri: string, 
    operations: PortableTextOperation[]
  ): Promise<PortableTextOperationResult[]>;
  
  // Convert to/from service-specific formats
  convertToPortableText(nativeDocument: any): PortableTextBlock[];
  convertFromPortableText(blocks: PortableTextBlock[]): any;
}

// Portable Text typings
type PortableTextBlock = {
  _type: string;          // "block", "image", etc.
  _key?: string;          // Unique identifier
  style?: string;         // "normal", "h1", "h2", etc.
  listItem?: string;      // "bullet", "number", etc.
  level?: number;         // List nesting level
  children: PortableTextSpan[];
};

type PortableTextSpan = {
  _type: "span";
  _key?: string;          // Unique identifier
  text: string;
  marks?: string[];       // ["strong", "em", "link", etc.]
};
```

Implementations would be provider-specific but share the Portable Text format:

```typescript
class NotionBlockResourceAccessor extends NotionResourceAccessor implements BlockResourceAccessor {
  // Convert Notion blocks to Portable Text
  convertToPortableText(notionBlocks: any[]): PortableTextBlock[] {
    // Map Notion blocks to Portable Text
    return notionBlocks.map(block => {
      // Conversion logic here
    });
  }
  
  // Convert Portable Text back to Notion format
  convertFromPortableText(blocks: PortableTextBlock[]): any[] {
    // Conversion logic here
  }
}
```

## Block Edit Tool with Portable Text

The `block_edit` tool would work with Portable Text format:

```typescript
interface LLMToolBlockEdit {
  dataSourceId: string;       // Target data source
  resourcePath: string;       // Document path/ID
  operations: PortableTextOperation[];
}

type PortableTextOperation = {
  operationType: "update" | "insert" | "delete" | "move";
  selector: {
    blockIndex?: number;      // Target by position
    blockKey?: string;        // Target by ID
    path?: string;            // JSON path within block
    textMatch?: {             // Match text content
      pattern: string;
      matchType: "prefix" | "exact" | "contains" | "regex";
    };
  };
  value?: any;                // New content for update/insert
  destination?: {             // For move operations
    beforeBlockKey?: string;
    afterBlockKey?: string;
    parentBlockKey?: string;
  };
};
```

**Example Operation:**

```json
{
  "dataSourceId": "ds-notion",
  "resourcePath": "bb+notion+notion-work://page/1a436d1afcff8044815bc50bc0eff3f9",
  "operations": [
    {
      "operationType": "update",
      "selector": {
        "blockKey": "paragraph-123",
        "path": "children[0].text"
      },
      "value": "Updated paragraph text"
    },
    {
      "operationType": "insert",
      "selector": {
        "afterBlockKey": "paragraph-123"
      },
      "value": {
        "_type": "block",
        "style": "normal",
        "children": [
          {
            "_type": "span",
            "text": "New paragraph added after the previous one.",
            "marks": []
          }
        ]
      }
    }
  ]
}
```

**Response Format:**

```json
{
  "success": true,
  "results": [
    {
      "operationIndex": 0,
      "status": "success",
      "details": {
        "previousValue": "Original paragraph text",
        "newValue": "Updated paragraph text"
      }
    },
    {
      "operationIndex": 1,
      "status": "success",
      "details": {
        "insertedBlockKey": "new-block-456"
      }
    }
  ],
  "resourceUpdated": {
    "path": "bb+notion+notion-work://page/1a436d1afcff8044815bc50bc0eff3f9",
    "lastModified": "2025-05-13T01:10:00.000Z",
    "revision": "01JV3GH5DTCA84CXCEE6GVVTD3"
  }
}
```

## Structured Data Edit Tool

A `structured_data_edit` tool would handle tabular and database-like content:

```typescript
interface StructuredDataEditTool {
  dataSourceId: string;
  resourcePath: string;
  operations: (
    | RowOperation
    | ColumnOperation 
    | CellOperation
    | FilterOperation
    | SortOperation
  )[];
}

interface CellOperation {
  operationType: "updateCell";
  selector: {
    rowIdentifier: string;    // "id:5" | "index:3" | "where:name=John"
    columnIdentifier: string; // "name" | "index:2" | "id:col_abc123"
  };
  value: any;
}

interface RowOperation {
  operationType: "addRow" | "deleteRow" | "updateRow";
  position?: string;         // "end" | "start" | "after:id:5"
  rowIdentifier?: string;    // For update/delete
  values?: Record<string, any>; // For add/update
}

interface ColumnOperation {
  operationType: "addColumn" | "deleteColumn" | "updateColumn";
  columnIdentifier?: string; // For update/delete
  position?: string;         // For add
  properties?: {             // Column definition
    name: string;
    type: string;
    options?: any[];
  };
}
```

**Example Operation:**

```json
{
  "dataSourceId": "ds-airtable",
  "resourcePath": "bb+airtable+my-base://base/table/Projects",
  "operations": [
    {
      "operationType": "updateCell",
      "selector": {
        "rowIdentifier": "where:name=Alpha Project",
        "columnIdentifier": "status"
      },
      "value": "Completed"
    },
    {
      "operationType": "addRow",
      "position": "end",
      "values": {
        "name": "New Feature",
        "status": "Planning",
        "dueDate": "2025-06-15"
      }
    }
  ]
}
```

## Comparison with Existing Tools

### search_and_replace vs. block_edit

| Feature | search_and_replace | block_edit with Portable Text |
|---------|-------------------|------------------------------|
| **Best for** | Plain text, code, simple markup | Structured documents with rich formatting |
| **Targeting** | Text patterns (literal or regex) | Blocks, spans, attributes with IDs |
| **Formatting** | No formatting preservation | Preserves rich formatting |
| **Structure** | No structure awareness | Preserves document structure |
| **Complexity** | Simple operations, complex patterns | Complex operations, simple targeting |
| **Ideal use case** | "Replace all occurrences of X with Y" | "Make this heading bold" or "Update this list item" |

### rewrite_resource vs. block_edit

| Feature | rewrite_resource | block_edit with Portable Text |
|---------|-----------------|------------------------------|
| **Best for** | Complete file rewrites | Targeted structural changes |
| **Scope** | Entire resource | Specific blocks or elements |
| **Risk** | High (replaces everything) | Lower (targeted changes) |
| **Structure** | Recreates from scratch | Preserves existing structure |
| **Ideal use case** | "Create a new config file" | "Rearrange these sections" |

**Recommendation:** Keep all three tools, with clear guidance on when to use each:
- **search_and_replace:** For text files, code, and pattern-based replacements
- **rewrite_resource:** For creating new files or complete rewrites
- **block_edit:** For structured editing of rich documents using Portable Text

## Service-Specific Adapters

Implementations would convert between service-specific formats and Portable Text:

### Notion Adapter

```typescript
class NotionBlockResourceAccessor extends NotionResourceAccessor implements BlockResourceAccessor {
  async getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]> {
    // Get Notion blocks
    const notionBlocks = await this.getNotionBlocks(resourceUri);
    // Convert to Portable Text
    return this.convertToPortableText(notionBlocks);
  }
  
  async applyPortableTextOperations(
    resourceUri: string, 
    operations: PortableTextOperation[]
  ): Promise<PortableTextOperationResult[]> {
    // Get current Portable Text
    const currentBlocks = await this.getDocumentAsPortableText(resourceUri);
    
    // Apply operations to Portable Text
    const { updatedBlocks, results } = this.applyOperationsToPortableText(
      currentBlocks, 
      operations
    );
    
    // Convert back to Notion format
    const notionBlocks = this.convertFromPortableText(updatedBlocks);
    
    // Update Notion
    await this.updateNotionBlocks(resourceUri, notionBlocks);
    
    return results;
  }
  
  // Conversion methods
  convertToPortableText(notionBlocks: any[]): PortableTextBlock[] {
    return notionBlocks.map(block => {
      // Example conversion from Notion block to Portable Text
      if (block.type === "paragraph") {
        return {
          _type: "block",
          _key: block.id,
          style: "normal",
          children: block.paragraph.rich_text.map(text => ({
            _type: "span",
            text: text.plain_text,
            marks: this.convertNotionAnnotationsToMarks(text.annotations)
          }))
        };
      }
      // Handle other block types
    });
  }
  
  convertFromPortableText(blocks: PortableTextBlock[]): any[] {
    // Convert Portable Text back to Notion blocks
  }
}
```

### Google Docs Adapter

```typescript
class GoogleDocsAccessor extends BBResourceAccessor implements BlockResourceAccessor {
  async getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]> {
    // Get Google Docs content
    const googleDoc = await this.getGoogleDocument(resourceUri);
    // Convert to Portable Text
    return this.convertToPortableText(googleDoc);
  }
  
  // Conversion methods
  convertToPortableText(googleDoc: any): PortableTextBlock[] {
    // Example conversion from Google Docs to Portable Text
    return googleDoc.body.content.map(item => {
      if (item.paragraph) {
        return {
          _type: "block",
          _key: item.paragraph.paragraphId,
          style: this.getParagraphStyle(item.paragraph),
          children: this.convertTextRuns(item.paragraph.elements)
        };
      }
      // Handle other element types
    });
  }
}
```

## Supported Services and Integration

### Document/Page-Based Services

- **Notion**
	- Block-based with rich text elements
	- Portable Text mapping: Direct mapping of block types
	- URI Format: `bb+notion+{connection-name}://page/{page-id}`
  
- **Google Docs**
	- Paragraph-based with formatting runs
	- Portable Text mapping: Paragraphs to blocks, text runs to spans
	- URI Format: `bb+googledocs+{connection-name}://document/{doc-id}`
  
- **Microsoft 365 (Word, OneNote)**
	- Mixed content model with rich formatting
	- Portable Text mapping: Content controls to blocks
	- URI Format: `bb+microsoft365+{connection-name}://document/{doc-id}`
  
- **Confluence**
	- Page-based with macros
	- Portable Text mapping: Macro blocks to custom block types
	- URI Format: `bb+confluence+{connection-name}://page/{page-id}`

### Database/Tabular Services

Structured data services would use the structured_data_edit tool instead of block_edit with Portable Text.

## Integration with Current Architecture

### Block Edit Tool Implementation

Implementing the block_edit tool within the current architecture:

```typescript
class LLMToolBlockEdit extends LLMTool {
  async runTool(
      interaction: LLMConversationInteraction,
      toolUse: LLMAnswerToolUse,
      projectEditor: ProjectEditor,
  ): Promise<LLMToolRunResult> {
    const { toolUseId, toolInput } = toolUse;
    const { resourcePath, operations, createIfMissing = true, dataSourceId = undefined } =
        toolInput as LLMToolBlockEditInput;
    
    // Get data source connection
    const { primaryDsConnection, dsConnections, notFound } = this.getDsConnectionsById(
      projectEditor,
      dataSourceId ? [dataSourceId] : undefined,
    );
    
    // Get resource accessor for this source
    const resourceAccessor = await dsConnectionToUse.getResourceAccessor();

    // Check if resourceAccessor supports block operations
    if (!resourceAccessor.hasCapability('blockEdit')) {
      throw new Error(`Data source ${dataSource.name} does not support block editing`);
    }
    
    // Cast to block-capable accessor
    const blockAccessor = resourceAccessor as unknown as BlockResourceAccessor;
    
    // Apply operations
    const results = await blockAccessor.applyPortableTextOperations(resourcePath, operations);
    
    return {
      success: true,
      results,
      resourceUpdated: {
        path: resourcePath,
        lastModified: new Date().toISOString(),
        revision: generateRevisionId()
      }
    };
  }
}
```

### Provider Enhancement

Enhancing existing DataSourceProvider implementations to support Portable Text operations:

```typescript
class NotionProvider extends BBDataSourceProvider {
  constructor() {
    super({
      id: 'notion',
      name: 'Notion',
      description: 'Access and edit Notion pages and databases',
      capabilities: [
        'read', 'list', 'search',
        // Add block capabilities
        'blockRead', 'blockEdit'
      ],
      // Other properties
    });
  }
  
  createAccessor(connection: DataSourceConnection): ResourceAccessor {
    return new NotionBlockResourceAccessor(connection);
  }
}
```


## Conclusion

Extending BB's robust data source architecture with Portable Text as the standard format for rich document editing provides several key benefits:

1. **Consistent editing experience** across diverse document formats
2. **Structure preservation** when modifying complex documents
3. **Format-aware editing** that respects the native capabilities of each platform
4. **Simplified AI interaction** with a uniform, LLM-friendly model
5. **Strong foundation** using a mature, well-designed specification

The recommended approach:

1. **Extend the existing architecture** rather than replacing it:
   - Add Portable Text-based interfaces to the current ResourceAccessor pattern
   - Implement service-specific adapters for each supported platform
   - Maintain the BB-managed vs. MCP-managed distinction

2. **Maintain specialized tools** for different content types:
   - Keep text-based tools: search_and_replace, rewrite_resource
   - Add block-based tool: block_edit with Portable Text
   - Add tabular tool: structured_data_edit

This approach offers the ideal balance of consistency, flexibility, and implementation feasibility.

---

## Addendum: Rich Text Editors vs. Structured Content Formats

During the research for this document, several editor frameworks and content models were evaluated. This addendum explains why rich text editors are not suitable for BB's needs and why Portable Text is the recommended approach.

### Evaluated Editor Frameworks

1. **Slate.js**
   - Browser-based rich text editor framework
   - Uses React for rendering
   - Customizable document model
   - Primarily focused on interactive editing

2. **ProseMirror**
   - Toolkit for building rich text editors
   - Schema-based document representation
   - Focus on collaborative editing
   - Requires DOM for rendering

3. **Lexical**
   - Facebook's editor framework
   - React-based with TypeScript support
   - Extensible node system
   - Designed for browser environments

4. **Draft.js**
   - React-based editor framework
   - ContentState model for documents
   - Immutable.js data structures
   - Heavy browser dependency

### Why Editor Frameworks Are Not Suitable for BB

1. **Browser/DOM Dependencies**
   - Most editor frameworks require a browser environment
   - BB operates in a server-side Node.js/Deno context
   - Unnecessary rendering overhead

2. **User Interaction Focus**
   - Designed for capturing keystrokes, selections, etc.
   - BB performs programmatic edits, not interactive ones
   - Complex event systems are irrelevant

3. **UI Component Coupling**
   - Tightly coupled with UI rendering libraries (React, etc.)
   - BB doesn't need rendering capabilities
   - Difficult to separate model from view

4. **Heavy Dependencies**
   - Large bundle sizes and dependency trees
   - Performance overhead for unused features
   - Complexity not aligned with BB's needs

### Why Portable Text Is Ideal for BB

1. **Pure Data Format**
   - No UI components or rendering dependencies
   - Simple JSON structure without browser requirements
   - Clean separation of content from presentation

2. **Designed for System-to-System Exchange**
   - Created specifically for content interchange
   - Format agnostic to input and output methods
   - Perfect for BB's programmatic editing

3. **LLM-Friendly Structure**
   - Clear, consistent JSON format
   - Explicit typing of content elements
   - Easy for AI to understand and generate

4. **Minimal Yet Complete**
   - Covers essential rich text needs without bloat
   - Extensible for service-specific features
   - Focused on content structure, not editing experience

5. **Established Ecosystem**
   - Mature specification with documentation
   - Existing conversion utilities
   - Production-proven in headless CMS contexts

### Other Considered Approaches

1. **Custom JSON Format**
   - Would require designing a new specification
   - Reinventing solutions to solved problems
   - No existing ecosystem or tools

2. **Markdown-Based Approach**
   - Limited formatting capabilities
   - Difficult to represent complex structures
   - Loss of specific formatting details

3. **Service-Specific Formats**
   - No consistency across services
   - Complex translation between formats
   - Higher maintenance burden

Portable Text offers the optimal balance of simplicity, capability, and implementation feasibility for BB's non-visual, programmatic document editing needs.