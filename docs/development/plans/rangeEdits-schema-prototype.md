# rangeEdits Schema Prototype

## Overview

This document prototypes the `rangeEdits` schema addition to the existing `editResource.tool` to solve the Google Docs architectural mismatch problem.

## Schema Addition to editResource.tool

### Input Schema Enhancement

```typescript
// Add to existing editResource tool input schema alongside existing approaches
rangeEdits: {
  type: 'object',
  description: 'Character range-based operations for documents with indexed content (Google Docs, Word Online, etc.)',
  properties: {
    operations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['insertText', 'deleteRange', 'replaceText', 'updateTextStyle', 'updateParagraphStyle'],
            description: 'Type of range operation to perform'
          },
          // For insertText operations
          location: {
            type: 'object',
            properties: {
              index: { 
                type: 'number', 
                description: 'Character index for insertion (0-based)' 
              },
              tabId: {
                type: 'string',
                description: 'Optional tab ID for multi-tab documents'
              }
            },
            required: ['index'],
            description: 'Character position for insert operations'
          },
          // For deleteRange, replaceText, updateTextStyle, updateParagraphStyle
          range: {
            type: 'object',
            properties: {
              startIndex: { 
                type: 'number',
                description: 'Start character index (inclusive, 0-based)' 
              },
              endIndex: { 
                type: 'number',
                description: 'End character index (exclusive, 0-based)' 
              },
              tabId: {
                type: 'string',
                description: 'Optional tab ID for multi-tab documents'
              }
            },
            required: ['startIndex', 'endIndex'],
            description: 'Character range for update/delete operations'
          },
          // Content for insert/replace operations
          text: {
            type: 'string',
            description: 'Text content for insert/replace operations'
          },
          // Styling for text formatting operations
          textStyle: {
            type: 'object',
            properties: {
              bold: { type: 'boolean' },
              italic: { type: 'boolean' },
              underline: { type: 'boolean' },
              strikethrough: { type: 'boolean' },
              fontSize: { type: 'number' },
              fontFamily: { type: 'string' },
              foregroundColor: {
                type: 'object',
                properties: {
                  rgbColor: {
                    type: 'object',
                    properties: {
                      red: { type: 'number', minimum: 0, maximum: 1 },
                      green: { type: 'number', minimum: 0, maximum: 1 },
                      blue: { type: 'number', minimum: 0, maximum: 1 }
                    }
                  }
                }
              }
            },
            description: 'Text formatting properties to apply'
          },
          // Styling for paragraph formatting operations  
          paragraphStyle: {
            type: 'object',
            properties: {
              namedStyleType: {
                type: 'string',
                enum: ['NORMAL_TEXT', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6'],
                description: 'Named paragraph style to apply'
              },
              alignment: {
                type: 'string',
                enum: ['START', 'CENTER', 'END', 'JUSTIFIED'],
                description: 'Text alignment'
              },
              lineSpacing: { type: 'number', description: 'Line spacing multiplier' },
              spaceAbove: { type: 'number', description: 'Space above paragraph in points' },
              spaceBelow: { type: 'number', description: 'Space below paragraph in points' }
            },
            description: 'Paragraph formatting properties to apply'
          },
          // Fields to update (for updateTextStyle/updateParagraphStyle)
          fields: {
            type: 'string',
            description: 'Comma-separated list of fields to update (e.g., "bold,italic,fontSize")'
          }
        },
        required: ['type']
      },
      description: 'Array of character range operations to apply in sequence'
    }
  },
  required: ['operations']
}
```

## Benefits of This Approach

1. **🎯 Precision**: Direct character-level control, no lossy conversions
2. **🔄 Reliability**: 1:1 mapping to Google Docs API, predictable results  
3. **⚡ Performance**: No block conversion overhead, direct API calls
4. **🧩 Extensibility**: Easy to add Word Online, other range-based systems
5. **🔧 Maintainability**: Clear separation of concerns by operation model
6. **📏 LLM Friendly**: I can reliably calculate character ranges and indices

## Character Range Calculation Strategy

As an LLM, I can reliably work with character ranges by:

