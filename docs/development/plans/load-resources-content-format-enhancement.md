# Load Resources Content Format Enhancement

## Problem Statement

The `load_resources` tool currently returns structured content (Notion, Google Docs) in markdown format rather than the underlying Portable Text structure. This creates a critical limitation:

- **For Reading**: Plain text format (rendered as markdown) is excellent and human-readable
- **For Editing**: Structured format (Portable Text blocks) is essential for `edit_resource` with `blockEdits`
- **Current Issue**: LLM cannot effectively use `edit_resource` on structured content because it lacks access to block `_key` values, block types, and proper nested structure

## Example of Current vs Needed Formats

### Current Output (Plain Text Format)
```markdown
# 👀 Problem

> **Example questions to answer:**
> What problem are we solving? For whom?

****What problem are we solving?****
Development teams struggle with context switching...
```

### Needed Output (Structured Format)
```json
[
  {
    "_type": "block",
    "_key": "abc123",
    "style": "h1",
    "children": [{"_type": "span", "text": "👀 Problem", "marks": []}]
  },
  {
    "_type": "block",
    "_key": "def456", 
    "style": "blockquote",
    "children": [
      {"_type": "span", "text": "Example questions to answer:", "marks": ["strong"]},
      {"_type": "span", "text": " What problem are we solving? For whom?", "marks": []}
    ]
  },
  {
    "_type": "block",
    "_key": "ghi789",
    "style": "normal", 
    "children": [
      {"_type": "span", "text": "What problem are we solving?", "marks": ["strong"]}
    ]
  },
  {
    "_type": "block",
    "_key": "jkl012",
    "style": "normal",
    "children": [
      {"_type": "span", "text": "Development teams struggle with context switching...", "marks": []}
    ]
  }
]
```

## Proposed Solution

Add a `contentFormat` parameter to the `load_resources` tool that allows requesting specific content representations:

```typescript
interface LoadResourcesInput {
  // ... existing parameters
  contentFormat?: 'plainText' | 'structured' | 'both';  // default: 'plainText'
}
```

### Format Behaviors by Data Source Type

#### Structured Content Sources (Notion, Google Docs)
1. **`plainText` (default)**: Human-readable format (markdown) for reading and analysis
2. **`structured`**: Raw block structure (Portable Text) for editing operations
3. **`both`**: Both representations for comprehensive access

#### Filesystem Sources
- **`contentFormat` parameter ignored**: Always returns native file content
- **Text files**: Content as-is (code, markdown, config files, etc.) - equivalent to `plainText` format
- **Binary files**: Binary data with appropriate MIME type metadata - equivalent to `binary` format
- **Content type determined automatically** by file extension and content analysis
- **Rationale**: Binary files have only one meaningful representation; text files are already in optimal format

### Use Case Mapping

| Use Case | Data Source Type | Preferred Format | Reason |
|----------|------------------|------------------|--------|
| Research/Reading | Structured | `plainText` | Human-readable, scannable |
| Research/Reading | Filesystem | N/A (ignored) | Native content returned |
| Edit Planning | Structured | `both` | Understand content + structure |
| Preparing Edits | Structured | `structured` | Need `_key` values for targeting |
| Content Analysis | Structured | `plainText` | Focus on meaning, not structure |
| Block Operations | Structured | `structured` | Essential for `edit_resource` |
| Code Review | Filesystem | N/A (ignored) | Source code returned as-is |
| Image Processing | Filesystem | N/A (ignored) | Binary data with MIME metadata |

## Implementation Details

### Tool Schema Updates

```typescript
// In load_resources tool input schema
contentFormat: {
  type: 'string',
  enum: ['plainText', 'structured', 'both'],
  default: 'plainText',
  description: 'Content representation format. plainText=human-readable (markdown for structured sources), structured=raw blocks for editing, both=comprehensive access. Parameter ignored for filesystem sources which always return native content.'
}
```

### Accessor Interface Changes

```typescript
// In ResourceAccessor base class
interface ResourceReadOptions {
  contentFormat?: 'plainText' | 'structured' | 'both';
}

abstract readResource(uri: string, options?: ResourceReadOptions): Promise<ResourceContent>;
```

### Response Format

