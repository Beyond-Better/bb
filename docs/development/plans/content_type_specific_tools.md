# BB Tool Architecture: Content-Type-Specific Tools with Enhanced Capabilities

## Problem Statement

The current BB tool ecosystem faces architectural challenges as it expands to support multiple datasource types with different content structures:

- **Plain Text Tools** (`rewriteResource.tool`, `searchAndReplace.tool`) work with filesystem text files
- **Structured Content Tools** (`blockEdit.tool`) work with Portable Text format (Notion, Google Docs)  
- **Future Content Types** will include images, databases, CSV files, etc.

**Current Issues:**
- Tools are tightly coupled to specific content types
- Simple string-based capability matching is insufficient
- No clear path for content transformation between formats
- Difficult to extend to new datasource types

## Recommended Architecture: Content-Type-Specific Tools

### **Core Principle: Keep Tools Focused, Enhance the Architecture**

**Separate tools by content type rather than extending existing ones.**

### **1. Tool Naming Convention**

**Current → Refactored:**
- `rewriteResource.tool` → `rewritePlainText.tool`
- `searchAndReplace.tool` → `searchAndReplacePlainText.tool`

**New Structured Content Tools:**
- `rewriteStructuredContent.tool`
- `searchAndReplaceStructuredContent.tool`

**Future Content-Type Tools:**
- `imageManipulation.tool` (already exists)
- `databaseQuery.tool`
- `csvManipulation.tool`

### **2. Enhanced Capability System**

Replace simple string capabilities with semantic capability system:

```typescript
// Current: Basic string array
capabilities: ['read', 'write', 'list']

// Enhanced: Semantic capabilities with content types
capabilities: {
  contentTypes: ['text/plain', 'application/portable-text', 'image/*'],
  operations: {
    'text/plain': ['read', 'write', 'search', 'replace', 'rewrite'],
    'application/portable-text': ['read', 'blockEdit', 'blockInsert', 'blockDelete'],
    'image/*': ['read', 'manipulate', 'metadata']
  },
  features: ['versioning', 'collaboration', 'real-time']
}
```

### **3. Tool-DataSource Matching Logic**

```typescript
interface ToolRequirements {
  requiredContentTypes: string[];
  requiredOperations: string[];
  optionalFeatures?: string[];
}

class ToolMatcher {
  findCompatibleTools(dataSource: DataSource, intent: string): Tool[] {
    return tools.filter(tool => 
      this.isCompatible(tool.requirements, dataSource.capabilities)
    );
  }
}
```

### **4. Content Transformation Layer**

```typescript
interface ContentTransformer {
  canTransform(from: string, to: string): boolean;
  transform(content: any, from: string, to: string): any;
}

// Example: Convert structured content to plain text for search
const plainTextContent = transformer.transform(
  portableTextContent, 
  'application/portable-text', 
  'text/plain'
);
```

### **5. High-Level Orchestration Tools**

Smart routing tools that delegate to appropriate content-specific implementations:

```typescript
class SmartRewriteTool extends LLMTool {
  async runTool(interaction, toolUse, projectEditor) {
    const dataSource = this.getDataSource(toolUse);
    const contentType = dataSource.getPrimaryContentType();
    
    if (contentType === 'text/plain') {
      return new RewritePlainTextTool().runTool(interaction, toolUse, projectEditor);
    } else if (contentType === 'application/portable-text') {
      return new RewriteStructuredContentTool().runTool(interaction, toolUse, projectEditor);
    }
    // ... etc
  }
}
```

## Implementation Phases

### **Phase 1: Enhance Existing Architecture**
- [ ] Rename current tools for clarity (`rewriteResource` → `rewritePlainText`)
- [ ] Implement enhanced capability system
- [ ] Update tool-datasource matching logic
- [ ] Add content type detection to datasources

### **Phase 2: Add Structured Content Tools**  
- [ ] Create `rewriteStructuredContent.tool`
- [ ] Create `searchAndReplaceStructuredContent.tool`
- [ ] Implement content transformation layer
- [ ] Add fallback mechanisms

### **Phase 3: High-Level Orchestration**
- [ ] Create smart routing tools (`smartRewrite.tool`, `smartSearch.tool`)
- [ ] Add capability-based tool discovery
- [ ] Implement graceful degradation (e.g., convert to plain text if structured operations not available)

## Content Type Examples

### **Database DataSource**
```typescript
const databaseDataSource = {
  capabilities: {
    contentTypes: ['application/sql', 'application/json'],
    operations: {
      'application/sql': ['query', 'update', 'schema'],
      'application/json': ['read', 'write', 'transform']
    }
  }
};

// Compatible tools:
// - databaseQuery.tool
// - jsonManipulation.tool  
// - Smart routing tools that convert other formats to SQL
```

### **Image Gallery DataSource**
```typescript
const imageGalleryDataSource = {
  capabilities: {
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    operations: {
      'image/*': ['read', 'resize', 'convert', 'metadata', 'thumbnail']
    }
  }
};

// Compatible tools:
// - imageManipulation.tool
// - imageMetadata.tool
// - imageThumbnail.tool
```

## Benefits

### **✅ Clarity & Maintainability**
- Each tool has single, clear responsibility
- Easier to test, debug, and maintain
- Clear mental model for developers

### **✅ Extensibility**
- Adding new content types doesn't require modifying existing tools
- New datasources declare capabilities explicitly
- Future-proof for any content type (media, databases, APIs)

### **✅ Performance**
- Tools optimized for specific content types
- No unnecessary branching or complexity
- Direct operations without conversion overhead

### **✅ User Experience**
- High-level orchestration tools provide simple interfaces
- Power users can access specific tools directly
- Clear error messages when capabilities don't match
- Graceful fallbacks when perfect match unavailable

## Migration Strategy

1. **Backward Compatibility**: Keep existing tool names as aliases during transition
2. **Gradual Rollout**: Implement new architecture alongside existing tools
3. **User Communication**: Clear documentation of new tool naming and capabilities
4. **Testing**: Comprehensive testing of tool routing and fallback mechanisms

## Future Considerations

- **Plugin Architecture**: Third-party tools can register with capability requirements
- **AI-Assisted Tool Selection**: LLM can choose optimal tools based on content analysis
- **Performance Monitoring**: Track tool efficiency for different content types
- **Content Type Detection**: Automatic detection and suggestion of appropriate tools

---

**Status**: Architectural design ready for implementation  
**Next Steps**: Begin Phase 1 implementation with tool renaming and capability system enhancement