1. **Loading document content** using `load_resources` with appropriate format
2. **Analyzing text structure** to identify target content
3. **Calculating precise indices** by counting characters, including newlines
4. **Accounting for previous operations** that shift character positions
5. **Handling Unicode correctly** including multi-byte characters

Example calculation:
```typescript
// Given document content: "Hello World\n\nThis is a test."
// To replace "World" with "Universe":
// "Hello " = 6 characters
// "World" starts at index 6, ends at index 11
{
  type: 'replaceText',
  range: { startIndex: 6, endIndex: 11 },
  text: 'Universe'
}
```

## Google Docs Search/Replace Integration

### ReplaceAllText Operation

Google Docs API provides a powerful `ReplaceAllTextRequest` operation that should be integrated into the `rangeEdits` approach rather than treated as a separate `searchAndReplaceEdits` operation. This is because:

1. **Provider-Specific Optimization**: `ReplaceAllTextRequest` is a Google Docs native operation
2. **Atomic Batching**: Can be combined with other range operations in a single batch
3. **Better Performance**: Leverages Google Docs' internal search capabilities
4. **Regex Support**: Native regex support through `SubstringMatchCriteria`

### Enhanced rangeEdits Schema with Search/Replace

```typescript
// Add to the rangeEdits operations enum:
type: {
  type: 'string',
  enum: [
    'insertText', 
    'deleteRange', 
    'replaceText', 
    'updateTextStyle', 
    'updateParagraphStyle',
    'replaceAllMatching'  // NEW: Google Docs search/replace
  ],
  description: 'Type of range operation to perform'
},

// Add new properties for replaceAllMatching:
matchCriteria: {
  type: 'object',
  properties: {
    text: { 
      type: 'string',
      description: 'The text to search for in the document'
    },
    matchCase: { 
      type: 'boolean',
      description: 'True for case-sensitive search, false for case-insensitive'
    },
    searchByRegex: { 
      type: 'boolean', 
      description: 'True to treat search text as regular expression'
    }
  },
  required: ['text'],
  description: 'Search criteria for replaceAllMatching operations'
},
```

### Usage Example

```typescript
{
  resourcePath: "googledocs://document/abc123",
  rangeEdits: {
    operations: [
      {
        type: 'replaceAllMatching',
        matchCriteria: {
          text: 'oldTerm',
          matchCase: true,
          searchByRegex: false
        },
        text: 'newTerm'
      }
    ]
  }
}
```

## Tool Integration Requirements

### 1. loadResources.tool Schema Changes

The `loadResources.tool` needs to support the `contentFormat` parameter as outlined in the load-resources-content-format-enhancement.md plan:

```typescript
// Add to loadResources.tool input schema
contentFormat: {
  type: 'string',
  enum: ['plainText', 'structured'],
  default: 'plainText',
  description: 'Content representation format. plainText=human-readable (markdown), structured=provider-specific format. Parameter ignored for filesystem sources.'
}
```

#### Google Docs ContentFormat Behavior

```typescript
// For Google Docs:
// 1. plainText format returns markdown (for reading/analysis)
// 2. structured format returns native Google Docs JSON (full fidelity)

// For range editing workflow:
{
  dataSourceId: 'google',
  resourcePath: 'document/abc123',
  contentFormat: 'structured'  // Get full native format for range operations
}
```

### 2. writeResource.tool Content Types

The `writeResource.tool` supports universal content types with provider translation:

```typescript
// writeResource.tool content types:
// 1. plainTextContent - for simple text documents
// 2. structuredContent - Enhanced PortableText (cross-provider rich format)

// Example: Create new Google Doc with rich content
{
  resourcePath: 'googledocs://document/new-document',
  structuredContent: {
    blocks: [
      {
        _type: 'block',
        _key: 'heading1',
        style: 'h1',
        children: [{
          _type: 'span',
          _key: 'span1',
          text: 'Sales Report',
          marks: ['strong'],
          textStyle: {
            color: '#FF0000',
            fontSize: 18
          }
        }]
      }
    ],
    acknowledgement: 'Creating enhanced PortableText content'
  }
}
```

## DataSource Provider/Accessor Architecture