```typescript
interface ResourceContent {
  // ... existing fields
  
  // For single format requests
  content?: string | PortableTextBlock[];
  
  // For 'both' format requests
  formats?: {
    plainText: string;
    structured: PortableTextBlock[];
  };
  
  // Metadata about content format
  contentFormat: 'plainText' | 'structured' | 'both';
  representationType?: 'markdown' | 'portable-text' | 'typescript' | 'json' | 'binary' | string;
}
```

### Accessor Implementation Strategy

#### NotionBlockResourceAccessor

```typescript
class NotionBlockResourceAccessor {
  async readResource(uri: string, options: ResourceReadOptions = {}): Promise<ResourceContent> {
    const format = options.contentFormat || 'plainText';
    
    // Get raw Portable Text blocks from Notion API
    const portableTextBlocks = await this.fetchPortableTextBlocks(uri);
    
    switch (format) {
      case 'plainText':
        return {
          content: this.convertPortableTextToMarkdown(portableTextBlocks),
          contentFormat: 'plainText',
          representationType: 'markdown'
        };
        
      case 'structured':
        return {
          content: portableTextBlocks,
          contentFormat: 'structured',
          representationType: 'portable-text'
        };
        
      case 'both':
        return {
          formats: {
            plainText: this.convertPortableTextToMarkdown(portableTextBlocks),
            structured: portableTextBlocks
          },
          contentFormat: 'both',
          representationTypes: {
            plainText: 'markdown',
            structured: 'portable-text'
          }
        };
    }
  }
}
```

#### FilesystemResourceAccessor

```typescript
class FilesystemResourceAccessor {
  async readResource(uri: string, options: ResourceReadOptions = {}): Promise<ResourceContent> {
    // Filesystem ignores contentFormat - always returns native content
    const { content, mimeType, isBinary } = await this.readFileWithMetadata(uri);
    
    return {
      content, // String for text files, Uint8Array for binary
      contentFormat: 'native',
      representationType: isBinary ? 'binary' : this.detectTextType(uri, content),
      mimeType,
      isBinary
    };
  }
  
  private detectTextType(uri: string, content: string): string {
    const ext = path.extname(uri).toLowerCase();
    const textTypeMap: Record<string, string> = {
      '.md': 'markdown',
      '.ts': 'typescript',
      '.js': 'javascript', 
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css'
    };
    
    return textTypeMap[ext] || 'plain-text';
  }
}
```

## Tool Usage Examples

### Research Workflow
```typescript
// Structured content - get readable format
{
  dataSourceId: 'notion-work',
  resourcePath: 'page/project-plan',
  contentFormat: 'plainText'  // Human-readable markdown for analysis
}

// Filesystem content - native format returned automatically
{
  dataSourceId: 'local',
  resourcePath: 'src/config.ts'
  // contentFormat ignored - returns TypeScript source code
}
```

### Editing Workflow
```typescript
// 1. Structured content - get comprehensive view for edit planning
{
  dataSourceId: 'notion-work', 
  resourcePath: 'page/project-plan',
  contentFormat: 'both'  // See content + structure
}

// 2. Structured content - get structure for precise editing
{
  dataSourceId: 'notion-work',
  resourcePath: 'page/project-plan', 
  contentFormat: 'structured'  // Just the blocks for edit_resource
}

// 3. Filesystem content - always gets native format
{
  dataSourceId: 'local',
  resourcePath: 'src/config.ts'
  // Returns source code as-is for edit_resource with searchAndReplaceEdits
}
```

### Integration with edit_resource
```typescript
// After loading structured content with 'structured' format:
{
  dataSourceId: 'notion-work',
  resourcePath: 'page/project-plan',
  blockEdits: {
    operations: [
      {
        type: 'update',
        selector: { blockKey: 'abc123' },  // From loaded portable text blocks
        value: {
          style: 'h1',
          children: [{_type: 'span', text: '👀 Updated Problem', marks: []}]
        }
      }
    ]
  }
}
```

## Backward Compatibility

- **Default behavior unchanged**: `contentFormat` defaults to `'plainText'` (equivalent to current markdown behavior)
- **Filesystem unchanged**: Always returns native content regardless of parameter
- **Existing workflows continue working**: No breaking changes
- **Gradual adoption**: New parameter is optional

## Implementation Phases

### Phase 1: Tool Schema Updates
1. Add `contentFormat` parameter to `load_resources` tool schema
2. Update tool validation and documentation
3. Add parameter to tool input interface

