# Unified Content Tools: Conversation Summary

## Executive Summary

This document summarizes the architectural decisions and design approach for BB's unified content processing system. The goal is to replace multiple content-type-specific tools with a unified approach that maintains simplicity while supporting diverse content types through datasource-specific transformations.

## Current Problem

BB's tool ecosystem faces architectural challenges with content type proliferation:
- **Plain text tools** (`search_and_replace`, `rewrite_resource`) work with filesystem text files
- **Structured content tools** (`block_edit`) work with Portable Text format (Notion, Google Docs)
- **Future content types** will include images, databases, CSV files, etc.

The challenge: How to maintain a core set of tools while supporting fundamentally different content types without creating tool explosion (the "MCP problem").

## Key Design Decisions

### 1. Key Insight: LLMs Handle Schema Complexity Better Than Tool Selection

**Decision**: Prefer fewer tools with intelligent schema design over tool proliferation.

**Rationale**: 
- LLMs excel at structured JSON generation when given clear patterns
- Tool selection burden ("which tool should I use?") creates more cognitive overhead
- Rather than creating separate tools for each content type (`rewritePlainText`, `rewriteStructuredContent`, etc.), we use fewer tools with intelligent schema design

### 2. Explicit Content Type Attributes (Not Union Types)

**Decision**: Use separate, optional attributes for each content type rather than union types.

```typescript
interface UnifiedEditInput {
  // Exactly one of these should be provided
  plainTextContent?: {
    text: string;
    expectedLineCount: number;
  };
  
  portableTextContent?: {
    operations: PortableTextOperation[];
  };
  
  databaseContent?: {
    query: string;
    parameters?: Record<string, any>;
  };
}
```

**Rationale**: Union types create ambiguity for LLMs. Separate attributes are crystal clear and self-documenting.

### 3. Tool Consolidation Strategy

**Decision**: Consolidate around fundamental **intent** rather than **implementation approach**.

**New Tool Structure**:
- **`write_resource`**: Writing things (with optional overwrite for rewrite functionality)
- **`edit_resource`**: Modifying existing things with multiple editing approaches
- **`load_resource`**: Remains separate (different intent: read vs modify)  
- **`find_resource`**: Remains separate (discovery across multiple resources)

**Edit Resource Approaches**:
- `searchAndReplaceEdits`: Small, targeted changes
- `blockEdits`: Structural changes to rich content  
- `structuredDataEdits`: Tabular modifications

### 4. One Datasource Per Tool Call

**Decision**: Each tool call targets exactly one datasource.

**Rationale**: 
- Cross-datasource operations would be rare and conceptually confusing
- Cleaner validation (each call validates against one datasource's capabilities)
- Easier error handling and debugging

### 5. Legacy Tool Management

**Decision**: Mark old tools as legacy and exclude from new conversations.

**Implementation**: Use `"toolSets": ["legacy"]` attribute in `info.json`. The LLMToolManager will only include legacy tools in existing (old) conversations. 

### 6. Content Type Guidance Integration

**Decision**: Add content type guidance to `load_datasource` tool results rather than system prompt.

**Benefits**: 
- Dynamic based on actual datasource capabilities
- Reduces system prompt bloat
- Contextually relevant when LLM is exploring datasources

## Schema Design Patterns

### Create Resource Schema
```typescript
interface WriteResourceInput {
  dataSourceId?: string;
  resourcePath: string;
  overwriteExisting?: boolean;  // Replaces rewrite_resource functionality
  
  plainTextContent?: {
    content: string;
    expectedLineCount: number;
  };
  
  structuredContent?: {
    blocks: PortableTextBlock[];
  };
}
```

### Edit Resource Schema  
```typescript
interface EditResourceInput {
  dataSourceId?: string;
  resourcePath: string;
  
  searchAndReplaceEdits?: {
    operations: SearchReplaceOperation[];
    caseSensitive?: boolean;
    regexPattern?: boolean;
  };
  
  blockEdits?: {
    operations: PortableTextOperation[];
  };
  
  structuredDataEdits?: {
    operations: (RowOperation | ColumnOperation | CellOperation)[];
  };
}
```

## Implementation Principles

1. **Always validate input data** including content type compatibility
2. **Explicit operations only** - no hidden conditional logic
3. **Tools validate against datasource capabilities** with clear error messages
4. **Future-proof design** - easy to add new content types to existing tools

## Content Type Framework

### Content Types by Datasource

| Datasource Type | Examples | Content Attribute | Edit Approaches |
|---|---|---|---|
| **Filesystem** | local, bb-sass-abi, bb-site | `plainTextContent` | `searchAndReplaceEdits` |
| **Block-based** | Notion-work, google | `structuredContent` | `blockEdits` |
| **Database** | Supabase, PostgreSQL | `structuredDataContent` | `structuredDataEdits` |
| **Future: Images** | Image galleries | `imageContent` | `imageEdits` |

### Content Type Guidance Integration
Content type guidance will be provided dynamically through enhanced `load_datasource` results rather than static system prompt content.

## Design Decisions Summary

| Decision Point | Chosen Approach | Rationale |
|---|---|---|
| **Tool Count vs Schema Complexity** | Fewer tools, more complex schemas | LLMs handle JSON structure better than tool selection |
| **Content Type Specification** | Separate optional attributes | Clearer than union types, avoids ambiguity |
| **Legacy Tool Strategy** | Mark as legacy, exclude from new conversations | Maintains backward compatibility |
| **Content Type Guidance** | Dynamic via load_datasource results | Context-specific and always current |
| **Datasource Scope** | One datasource per tool call | Cleaner validation and error handling |
| **Conditional Operations** | Explicit LLM operations | Simpler tools, clearer intent |

## Benefits

1. **Reduced cognitive overhead**: Clear decision framework for LLMs
2. **Maintainable architecture**: Fewer tools to maintain and test
3. **Extensible design**: Easy to add new content types without tool explosion
4. **Clear error handling**: Content type validation with helpful error messages
5. **Future-proof**: Architecture supports unknown future content types

## Success Metrics

- **Reduced tool count** while maintaining functionality
- **Improved LLM tool selection accuracy** (>90% correct tool usage)
- **Consistent content handling** across datasource types
- **Easier addition** of new content types without architectural changes
- **Maintainable codebase** with clear, consistent patterns
- **Error reduction**: <5% content type compatibility errors

## Next Steps

See the detailed implementation plan for specific technical requirements, test cases, and migration strategy.

---

**Status**: Architectural design complete  
**Date**: 2025-08-03  
**Next Phase**: Implementation planning and execution