### Terminology Clarification
- **Provider**: Defines what a datasource can do (capabilities, supported operations)
- **Accessor**: Implements the functionality (actual read/write/edit operations)
- **Connection**: A specific instance of the provider (with auth, config, etc.)

### 1. Interface Additions

```typescript
// Add to dataSources/interfaces/
export interface RangeResourceAccessor {
  /**
   * Apply range operations to a resource
   * @param resourceUri URI of the resource to modify
   * @param operations Array of range operations to apply
   * @returns Array of operation results
   */
  applyRangeOperations(
    resourceUri: string,
    operations: RangeOperation[]
  ): Promise<RangeOperationResult[]>;
}

export interface RangeOperation {
  type: 'insertText' | 'deleteRange' | 'replaceText' | 'updateTextStyle' | 'updateParagraphStyle' | 'replaceAllMatching';
  
  // Location for insert operations
  location?: {
    index: number;
    tabId?: string;
  };
  
  // Range for update/delete operations
  range?: {
    startIndex: number;
    endIndex: number;
    tabId?: string;
  };
  
  // Content
  text?: string;
  
  // Search criteria for replaceAllMatching
  matchCriteria?: {
    text: string;
    matchCase?: boolean;
    searchByRegex?: boolean;
  };
  
  // Styling
  textStyle?: GoogleDocsTextStyle;
  paragraphStyle?: GoogleDocsParagraphStyle;
  
  // Fields to update
  fields?: string;
}

export interface RangeOperationResult {
  operationIndex: number;
  type: string;
  success: boolean;
  message: string;
  affectedRange?: {
    startIndex: number;
    endIndex: number;
  };
  // For replaceAllMatching operations
  replacementCount?: number;
}
```

### 2. GoogleDocsAccessor Implementation

```typescript
// Enhanced accessor with provider translation layer
class GoogleDocsAccessor extends BBResourceAccessor {
  
  // Reading: Return native Google Docs format for full fidelity
  async loadResource(resourceUri: string, options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
    const contentFormat = options.contentFormat || 'plainText';
    
    if (contentFormat === 'structured') {
      // Return native Google Docs JSON format
      const document = await this.client.getDocument(documentId);
      return {
        content: JSON.stringify(document),
        representationType: 'google-docs-native',
        contentFormat: 'structured'
      };
    } else {
      // Return markdown for reading
      return this.loadDocumentAsMarkdown(resourceUri);
    }
  }
  
  // Writing: Translate Enhanced PortableText to Google Docs format
  async writeResource(resourceUri: string, content: StructuredContent): Promise<ResourceWriteResult> {
    const googleDocsRequests = this.translateEnhancedPortableTextToGoogleDocs(content.blocks);
    return await this.createDocumentWithRequests(resourceUri, googleDocsRequests);
  }
  
  // Editing: Direct range operations to Google Docs batch API
  async applyRangeOperations(resourceUri: string, operations: RangeOperation[]): Promise<RangeOperationResult[]> {
    const googleDocsRequests = operations.map(op => this.translateRangeOperationToGoogleDocs(op));
    const response = await this.client.updateDocument(documentId, googleDocsRequests);
    return this.processRangeOperationResults(operations, response);
  }
  
  private translateEnhancedPortableTextToGoogleDocs(blocks: EnhancedPortableTextBlock[]): GoogleDocsBatchUpdateRequest[] {
    // Convert Enhanced PortableText to Google Docs native format
    // Handle colors, fonts, tables, etc.
  }
  
  private translateRangeOperationToGoogleDocs(operation: RangeOperation): GoogleDocsBatchUpdateRequest {
    switch (operation.type) {
      case 'insertText':
        return { insertText: { location: operation.location, text: operation.text } };
      case 'updateTextStyle':
        return {
          updateTextStyle: {
            range: operation.range,
            textStyle: this.convertStandardTextStyleToGoogleDocs(operation.textStyle),
            fields: this.getFieldsFromTextStyle(operation.textStyle)
          }
        };
      case 'replaceAllMatching':
        return {
          replaceAllText: {
            containsText: {
              text: operation.matchCriteria.text,
              matchCase: operation.matchCriteria.matchCase || false,
              searchByRegex: operation.matchCriteria.searchByRegex || false
            },
            replaceText: operation.text
          }
        };
      // ... other cases
    }
  }
}
```
```

### 3. Content Format Support

```typescript
// Enhanced loadResource method in GoogleDocsAccessor
async loadResource(resourceUri: string, options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
  // ... existing implementation ...
  
  // For rangeEdits workflow, we need character-indexed content
  if (contentFormat === 'plainText') {
    // Return markdown with character counting in mind
    content = googledocsToMarkdown(document, {
      includeTitle: true,
      includeMetadata: false,  // Reduce extra content for cleaner character counting
      renderTables: true,
      preservePageBreaks: true,
      preserveCharacterIndices: true  // New option for range operations
    });
    representationType = 'markdown';
  }
  
  // ... rest of implementation
}
```

## Updated DataSource Guidance

### Updated DataSource Guidance

#### Google Docs Provider Metadata

```typescript
// Updated load_datasource output for Google Docs
Content Type Guidance:
Primary Type: structured
Accepted Content Types: plainTextContent, structuredContent
Accepted Edit Types: rangeEdits  // Native character-indexed operations
Preferred Content Type: structuredContent