### Phase 2: Accessor Interface Updates
1. Add `ResourceReadOptions` interface
2. Update `ResourceAccessor` base class method signatures
3. Add `contentFormat` to response types

### Phase 3: Accessor Implementations
1. Update `NotionBlockResourceAccessor` to support all formats
2. Update `GoogleDocsResourceAccessor` for consistency
3. Update `FilesystemResourceAccessor` to handle parameter gracefully
4. Ensure all accessors return proper `contentFormat` metadata

### Phase 4: Testing and Integration
1. Add comprehensive tests for all format combinations
2. Test integration with `edit_resource` tool
3. Verify backward compatibility
4. Update documentation and examples

## Success Criteria

1. **LLM can effectively use `edit_resource` on structured content** - Access to `_key` values and block structure
2. **Backward compatibility maintained** - Existing workflows continue unchanged
3. **Format flexibility achieved** - Can request optimal format for each use case
4. **Performance acceptable** - No significant overhead for format conversion
5. **Developer experience improved** - Clear, predictable behavior across formats

## Benefits

1. **Unlocks structured content editing** - Essential for `edit_resource` with `blockEdits`
2. **Flexible workflows** - Choose optimal format for each task
3. **Improved efficiency** - Get exactly the format needed without conversion
4. **Better LLM decision making** - Access to structural information when needed
5. **Future extensibility** - Framework for additional format options

## Future Design Evolution

### Current Design Choice: Enum Approach

For the initial implementation, we're using an enum approach (`'plainText' | 'structured' | 'both'`) for simplicity and clarity in the current use case.

### Future Evolution: Array Approach

**Planned Evolution**: Future versions may migrate to an array-based approach for enhanced composability:

```typescript
// Future array approach
contentFormat?: string[]  // e.g., ['plainText', 'structured']

// Enables advanced future scenarios:
contentFormat: ['plainText', 'binary']        // Text extraction + original binary
contentFormat: ['structured', 'summary']      // Full structure + generated summary  
contentFormat: ['markdown', 'html']           // Multiple text representations
contentFormat: ['webp', 'png', 'binary']      // Multiple image formats
```

### Design Considerations for Future Compatibility

1. **Response Format**: Design response structures to be compatible with both enum and array approaches
2. **Accessor Interface**: Keep accessor methods flexible enough to handle multiple format requests
3. **Provider Capabilities**: Structure provider metadata to support extensible format lists
4. **Validation Logic**: Implement validation that can adapt to both single and multiple format requests

**Implementation Guidelines**: Keep interfaces extensible, design for composition, plan response evolution, and consider performance implications for multiple format generation. Starting with enum approach reduces initial complexity while laying groundwork for future array-based composability when advanced format combinations become valuable.

## DataSource Provider Guidance Updates

Update each data source provider's `getContentTypeGuidance()` method to include supported content formats:

### Enhanced Provider Interface

```typescript
interface ContentTypeGuidance {
  primaryContentType: 'plain-text' | 'structured' | 'binary' | 'database';
  acceptedContentTypes: string[];
  acceptedEditTypes: string[];
  
  // New: Content format support
  supportedLoadFormats: {
    default: string;
    available: string[];
    descriptions: Record<string, string>;
  };
  
  examples: {
    description: string;
    toolCall: any;
    // New: Format-specific examples
    contentFormat?: string;
  }[];
}
```

### Provider Implementation Examples

#### Filesystem Provider
```typescript
getContentTypeGuidance(): ContentTypeGuidance {
  return {
    primaryContentType: 'plain-text',
    acceptedContentTypes: ['plainTextContent', 'binaryContent'],
    acceptedEditTypes: ['searchAndReplaceEdits'],
    
    supportedLoadFormats: {
      default: 'native',
      available: ['native'],
      descriptions: {
        'native': 'Returns content in original format - contentFormat parameter ignored (TypeScript, JavaScript, JSON, markdown as text; images, PDFs as binary data)'
      }
    },
    
    examples: [
      {
        description: "Load TypeScript source code",
        toolCall: {
          tool: "load_resources",
          input: {
            resourcePath: "src/utils/helper.ts"
            // contentFormat not needed - native format returned
          }
        }
      },
      {
        description: "Load JSON configuration file",
        toolCall: {
          tool: "load_resources", 
          input: {
            resourcePath: "package.json"
            // Returns JSON content as text string
          }
        }
      },
      {
        description: "Load markdown documentation",
        toolCall: {
          tool: "load_resources",
          input: {
            resourcePath: "README.md"
            // Returns markdown source (not rendered HTML)
          }
        }
      },
      {
        description: "Load binary image file",
        toolCall: {
          tool: "load_resources", 
          input: {
            resourcePath: "assets/logo.png"
            // Returns binary data with MIME type metadata
          }
        }
      }
    ]
  };
}
```

