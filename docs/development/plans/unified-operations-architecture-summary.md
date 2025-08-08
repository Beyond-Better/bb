# Unified Operations Architecture: Summary

**Date**: August 6, 2025  
**Status**: Architectural Decision Complete  
**Purpose**: Human reference for the unified operations approach to content editing

## Executive Summary

After extensive analysis of the content editing challenges across diverse datasources (filesystem, Google Docs, Notion, etc.), we've designed a unified operations architecture that uses an inverted schema structure. Instead of grouping operations by type (`searchReplaceEdits.operations`, `rangeEdits.operations`), we use a flat array of operations where each operation declares its type (`operations[*].editType`). This approach provides maximum flexibility while maintaining clear conceptual boundaries.

## Problem Context

### Initial Challenge: Google Docs Integration
The Google Docs integration revealed a fundamental architectural mismatch:
- **PortableText blocks** → discrete, identified content units
- **Google Docs** → continuous document with character indices
- **Result**: Lossy conversion cycle causing block multiplication and content corruption

### Broader Challenge: Tool Proliferation
As BB expands to support more datasources and content types:
- Risk of creating separate tools for each operation type
- Cognitive overhead for LLMs in tool selection
- Maintenance burden of numerous similar tools

## Evolution of Thinking

### Stage 1: Initial Unified Tools Approach
**Decision**: Consolidate tools by intent (write_resource, edit_resource)  
**Structure**: Separate optional attributes for each content type
```typescript
{
  searchAndReplaceEdits?: { operations: [...] },
  blockEdits?: { operations: [...] }
}
```
**Limitation**: Awkward when combining different operation types

### Stage 2: RangeEdits Proposal
**Insight**: Google Docs needs character-range operations, not block operations  
**Proposal**: Add `rangeEdits` for character-indexed operations  
**Question**: Should search/replace be part of rangeEdits or separate?

### Stage 3: Conceptual Clarity
**Realization**: Search/replace is about finding text (intent), not implementation  
**Key Insights**:
- Filesystem search/replace already finds ranges then replaces
- Google Docs `replaceAllText` is conceptually identical
- Operations should be grouped by intent, not implementation

### Stage 4: Inverted Structure (Final)
**Breakthrough**: Invert the schema - make operations primary, not operation types  
**Structure**: `operations[*].editType` instead of `{editType}.operations`  
**Benefits**: Natural ordering, clear execution model, better extensibility

## Final Architecture

### Core Design Principles

1. **Operations as First-Class Citizens**
   - Each operation is self-contained with its type and parameters
   - Operations execute in array order, seeing results of previous operations
   - Natural dependency handling through ordering

2. **Intent-Based Operation Types**
   - `searchReplace`: Find and replace text patterns
   - `range`: Operate on specific character positions
   - `block`: Manipulate identified content blocks

3. **Provider-Specific Implementation**
   - Each datasource implements operations using native capabilities
   - Consistent interface with optimized implementation
   - Graceful degradation for unsupported operations

### Schema Structure

```typescript
interface EditResourceInput {
  dataSourceId?: string;
  resourcePath: string;
  operations: ResourceEditOperation[];
}

interface ResourceEditOperation {
  editType: 'searchReplace' | 'range' | 'block';
  
  // Use properties prefixed with editType (e.g., searchReplace_search)
  // This avoids LLM confusion with conditional properties
  [propertyName: string]: any;
}
```

### Property Prefix Design

Due to LLM limitations with complex conditional schemas (like `oneOf`), we use a full prefix approach:

```typescript
{
  editType: 'searchReplace',
  searchReplace_search: 'foo',        // Clear which operation this belongs to
  searchReplace_replace: 'bar',
  searchReplace_caseSensitive: true,
  range_rangeType: 'insertText',     // Obviously not for this operation
}
```

**Benefits**:
- Zero ambiguity about which properties belong to which operation
- Self-documenting property names
- Prevents accidental property mixing
- Works well with flat schemas that LLMs handle reliably

### Operation Types

#### SearchReplaceOperation
**Intent**: Find text patterns and replace them  
**Use Cases**: Fix typos, update terminology, refactor code  
**Supported By**: All text-capable datasources

#### RangeOperation  
**Intent**: Operate on specific character positions  
**Use Cases**: Format specific sections, insert at precise locations  
**Supported By**: Document-based datasources (Google Docs, Word, etc.)

#### BlockOperation
**Intent**: Manipulate discrete content blocks  
**Use Cases**: Reorder sections, update database properties  
**Supported By**: Block-based datasources (Notion, future CMSs)

## Why This Architecture?

### 1. Natural Mental Model
Developers and LLMs think in terms of sequential operations:
"First replace all TODOs with DONE, then format the title, then move the summary"