Supported Features:
• Text formatting: fonts, colors, bold, italic, underline
• Paragraph formatting: alignment, spacing, indentation
• Basic tables: rows, columns, cell formatting
• Headings: H1-H6 with styling
• Lists: numbered and bulleted
• Search/replace: with regex support

Supported Load Formats:
• plainText: Markdown format for reading and analysis
• structured: Native Google Docs JSON format (full fidelity)

Usage Examples:
1. Load document for analysis
   Tool: load_resources
   Key Parameters:
     resourcePath: document/abc123
     contentFormat: plainText

2. Load document for range editing
   Tool: load_resources  
   Key Parameters:
     resourcePath: document/abc123
     contentFormat: structured

3. Create document with rich formatting
   Tool: write_resource
   Key Parameters:
     structuredContent: Enhanced PortableText format

4. Edit document using range operations
   Tool: edit_resource
   Key Parameters:
     rangeEdits: { operations: [...] }

Important Notes:
• Google Docs accessors work with character-indexed range operations
• IMPORTANT: Use contentFormat='structured' to get full document fidelity
• Range operations provide precise character-level control with rich formatting
• Enhanced PortableText is translated to native Google Docs format
• Range operations are applied atomically as batch updates
```

#### Notion Provider (Updated)

```typescript
// Notion Provider continues to use blockEdits
Content Type Guidance:
Primary Type: structured
Accepted Content Types: plainTextContent, structuredContent
Accepted Edit Types: blockEdits
Preferred Content Type: structuredContent

Supported Features:
• Block-based content: paragraphs, headings, lists
• Rich text: bold, italic, links, mentions
• Databases: properties, relations, rollups
• Embedded content: images, files, bookmarks

Usage Examples:
1. Edit Notion page using block operations
   Tool: edit_resource
   Key Parameters:
     blockEdits: { operations: [...] }

2. Create Notion page with Enhanced PortableText
   Tool: write_resource
   Key Parameters:
     structuredContent: Enhanced PortableText (converted to Notion blocks)