#### Notion Provider
```typescript
getContentTypeGuidance(): ContentTypeGuidance {
  return {
    primaryContentType: 'structured',
    acceptedContentTypes: ['plainTextContent', 'structuredContent'],
    acceptedEditTypes: ['blockEdits'],
    
    supportedLoadFormats: {
      default: 'plainText',
      available: ['plainText', 'structured', 'both'],
      descriptions: {
        'plainText': 'Human-readable markdown format for reading and analysis',
        'structured': 'Raw Portable Text blocks for editing operations',
        'both': 'Both plainText and structured formats for comprehensive access'
      }
    },
    
    examples: [
      {
        description: "Load page for reading and research",
        contentFormat: "plainText",
        toolCall: {
          tool: "load_resources",
          input: {
            resourcePath: "page/project-plan",
            contentFormat: "plainText"
          }
        }
      },
      {
        description: "Load page structure for editing operations", 
        contentFormat: "structured",
        toolCall: {
          tool: "load_resources",
          input: {
            resourcePath: "page/project-plan",
            contentFormat: "structured"
          }
        }
      },
      {
        description: "Load page with both formats for comprehensive edit planning",
        contentFormat: "both", 
        toolCall: {
          tool: "load_resources",
          input: {
            resourcePath: "page/project-plan",
            contentFormat: "both"
          }
        }
      }
    ]
  };
}
```

### Updated load_datasource Output

The `load_datasource` tool output will include the enhanced format guidance:

#### Filesystem DataSource Example
```
Content Type Guidance:
Primary Type: plain-text
Accepted Content Types: plainTextContent, binaryContent
Accepted Edit Types: searchAndReplaceEdits
Preferred Content Type: plainTextContent

Supported Load Formats:
• native (default): Returns content in original format (TypeScript, JavaScript, JSON, markdown, binary, etc.)

Usage Examples:
1. Load TypeScript source code
   Tool: load_resources
   Key Parameters:
     resourcePath: src/utils/helper.ts

2. Load JSON configuration file
   Tool: load_resources  
   Key Parameters:
     resourcePath: package.json

3. Load binary image file
   Tool: load_resources
   Key Parameters:
     resourcePath: assets/logo.png

Important Notes:
• Filesystem data sources always return native content format
• Text files returned as strings with detected content type (typescript, json, markdown, etc.)
• Binary files returned as Uint8Array with MIME type metadata
• contentFormat parameter is ignored - native format always used
• Native text format is equivalent to plainText content type in write_resource
• Native binary format is equivalent to binaryContent type in write_resource
```

#### Notion DataSource Example
```
Content Type Guidance:
Primary Type: structured
Accepted Content Types: plainTextContent, structuredContent
Accepted Edit Types: blockEdits
Preferred Content Type: structuredContent

Supported Load Formats:
• plainText (default): Human-readable markdown format for reading and analysis
• structured: Raw Portable Text blocks for editing operations  
• both: Both plainText and structured formats for comprehensive access

Usage Examples:
1. Load page for reading and research
   Tool: load_resources
   Content Format: plainText
   Key Parameters:
     resourcePath: page/project-plan
     contentFormat: plainText

2. Load page structure for editing operations
   Tool: load_resources
   Content Format: structured
   Key Parameters:
     resourcePath: page/project-plan
     contentFormat: structured

3. Load page with both formats for comprehensive edit planning
   Tool: load_resources
   Content Format: both
   Key Parameters:
     resourcePath: page/project-plan
     contentFormat: both

Important Notes:
• IMPORTANT: Use contentFormat='structured' before edit_resource with blockEdits
• Block _key values are essential for precise editing operations
• plainText format is optimal for reading, research, and content analysis
• both format provides comprehensive access when planning complex edits
```

This enhancement is **critical for completing the unified content tools architecture** and enabling full functionality with structured content sources.