### 2. Maximum Flexibility
- Combine any operation types in a single call
- Clear execution order
- Each operation sees the document state after previous operations

### 3. Provider Optimization
- Filesystem uses native search/replace
- Google Docs batches all operations into one API call
- Notion applies block operations efficiently

### 4. Future Extensibility
Adding new operation types is trivial:
- `table` operations for spreadsheet manipulation
- `image` operations for visual content
- `metadata` operations for properties

### 5. Clear Validation
Each operation self-validates based on its type, providing specific error messages

## Implementation Benefits

### For LLMs
- Single tool with clear operation types
- Natural ordering matches thinking process
- No confusion about which tool to use

### For Developers
- Cleaner code with discriminated unions
- Easy to add new operation types
- Provider-specific optimizations transparent

### For Users
- Predictable execution model
- Powerful operation combinations
- Consistent across datasources

## Rejected Alternatives

### Alternative 1: Separate Tools per Operation
**Rejected Because**: Tool proliferation, selection overhead

### Alternative 2: Nested Operation Groups
**Rejected Because**: Unclear execution order, complex validation

### Alternative 3: Provider-Specific Tools
**Rejected Because**: Loss of abstraction benefits, maintenance burden

## Enhanced PortableText

The architecture includes Enhanced PortableText as a universal rich content format:
- Supports colors, fonts, tables, alignment
- Translates to each provider's native format
- Provides consistent content creation across datasources

## Success Metrics

1. **Reduced Cognitive Load**: One edit_resource tool handles all editing
2. **Provider Parity**: Same operations work across compatible providers  
3. **Execution Clarity**: Operation order is explicit and predictable
4. **Extensibility**: New operation types added without breaking changes
5. **Performance**: Provider-native implementations maintain efficiency

## Find Resource Evolution

### The Challenge

The find_resource tool needed to work across fundamentally different datasource types:
- **Filesystem**: Line-based text matching
- **Notion**: Block-based content
- **Databases**: Record-based data
- **GitHub**: Issues, code, pull requests

The existing line-centric approach didn't translate to structured datasources.

### Design Decisions

#### 1. Flexible Result Levels
**Decision**: Support multiple result detail levels  
**Options**: `resource` | `container` | `fragment` | `detailed`  
**Benefit**: Performance optimization and use-case flexibility

#### 2. Polymorphic Match Types
**Decision**: Different match types for different datasources  
**Types**: `TextMatch`, `BlockMatch`, `RecordMatch`, `TaskMatch`  
**Benefit**: Natural representation for each datasource type

#### 3. Actionable Results
**Decision**: Every match includes indexing information  
**Fields**: `resourceUri`, `characterRange`, `blockId`, `recordId`  
**Benefit**: Results directly usable with load/edit/write operations

#### 4. Pagination Support
**Decision**: Built-in pagination for large result sets  
**Implementation**: Page tokens with configurable page size  
**Benefit**: Handles large searches without overwhelming responses

#### 5. Advanced Query Support
**Decision**: Provider-specific structured queries  
**Approach**: Simple text search by default, structured queries for advanced use  
**Benefit**: Power when needed, simplicity by default

### Integration with Other Tools

The find_resource results seamlessly flow into other operations:

```typescript
// Find → Load
const results = await find_resources({ contentPattern: 'TODO' });
const files = await load_resources({ 
  mode: 'direct',
  directUris: results.resources.map(r => r.resourceUri)
});

// Find → Edit with ranges
const match = results.resources[0].matches[0] as TextMatch;
await edit_resource({
  resourcePath: results.resources[0].resourcePath,
  operations: [{
    editType: 'range',
    range_rangeType: 'replaceRange',
    range_range: match.characterRange,
    range_text: 'DONE'
  }]
});

// Find → Edit with blocks
const blockMatch = results.resources[0].matches[0] as BlockMatch;
await edit_resource({
  operations: [{
    editType: 'block',
    block_selector: { blockKey: blockMatch.blockId },
    block_operationType: 'update',
    // ...
  }]
});
```

## Conclusion

The unified architecture encompasses both the inverted operations structure for edit_resource and the flexible match types for find_resource. Together, they create a cohesive system where:

1. **Discovery flows into action**: Find results enable immediate operations
2. **Operations are sequenced naturally**: The inverted structure matches mental models
3. **Datasources retain their character**: Each provider works with its natural units
4. **Complexity scales gradually**: Simple cases stay simple, complex cases are possible

The key insights:
- Operations should be organized by sequence, not type
- Search results should match the natural units of each datasource
- Every result should enable immediate action

This creates a powerful yet intuitive system that scales across diverse content systems.