Important Notes:
• IMPORTANT: Use contentFormat='structured' before edit_resource with blockEdits
• Block _key values are essential for precise editing operations
• Enhanced PortableText is translated to native Notion block format
```

## Implementation Strategy

### Phase 1: Enhanced PortableText and Schema Updates
1. Define Enhanced PortableText format with rich formatting support
2. Add `rangeEdits` to `editResource.tool` input schema
3. Update `loadResources.tool` contentFormat behavior
4. Update `writeResource.tool` to use Enhanced PortableText for structuredContent
5. Create `RangeResourceAccessor` interface
6. Update type definitions in `shared/types/dataSourceResource.ts`

### Phase 2: Provider/Accessor Implementation
1. **GoogleDocsAccessor**: Implement Enhanced PortableText translation layer
2. **GoogleDocsAccessor**: Implement `applyRangeOperations` with native API mapping
3. **NotionAccessor**: Update to handle Enhanced PortableText → Notion blocks
4. Add provider capability detection for rich formatting features
5. Update accessor `hasCapability` methods

### Phase 3: DataSource Provider Updates
1. Update Google Docs provider to specify `rangeEdits` capability
2. Update Notion provider to handle Enhanced PortableText input
3. Add rich formatting feature declarations to provider metadata
4. Update data source guidance and usage examples

### Phase 4: Testing and Integration
1. Create comprehensive test suite for Enhanced PortableText translation
2. Test range operations with rich formatting across providers
3. Validate cross-provider consistency of Enhanced PortableText
4. Test search/replace functionality with regex support
5. Ensure backward compatibility with existing workflows

## Benefits Summary

### Technical Benefits
1. **🎯 Precision**: Direct character-level control with rich formatting eliminates conversion losses
2. **🔄 Reliability**: Provider-specific translations ensure predictable results across platforms
3. **⚡ Performance**: Native API operations without complex conversion overhead
4. **🔍 Search Power**: Leverage provider-native search with regex support
5. **🔄 Atomic Operations**: All changes applied together or not at all
6. **🎨 Rich Formatting**: Support for fonts, colors, tables across providers

### Architectural Benefits
1. **🏗️ Clean Separation**: Providers define capabilities, accessors implement functionality
2. **🔧 Maintainable**: Provider translation layers handle format conversion
3. **📈 Extensible**: Enhanced PortableText easily extends to new formatting features
4. **🔄 Compatible**: Existing workflows continue working with enhanced capabilities
5. **🌐 Universal**: Same Enhanced PortableText works across Google Docs, Word Online, etc.

### LLM Benefits
1. **🧮 Calculable**: I can reliably compute character ranges and generate rich formatting
2. **🎯 Precise**: Operations target exactly the intended content with full formatting control
3. **🔍 Searchable**: Powerful pattern matching with case and regex options
4. **📊 Predictable**: Clear Enhanced PortableText → native format translation
5. **🎨 Rich Creation**: I can generate complex documents with tables, colors, fonts naturally

## Enhanced PortableText as Universal Rich Format

### Cross-Provider Rich Content Standard

The `structuredContent` uses Enhanced PortableText as a universal rich format:

```typescript
interface EnhancedPortableTextBlock {
  _type: 'block' | 'table' | 'divider' | 'image';
  _key: string;
  
  // Text blocks
  style?: 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote';
  children?: EnhancedPortableTextSpan[];
  
  // Enhanced paragraph formatting
  paragraphStyle?: {
    alignment?: 'left' | 'center' | 'right' | 'justify';
    backgroundColor?: string;  // hex color
    spacing?: { above?: number; below?: number };
    indentation?: { first?: number; left?: number; right?: number };
  };
  
  // Table blocks
  table?: {
    rows: number;
    columns: number;
    cells: EnhancedTableCell[][];
  };
}

interface EnhancedPortableTextSpan {
  _type: 'span';
  _key: string;
  text: string;
  marks?: string[];  // ['strong', 'em', 'underline']
  
  // Enhanced text formatting
  textStyle?: {
    color?: string;        // hex color
    backgroundColor?: string;
    fontSize?: number;     // points
    fontFamily?: string;   // standard fonts
  };
}

interface EnhancedTableCell {
  content: EnhancedPortableTextSpan[];
  style?: {
    backgroundColor?: string;
    alignment?: 'left' | 'center' | 'right';
    bold?: boolean;
  };
}
```

### Provider Translation Benefits

1. **LLM-Friendly**: Familiar JSON structure with clear hierarchy
2. **Cross-Provider**: Works with Google Docs, Word Online, Confluence, etc.
3. **Rich Formatting**: Supports colors, fonts, tables, alignment
4. **Extensible**: Easy to add new formatting properties
5. **Maintainable**: Single format to understand and generate

Each provider's accessor translates Enhanced PortableText to its native format:
- **Google Docs**: → StructuralElements with TextRuns and ParagraphStyles
- **Word Online**: → Office Open XML document structure  
- **Confluence**: → Atlassian Document Format
- **Notion**: → Block-based API format

This approach solves the cross-provider rich content problem by using a standardized Enhanced PortableText format that captures the essential rich formatting capabilities while being translatable to each provider's native format.